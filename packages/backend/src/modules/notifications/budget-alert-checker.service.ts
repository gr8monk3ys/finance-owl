import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { NotificationTriggerService } from './notification-trigger.service';

/**
 * Budget utilization alerts at the 75%, 90% and 100% thresholds.
 *
 * This used to be NotificationSchedulerService, which drove itself with
 * `setInterval(24h)`. That has no distributed lock, so every replica ran the
 * sweep and users got one copy per instance; the comment justified it as
 * avoiding "an extra dependency" while BullMQ sat one module away. Scheduling
 * now lives in modules/jobs/schedules.ts, where Redis guarantees a single
 * runner, and this class is left holding only the check itself.
 *
 * Its bill-reminder half is gone: modules/jobs/bill-reminder.service.ts is
 * the one implementation, and it dedupes.
 */
@Injectable()
export class BudgetAlertCheckerService {
  private readonly logger = new Logger(BudgetAlertCheckerService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly triggerService: NotificationTriggerService,
  ) {}

  // ── Budget Utilization ──────────────────────────────────────────
  /**
   * For each active budget, compute current spending versus limit.
   * Trigger alerts at 75%, 90%, and 100% thresholds. Only sends once
   * per threshold by checking existing notifications.
   */
  async checkBudgetUtilization(): Promise<number> {
    const activeBudgets = await this.db
      .select()
      .from(schema.budgets)
      .where(eq(schema.budgets.isActive, true));

    let sent = 0;

    for (const budget of activeBudgets) {
      try {
        const spent = await this.getSpentForBudget(budget);
        const limit = Number(budget.amount);

        if (limit <= 0) continue;

        const percentUsed = (spent / limit) * 100;
        const budgetName = budget.name ?? `Budget ${budget.id.slice(0, 8)}`;

        // Determine which thresholds have been crossed
        const thresholds = [75, 90, 100];

        for (const threshold of thresholds) {
          if (percentUsed < threshold) continue;

          // Check if we already sent an alert for this threshold+budget combo
          const alreadySent = await this.hasRecentAlert(budget.userId, budget.id, threshold);

          if (alreadySent) continue;

          await this.triggerService.triggerBudgetAlert(
            budget.userId,
            budgetName,
            percentUsed,
            spent,
            limit,
          );
          sent++;
        }
      } catch (err) {
        this.logger.error(`Failed to check budget utilization for budget=${budget.id}`, err);
      }
    }

    this.logger.log(`Budget alerts sent: ${sent}`);

    return sent;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Compute total spending for a budget in the current period.
   * Uses category-based transaction sums for the current month.
   */
  private async getSpentForBudget(budget: typeof schema.budgets.$inferSelect): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodStartStr = periodStart.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    if (!budget.categoryId) {
      // Overall budget -- sum all transactions
      const [result] = await this.db
        .select({
          total: sql<number>`COALESCE(SUM(ABS(${schema.transactions.amount})), 0)`,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, budget.userId),
            gte(schema.transactions.date, periodStartStr),
            lte(schema.transactions.date, todayStr),
          ),
        );
      return Number(result?.total ?? 0);
    }

    // Category budget -- sum transactions in the category
    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(${schema.transactions.amount})), 0)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, budget.userId),
          eq(schema.transactions.categoryId, budget.categoryId),
          gte(schema.transactions.date, periodStartStr),
          lte(schema.transactions.date, todayStr),
        ),
      );

    return Number(result?.total ?? 0);
  }

  /**
   * Check whether a budget alert for a specific threshold was already
   * sent within the current calendar month to avoid duplicates.
   */
  private async hasRecentAlert(
    userId: string,
    budgetId: string,
    threshold: number,
  ): Promise<boolean> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [existing] = await this.db
      .select({ id: schema.budgetAlerts.id })
      .from(schema.budgetAlerts)
      .where(
        and(
          eq(schema.budgetAlerts.userId, userId),
          eq(schema.budgetAlerts.budgetId, budgetId),
          eq(schema.budgetAlerts.thresholdPercent, threshold),
          gte(schema.budgetAlerts.createdAt, monthStart),
        ),
      )
      .limit(1);

    return !!existing;
  }
}
