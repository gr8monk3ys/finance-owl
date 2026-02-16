import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import {
  DATABASE_TOKEN,
  type DrizzleDB,
} from '../../database/database.module';
import * as schema from '../../database/schema';
import { NotificationTriggerService } from './notification-trigger.service';

/**
 * Runs periodic checks to generate notifications:
 *
 *  - Daily: bills coming due within the user's reminder window
 *  - Daily: budget utilization alerts at 75%, 90%, and 100%
 *
 * Uses setInterval with NestJS lifecycle hooks instead of
 * @nestjs/schedule to avoid adding an extra dependency.
 * The interval fires every 24 hours; on startup it runs once immediately.
 */
@Injectable()
export class NotificationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationSchedulerService.name);

  private dailyTimer: ReturnType<typeof setInterval> | null = null;

  /** 24 hours in milliseconds */
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly triggerService: NotificationTriggerService,
  ) {}

  onModuleInit() {
    // Fire once on startup (non-blocking), then every 24 h
    this.runDailyChecks().catch((err) =>
      this.logger.error('Initial daily check failed', err),
    );

    this.dailyTimer = setInterval(() => {
      this.runDailyChecks().catch((err) =>
        this.logger.error('Scheduled daily check failed', err),
      );
    }, NotificationSchedulerService.DAY_MS);

    this.logger.log('Notification scheduler started (24 h interval)');
  }

  onModuleDestroy() {
    if (this.dailyTimer) {
      clearInterval(this.dailyTimer);
      this.dailyTimer = null;
    }
    this.logger.log('Notification scheduler stopped');
  }

  // ── Top-level runner ────────────────────────────────────────────
  async runDailyChecks() {
    this.logger.log('Running daily notification checks');

    await this.checkBillReminders();
    await this.checkBudgetUtilization();

    this.logger.log('Daily notification checks complete');
  }

  // ── Bill Reminders ──────────────────────────────────────────────
  /**
   * For every user with active recurring transactions that have a
   * nextExpectedDate within their configured reminder window (default
   * 3 days), trigger a bill reminder notification.
   */
  async checkBillReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Look ahead up to 7 days (the max reasonable reminder window)
    const maxLookahead = new Date(today);
    maxLookahead.setDate(maxLookahead.getDate() + 7);
    const maxLookaheadStr = maxLookahead.toISOString().split('T')[0];

    // Get all upcoming bills with their user's preference
    const upcomingBills = await this.db
      .select({
        billId: schema.recurringTransactions.id,
        userId: schema.recurringTransactions.userId,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
        reminderDays: schema.notificationPreferences.billReminderDaysBefore,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.notificationPreferences,
        eq(
          schema.recurringTransactions.userId,
          schema.notificationPreferences.userId,
        ),
      )
      .where(
        and(
          eq(schema.recurringTransactions.isActive, true),
          gte(schema.recurringTransactions.nextExpectedDate, todayStr),
          lte(schema.recurringTransactions.nextExpectedDate, maxLookaheadStr),
        ),
      );

    let sent = 0;

    for (const bill of upcomingBills) {
      if (!bill.nextExpectedDate) continue;

      const dueDate = new Date(bill.nextExpectedDate + 'T00:00:00');
      const daysBefore = Math.round(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Use user's preference or default of 3
      const reminderWindow = bill.reminderDays ?? 3;

      if (daysBefore > reminderWindow) continue;

      try {
        await this.triggerService.triggerBillReminder(
          bill.userId,
          bill.merchantName ?? bill.name,
          bill.estimatedAmount,
          bill.nextExpectedDate,
          daysBefore,
        );
        sent++;
      } catch (err) {
        this.logger.error(
          `Failed to send bill reminder for user=${bill.userId} bill=${bill.billId}`,
          err,
        );
      }
    }

    this.logger.log(`Bill reminders sent: ${sent}`);
  }

  // ── Budget Utilization ──────────────────────────────────────────
  /**
   * For each active budget, compute current spending versus limit.
   * Trigger alerts at 75%, 90%, and 100% thresholds. Only sends once
   * per threshold by checking existing notifications.
   */
  async checkBudgetUtilization() {
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
        const budgetName =
          budget.name ?? `Budget ${budget.id.slice(0, 8)}`;

        // Determine which thresholds have been crossed
        const thresholds = [75, 90, 100];

        for (const threshold of thresholds) {
          if (percentUsed < threshold) continue;

          // Check if we already sent an alert for this threshold+budget combo
          const alreadySent = await this.hasRecentAlert(
            budget.userId,
            budget.id,
            threshold,
          );

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
        this.logger.error(
          `Failed to check budget utilization for budget=${budget.id}`,
          err,
        );
      }
    }

    this.logger.log(`Budget alerts sent: ${sent}`);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Compute total spending for a budget in the current period.
   * Uses category-based transaction sums for the current month.
   */
  private async getSpentForBudget(
    budget: typeof schema.budgets.$inferSelect,
  ): Promise<number> {
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
