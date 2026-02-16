import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { roundUpConfigs, roundUpTransactions } from './roundup.schema';

export interface RoundUpConfig {
  id: string;
  userId: string;
  enabled: boolean;
  roundTo: number;
  multiplier: number;
  savingsGoalId: string | null;
  maxDailyRoundUp: number | null;
  accountId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingRoundUp {
  transactionId: string;
  transactionName: string;
  transactionDate: string;
  originalAmount: number;
  roundedAmount: number;
  roundUpAmount: number;
}

export interface ProcessResult {
  processed: number;
  skipped: number;
  totalRoundedUp: number;
  savingsGoalId: string | null;
}

export interface RoundUpStats {
  totalRoundedUp: number;
  totalTransactions: number;
  averageRoundUp: number;
  thisMonthTotal: number;
  thisMonthCount: number;
  allTimeTotal: number;
  allTimeCount: number;
  largestRoundUp: number;
  enabled: boolean;
  config: RoundUpConfig | null;
}

@Injectable()
export class RoundUpService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Configure round-up rules for a user. Creates or updates the config.
   */
  async configureRoundUp(
    userId: string,
    config: {
      enabled?: boolean;
      roundTo?: number;
      multiplier?: number;
      savingsGoalId?: string | null;
      maxDailyRoundUp?: number | null;
      accountId?: string | null;
    },
  ): Promise<RoundUpConfig> {
    // Check for existing config
    const [existing] = await this.db
      .select()
      .from(roundUpConfigs)
      .where(eq(roundUpConfigs.userId, userId))
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(roundUpConfigs)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(eq(roundUpConfigs.id, existing.id))
        .returning();

      return updated as RoundUpConfig;
    }

    const [created] = await this.db
      .insert(roundUpConfigs)
      .values({
        userId,
        enabled: config.enabled ?? true,
        roundTo: config.roundTo ?? 1,
        multiplier: config.multiplier ?? 1,
        savingsGoalId: config.savingsGoalId ?? null,
        maxDailyRoundUp: config.maxDailyRoundUp ?? 10,
        accountId: config.accountId ?? null,
      })
      .returning();

    return created as RoundUpConfig;
  }

  /**
   * Get current round-up config for a user.
   */
  async getRoundUpConfig(userId: string): Promise<RoundUpConfig | null> {
    const [config] = await this.db
      .select()
      .from(roundUpConfigs)
      .where(eq(roundUpConfigs.userId, userId))
      .limit(1);

    return (config as RoundUpConfig) || null;
  }

  /**
   * Calculate round-ups for recent transactions that haven't been rounded up yet.
   */
  async calculatePendingRoundUps(userId: string): Promise<PendingRoundUp[]> {
    const config = await this.getRoundUpConfig(userId);
    if (!config || !config.enabled) return [];

    const roundTo = config.roundTo || 1;
    const multiplier = config.multiplier || 1;

    // Get recent spending transactions (positive amounts = spending)
    // that haven't been processed for round-ups
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    // Build query conditions
    const conditions = [
      eq(schema.transactions.userId, userId),
      gte(schema.transactions.date, startDate),
      eq(schema.transactions.pending, false),
      sql`${schema.transactions.amount} > 0`, // spending only
    ];

    // Filter by account if configured
    if (config.accountId) {
      conditions.push(eq(schema.transactions.accountId, config.accountId));
    }

    const transactions = await this.db
      .select({
        id: schema.transactions.id,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
      })
      .from(schema.transactions)
      .where(and(...conditions))
      .orderBy(desc(schema.transactions.date));

    // Get already-processed transaction IDs
    const processedIds = await this.db
      .select({ transactionId: roundUpTransactions.transactionId })
      .from(roundUpTransactions)
      .where(eq(roundUpTransactions.userId, userId));

    const processedSet = new Set(processedIds.map((r) => r.transactionId));

    // Calculate round-ups for unprocessed transactions
    const pending: PendingRoundUp[] = [];

    for (const tx of transactions) {
      if (processedSet.has(tx.id)) continue;

      const absAmount = Math.abs(tx.amount);
      const rounded = Math.ceil(absAmount / roundTo) * roundTo;
      let roundUpAmount = Math.round((rounded - absAmount) * 100) / 100;

      // If the amount is exactly on the round-to boundary, round up to the next one
      if (roundUpAmount === 0) {
        roundUpAmount = roundTo;
      }

      // Apply multiplier
      roundUpAmount = Math.round(roundUpAmount * multiplier * 100) / 100;

      if (roundUpAmount > 0) {
        pending.push({
          transactionId: tx.id,
          transactionName: tx.merchantName || tx.name,
          transactionDate: tx.date,
          originalAmount: tx.amount,
          roundedAmount: rounded,
          roundUpAmount,
        });
      }
    }

    return pending;
  }

  /**
   * Process pending round-ups: record them and optionally contribute to savings goal.
   */
  async processRoundUps(userId: string): Promise<ProcessResult> {
    const config = await this.getRoundUpConfig(userId);
    if (!config || !config.enabled) {
      return { processed: 0, skipped: 0, totalRoundedUp: 0, savingsGoalId: null };
    }

    const pending = await this.calculatePendingRoundUps(userId);
    if (pending.length === 0) {
      return { processed: 0, skipped: 0, totalRoundedUp: 0, savingsGoalId: config.savingsGoalId };
    }

    const maxDaily = config.maxDailyRoundUp ?? 10;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Calculate how much has already been rounded up today
    const [todayTotal] = await this.db
      .select({
        total:
          sql<number>`COALESCE(SUM(${roundUpTransactions.roundUpAmount}), 0)`.as(
            'total',
          ),
      })
      .from(roundUpTransactions)
      .where(
        and(
          eq(roundUpTransactions.userId, userId),
          eq(roundUpTransactions.status, 'processed'),
          gte(roundUpTransactions.createdAt, new Date(todayStr)),
        ),
      );

    let dailyUsed = todayTotal?.total ?? 0;
    let processed = 0;
    let skipped = 0;
    let totalRoundedUp = 0;

    for (const roundUp of pending) {
      if (dailyUsed + roundUp.roundUpAmount > maxDaily) {
        // Exceed daily cap — record as skipped
        await this.db.insert(roundUpTransactions).values({
          userId,
          transactionId: roundUp.transactionId,
          originalAmount: roundUp.originalAmount,
          roundedAmount: roundUp.roundedAmount,
          roundUpAmount: roundUp.roundUpAmount,
          status: 'skipped',
        });
        skipped++;
        continue;
      }

      await this.db.insert(roundUpTransactions).values({
        userId,
        transactionId: roundUp.transactionId,
        originalAmount: roundUp.originalAmount,
        roundedAmount: roundUp.roundedAmount,
        roundUpAmount: roundUp.roundUpAmount,
        status: 'processed',
        processedAt: now,
      });

      dailyUsed += roundUp.roundUpAmount;
      totalRoundedUp += roundUp.roundUpAmount;
      processed++;
    }

    // If there's a savings goal, add a contribution
    if (config.savingsGoalId && totalRoundedUp > 0) {
      try {
        const [goal] = await this.db
          .select()
          .from(schema.savingsGoals)
          .where(eq(schema.savingsGoals.id, config.savingsGoalId))
          .limit(1);

        if (goal) {
          const newAmount = goal.currentAmount + totalRoundedUp;

          await this.db
            .insert(schema.savingsContributions)
            .values({
              goalId: config.savingsGoalId,
              amount: Math.round(totalRoundedUp * 100) / 100,
              note: `Round-up savings from ${processed} transaction(s)`,
              date: todayStr,
            });

          await this.db
            .update(schema.savingsGoals)
            .set({
              currentAmount: Math.round(newAmount * 100) / 100,
              updatedAt: new Date(),
            })
            .where(eq(schema.savingsGoals.id, config.savingsGoalId));
        }
      } catch {
        // Savings goal contribution is best-effort
      }
    }

    return {
      processed,
      skipped,
      totalRoundedUp: Math.round(totalRoundedUp * 100) / 100,
      savingsGoalId: config.savingsGoalId,
    };
  }

  /**
   * Get round-up history and stats for a user.
   */
  async getRoundUpStats(userId: string): Promise<RoundUpStats> {
    const config = await this.getRoundUpConfig(userId);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // All-time stats
    const [allTimeStats] = await this.db
      .select({
        total:
          sql<number>`COALESCE(SUM(${roundUpTransactions.roundUpAmount}), 0)`.as(
            'total',
          ),
        count: sql<number>`COUNT(*)`.as('count'),
        largest:
          sql<number>`COALESCE(MAX(${roundUpTransactions.roundUpAmount}), 0)`.as(
            'largest',
          ),
      })
      .from(roundUpTransactions)
      .where(
        and(
          eq(roundUpTransactions.userId, userId),
          eq(roundUpTransactions.status, 'processed'),
        ),
      );

    // This month stats
    const [thisMonthStats] = await this.db
      .select({
        total:
          sql<number>`COALESCE(SUM(${roundUpTransactions.roundUpAmount}), 0)`.as(
            'total',
          ),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(roundUpTransactions)
      .where(
        and(
          eq(roundUpTransactions.userId, userId),
          eq(roundUpTransactions.status, 'processed'),
          gte(roundUpTransactions.createdAt, new Date(monthStart)),
        ),
      );

    const allTimeTotal = allTimeStats?.total ?? 0;
    const allTimeCount = allTimeStats?.count ?? 0;
    const thisMonthTotal = thisMonthStats?.total ?? 0;
    const thisMonthCount = thisMonthStats?.count ?? 0;
    const largestRoundUp = allTimeStats?.largest ?? 0;
    const averageRoundUp =
      allTimeCount > 0
        ? Math.round((allTimeTotal / allTimeCount) * 100) / 100
        : 0;

    return {
      totalRoundedUp: Math.round(allTimeTotal * 100) / 100,
      totalTransactions: allTimeCount,
      averageRoundUp,
      thisMonthTotal: Math.round(thisMonthTotal * 100) / 100,
      thisMonthCount,
      allTimeTotal: Math.round(allTimeTotal * 100) / 100,
      allTimeCount,
      largestRoundUp: Math.round(largestRoundUp * 100) / 100,
      enabled: config?.enabled ?? false,
      config,
    };
  }
}
