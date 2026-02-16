import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gte, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { AccountsService } from '../accounts/accounts.service';
import * as schema from '../../database/schema';

@Injectable()
export class NetWorthService {
  private readonly logger = new Logger(NetWorthService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private accountsService: AccountsService,
  ) {}

  async snapshotNetWorth(userId: string) {
    const netWorth = await this.accountsService.getNetWorth(userId);
    const today = new Date().toISOString().split('T')[0];

    // Upsert — replace existing snapshot for today
    const existing = await this.db
      .select({ id: schema.netWorthHistory.id })
      .from(schema.netWorthHistory)
      .where(
        and(
          eq(schema.netWorthHistory.userId, userId),
          eq(schema.netWorthHistory.date, today),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(schema.netWorthHistory)
        .set({
          assets: netWorth.assets,
          liabilities: netWorth.liabilities,
          netWorth: netWorth.netWorth,
          accountCount: netWorth.accountCount,
        })
        .where(eq(schema.netWorthHistory.id, existing[0].id));
    } else {
      await this.db.insert(schema.netWorthHistory).values({
        userId,
        date: today,
        assets: netWorth.assets,
        liabilities: netWorth.liabilities,
        netWorth: netWorth.netWorth,
        accountCount: netWorth.accountCount,
      });
    }

    return netWorth;
  }

  async snapshotAllUsers() {
    const users = await this.db
      .select({ id: schema.users.id })
      .from(schema.users);

    this.logger.log(`Snapshotting net worth for ${users.length} users`);

    for (const user of users) {
      try {
        await this.snapshotNetWorth(user.id);
      } catch (error) {
        this.logger.error(
          `Failed to snapshot net worth for user ${user.id}: ${error}`,
        );
      }
    }
  }

  async getHistory(userId: string, days: number = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const start = startDate.toISOString().split('T')[0];

    return this.db
      .select({
        date: schema.netWorthHistory.date,
        assets: schema.netWorthHistory.assets,
        liabilities: schema.netWorthHistory.liabilities,
        netWorth: schema.netWorthHistory.netWorth,
      })
      .from(schema.netWorthHistory)
      .where(
        and(
          eq(schema.netWorthHistory.userId, userId),
          gte(schema.netWorthHistory.date, start),
        ),
      )
      .orderBy(schema.netWorthHistory.date);
  }
}
