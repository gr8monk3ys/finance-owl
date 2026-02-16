import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc, count } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { HibpProvider } from './hibp.provider';
import {
  breachChecks,
  breaches,
  passwordExposures,
} from './identity.schema';

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private hibpProvider: HibpProvider,
  ) {}

  async checkEmail(userId: string, email: string) {
    // Find or create the breach check record for this email
    let [check] = await this.db
      .select()
      .from(breachChecks)
      .where(
        and(
          eq(breachChecks.userId, userId),
          eq(breachChecks.email, email),
        ),
      )
      .limit(1);

    if (!check) {
      const [inserted] = await this.db
        .insert(breachChecks)
        .values({ userId, email })
        .returning();
      check = inserted;
    }

    // Call HIBP API
    const hibpBreaches = await this.hibpProvider.getBreachesForEmail(email);

    // Upsert breaches — check for existing ones by name to avoid duplicates
    let newBreachCount = 0;
    for (const hb of hibpBreaches) {
      const [existing] = await this.db
        .select()
        .from(breaches)
        .where(
          and(
            eq(breaches.checkId, check.id),
            eq(breaches.breachName, hb.Name),
          ),
        )
        .limit(1);

      if (!existing) {
        await this.db.insert(breaches).values({
          userId,
          checkId: check.id,
          breachName: hb.Name,
          breachDate: hb.BreachDate,
          breachDescription: hb.Description,
          dataClasses: JSON.stringify(hb.DataClasses),
          isVerified: hb.IsVerified ? 1 : 0,
          isSensitive: hb.IsSensitive ? 1 : 0,
        });
        newBreachCount++;
      }
    }

    // Update the check record
    const now = new Date().toISOString();
    await this.db
      .update(breachChecks)
      .set({
        lastCheckedAt: now,
        totalBreaches: hibpBreaches.length,
      })
      .where(eq(breachChecks.id, check.id));

    return {
      email,
      totalBreaches: hibpBreaches.length,
      newBreaches: newBreachCount,
      lastCheckedAt: now,
    };
  }

  async checkPassword(sha1Hash: string) {
    const prefix = sha1Hash.substring(0, 5).toUpperCase();
    const suffix = sha1Hash.substring(5).toUpperCase();

    const results = await this.hibpProvider.checkPasswordRange(prefix);
    const exposureCount = results.get(suffix) ?? 0;

    return {
      prefix,
      exposed: exposureCount > 0,
      exposureCount,
    };
  }

  async getBreaches(userId: string) {
    const items = await this.db
      .select({
        id: breaches.id,
        checkId: breaches.checkId,
        breachName: breaches.breachName,
        breachDate: breaches.breachDate,
        breachDescription: breaches.breachDescription,
        dataClasses: breaches.dataClasses,
        isVerified: breaches.isVerified,
        isSensitive: breaches.isSensitive,
        isAcknowledged: breaches.isAcknowledged,
        createdAt: breaches.createdAt,
        email: breachChecks.email,
      })
      .from(breaches)
      .innerJoin(breachChecks, eq(breaches.checkId, breachChecks.id))
      .where(eq(breaches.userId, userId))
      .orderBy(desc(breaches.breachDate));

    return items.map((item) => ({
      ...item,
      dataClasses: JSON.parse(item.dataClasses) as string[],
    }));
  }

  async getBreachSummary(userId: string) {
    const allBreaches = await this.getBreaches(userId);

    const totalBreaches = allBreaches.length;
    const unacknowledged = allBreaches.filter((b) => !b.isAcknowledged).length;

    // Most recent breach
    const mostRecent = allBreaches.length > 0 ? allBreaches[0] : null;

    // Collect all exposed data types
    const allDataTypes = new Set<string>();
    for (const breach of allBreaches) {
      for (const dc of breach.dataClasses) {
        allDataTypes.add(dc);
      }
    }

    // Determine severity
    const criticalTypes = [
      'Passwords',
      'Credit cards',
      'Bank account numbers',
      'Financial investments',
      'Income levels',
      'Credit status information',
      'Social security numbers',
    ];
    const hasCritical = allBreaches.some((b) =>
      b.dataClasses.some((dc: string) => criticalTypes.includes(dc)),
    );

    let severity: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (totalBreaches === 0) {
      severity = 'none';
    } else if (hasCritical) {
      severity = 'critical';
    } else if (totalBreaches > 5) {
      severity = 'high';
    } else if (totalBreaches > 2) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    // Last check date across all monitored emails
    const checks = await this.db
      .select()
      .from(breachChecks)
      .where(eq(breachChecks.userId, userId))
      .orderBy(desc(breachChecks.lastCheckedAt))
      .limit(1);

    const lastCheckDate = checks.length > 0 ? checks[0].lastCheckedAt : null;

    return {
      totalBreaches,
      unacknowledged,
      mostRecent: mostRecent
        ? {
            name: mostRecent.breachName,
            date: mostRecent.breachDate,
          }
        : null,
      dataTypesExposed: Array.from(allDataTypes),
      severity,
      lastCheckDate,
    };
  }

  async acknowledgeBreach(userId: string, breachId: string) {
    const [breach] = await this.db
      .select()
      .from(breaches)
      .where(
        and(eq(breaches.id, breachId), eq(breaches.userId, userId)),
      )
      .limit(1);

    if (!breach) {
      throw new NotFoundException('Breach not found');
    }

    await this.db
      .update(breaches)
      .set({ isAcknowledged: 1 })
      .where(
        and(eq(breaches.id, breachId), eq(breaches.userId, userId)),
      );

    return { ...breach, isAcknowledged: 1 };
  }

  async addMonitoredEmail(userId: string, email: string) {
    // Check if already monitored
    const [existing] = await this.db
      .select()
      .from(breachChecks)
      .where(
        and(
          eq(breachChecks.userId, userId),
          eq(breachChecks.email, email),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('This email is already being monitored');
    }

    const [check] = await this.db
      .insert(breachChecks)
      .values({ userId, email })
      .returning();

    return check;
  }

  async getMonitoredEmails(userId: string) {
    return this.db
      .select()
      .from(breachChecks)
      .where(eq(breachChecks.userId, userId))
      .orderBy(desc(breachChecks.createdAt));
  }

  async removeMonitoredEmail(userId: string, checkId: string) {
    const [check] = await this.db
      .select()
      .from(breachChecks)
      .where(
        and(
          eq(breachChecks.id, checkId),
          eq(breachChecks.userId, userId),
        ),
      )
      .limit(1);

    if (!check) {
      throw new NotFoundException('Monitored email not found');
    }

    // Delete associated breaches and password exposures first (cascade should handle it,
    // but be explicit for clarity)
    await this.db
      .delete(breaches)
      .where(eq(breaches.checkId, checkId));

    await this.db
      .delete(passwordExposures)
      .where(eq(passwordExposures.checkId, checkId));

    await this.db
      .delete(breachChecks)
      .where(
        and(
          eq(breachChecks.id, checkId),
          eq(breachChecks.userId, userId),
        ),
      );
  }

  async runPeriodicCheck(userId: string) {
    const emails = await this.getMonitoredEmails(userId);
    const results = [];

    for (const check of emails) {
      try {
        const result = await this.checkEmail(userId, check.email);
        results.push(result);
      } catch (error) {
        results.push({
          email: check.email,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to check email',
        });
      }
    }

    return {
      checked: emails.length,
      results,
    };
  }
}
