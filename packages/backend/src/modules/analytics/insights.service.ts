import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// ── Types ──────────────────────────────────────────────────────────

export type InsightType =
  | 'spending_spike'
  | 'spending_decrease'
  | 'unused_subscription'
  | 'savings_projection'
  | 'budget_trend'
  | 'recurring_change';

export type InsightSeverity = 'info' | 'warning';

export interface Insight {
  type: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  data: Record<string, unknown>;
  recommendation: string;
}

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

@Injectable()
export class InsightsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Generates an array of actionable insights personalized to the user's
   * actual spending and savings patterns.
   */
  async generateInsights(userId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    const [
      spendingInsights,
      subscriptionInsights,
      savingsInsights,
      budgetInsights,
      recurringInsights,
    ] = await Promise.all([
      this.detectSpendingChanges(userId),
      this.detectUnusedSubscriptions(userId),
      this.generateSavingsProjections(userId),
      this.analyzeBudgetTrends(userId),
      this.detectRecurringChanges(userId),
    ]);

    insights.push(
      ...spendingInsights,
      ...subscriptionInsights,
      ...savingsInsights,
      ...budgetInsights,
      ...recurringInsights,
    );

    // Sort by severity (warnings first) then by type
    insights.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'warning' ? -1 : 1;
      }
      return a.type.localeCompare(b.type);
    });

    return insights;
  }

  // ── Spending spikes and decreases ──────────────────────────────

  private async detectSpendingChanges(userId: string): Promise<Insight[]> {
    const insights: Insight[] = [];
    const now = new Date();

    // Current month range
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];

    // Previous month range
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonthEnd = new Date(
      prevMonth.getFullYear(),
      prevMonth.getMonth() + 1,
      0,
    )
      .toISOString()
      .split('T')[0];

    // Get per-category spending for current partial month and full prior month
    const [currentSpending, prevSpending] = await Promise.all([
      this.getCategorySpending(userId, currentMonthStart, today),
      this.getCategorySpending(userId, prevMonthStart, prevMonthEnd),
    ]);

    // Scale current month spending to full-month projection
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const scaleFactor = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    const prevMap = new Map(prevSpending.map((r) => [r.categoryId, r]));

    for (const current of currentSpending) {
      const prev = prevMap.get(current.categoryId);
      const projectedTotal = Number(current.total) * scaleFactor;
      const prevTotal = prev ? Number(prev.total) : 0;

      if (prevTotal === 0) continue;

      const changePercent = ((projectedTotal - prevTotal) / prevTotal) * 100;

      if (changePercent > 30 && projectedTotal > 50) {
        insights.push({
          type: 'spending_spike',
          title: `${current.categoryName || 'Uncategorized'} spending up ${Math.round(changePercent)}%`,
          description: `You're on pace to spend $${round2(projectedTotal)} on ${current.categoryName || 'uncategorized items'} this month, compared to $${round2(prevTotal)} last month.`,
          severity: changePercent > 50 ? 'warning' : 'info',
          data: {
            categoryId: current.categoryId,
            categoryName: current.categoryName,
            projectedTotal: round2(projectedTotal),
            previousTotal: round2(prevTotal),
            changePercent: round2(changePercent),
          },
          recommendation: `Review your ${current.categoryName || 'uncategorized'} transactions to see if the increase is intentional. Consider setting a budget alert.`,
        });
      } else if (changePercent < -30 && prevTotal > 50) {
        insights.push({
          type: 'spending_decrease',
          title: `${current.categoryName || 'Uncategorized'} spending down ${Math.round(Math.abs(changePercent))}%`,
          description: `You're on pace to spend $${round2(projectedTotal)} on ${current.categoryName || 'uncategorized items'} this month, down from $${round2(prevTotal)} last month.`,
          severity: 'info',
          data: {
            categoryId: current.categoryId,
            categoryName: current.categoryName,
            projectedTotal: round2(projectedTotal),
            previousTotal: round2(prevTotal),
            changePercent: round2(changePercent),
          },
          recommendation: `Great job reducing spending in this category! Consider redirecting the savings toward a financial goal.`,
        });
      }
    }

    return insights;
  }

  // ── Unused subscriptions ──────────────────────────────────────

  private async detectUnusedSubscriptions(
    userId: string,
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Get active recurring expenses (positive amount = expense)
    const subscriptions = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
          sql`${schema.recurringTransactions.estimatedAmount} > 0`,
        ),
      );

    // For each subscription, check if there have been recent matching transactions
    // (within the last 60 days). If not, it may be unused or auto-renewing without use.
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const cutoffDate = sixtyDaysAgo.toISOString().split('T')[0];

    for (const sub of subscriptions) {
      const merchantKey = sub.merchantName ?? sub.name;

      const [recent] = await this.db
        .select({
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            gte(schema.transactions.date, cutoffDate),
            sql`LOWER(COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})) = LOWER(${merchantKey})`,
          ),
        );

      if (Number(recent?.count ?? 0) === 0) {
        const monthlyMultiplier =
          FREQUENCY_MONTHLY_MULTIPLIER[sub.frequency] ?? 1;
        const monthlyCost = round2(sub.estimatedAmount * monthlyMultiplier);
        const annualCost = round2(monthlyCost * 12);

        insights.push({
          type: 'unused_subscription',
          title: `No recent activity for ${sub.name}`,
          description: `You haven't had a transaction from ${sub.name} in over 60 days, but it costs $${monthlyCost}/month ($${annualCost}/year).`,
          severity: 'warning',
          data: {
            subscriptionId: sub.id,
            name: sub.name,
            merchantName: sub.merchantName,
            monthlyCost,
            annualCost,
            frequency: sub.frequency,
            lastExpectedDate: sub.nextExpectedDate,
          },
          recommendation: `Review whether you still use ${sub.name}. Cancelling could save you $${annualCost} per year.`,
        });
      }
    }

    return insights;
  }

  // ── Savings projections ──────────────────────────────────────

  private async generateSavingsProjections(
    userId: string,
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    const goals = await this.db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.userId, userId),
          eq(schema.savingsGoals.isCompleted, false),
        ),
      );

    for (const goal of goals) {
      const remaining = goal.targetAmount - goal.currentAmount;
      if (remaining <= 0) continue;

      const progress = (goal.currentAmount / goal.targetAmount) * 100;

      // Compute recent contribution rate (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const sinceDate = ninetyDaysAgo.toISOString().split('T')[0];

      const [contribData] = await this.db
        .select({
          total: sql<number>`COALESCE(SUM(${schema.savingsContributions.amount}), 0)`.as(
            'total',
          ),
        })
        .from(schema.savingsContributions)
        .where(
          and(
            eq(schema.savingsContributions.goalId, goal.id),
            gte(schema.savingsContributions.date, sinceDate),
          ),
        );

      const monthlyRate = round2((Number(contribData?.total ?? 0) / 90) * 30.44);

      if (monthlyRate <= 0) {
        insights.push({
          type: 'savings_projection',
          title: `No recent progress on "${goal.name}"`,
          description: `You haven't contributed to "${goal.name}" in the last 90 days. You still need $${round2(remaining)} to reach your $${goal.targetAmount} goal.`,
          severity: 'warning',
          data: {
            goalId: goal.id,
            goalName: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            remaining: round2(remaining),
            progress: round2(progress),
            monthlyRate: 0,
          },
          recommendation: `Set up a recurring transfer to make steady progress. Even $${Math.ceil(remaining / 12)}/month would get you there in about a year.`,
        });
        continue;
      }

      const monthsToGoal = Math.ceil(remaining / monthlyRate);

      if (goal.deadline) {
        const deadlineDate = new Date(goal.deadline + 'T00:00:00');
        const now = new Date();
        const monthsUntilDeadline = Math.max(
          0,
          (deadlineDate.getFullYear() - now.getFullYear()) * 12 +
            (deadlineDate.getMonth() - now.getMonth()),
        );

        if (monthsToGoal > monthsUntilDeadline) {
          const requiredMonthly = round2(
            monthsUntilDeadline > 0 ? remaining / monthsUntilDeadline : remaining,
          );
          insights.push({
            type: 'savings_projection',
            title: `"${goal.name}" falling behind schedule`,
            description: `At your current rate of $${monthlyRate}/month, you'll reach your goal in ${monthsToGoal} months, but your deadline is in ${monthsUntilDeadline} months.`,
            severity: 'warning',
            data: {
              goalId: goal.id,
              goalName: goal.name,
              monthlyRate,
              monthsToGoal,
              monthsUntilDeadline,
              requiredMonthly,
              shortfall: round2(requiredMonthly - monthlyRate),
            },
            recommendation: `Increase your monthly contribution to $${requiredMonthly} to meet your deadline.`,
          });
        } else {
          insights.push({
            type: 'savings_projection',
            title: `"${goal.name}" is on track`,
            description: `At $${monthlyRate}/month, you'll reach your $${goal.targetAmount} goal in about ${monthsToGoal} months, well before your deadline.`,
            severity: 'info',
            data: {
              goalId: goal.id,
              goalName: goal.name,
              monthlyRate,
              monthsToGoal,
              monthsUntilDeadline,
              progress: round2(progress),
            },
            recommendation: `Keep it up! You're ${round2(progress)}% of the way to your goal.`,
          });
        }
      } else {
        insights.push({
          type: 'savings_projection',
          title: `"${goal.name}" projected completion in ${monthsToGoal} months`,
          description: `At your current rate of $${monthlyRate}/month, you'll reach your $${goal.targetAmount} goal in about ${monthsToGoal} months.`,
          severity: 'info',
          data: {
            goalId: goal.id,
            goalName: goal.name,
            monthlyRate,
            monthsToGoal,
            progress: round2(progress),
          },
          recommendation: `You're ${round2(progress)}% there. Setting a deadline can help keep you motivated.`,
        });
      }
    }

    return insights;
  }

  // ── Budget trends ────────────────────────────────────────────

  private async analyzeBudgetTrends(userId: string): Promise<Insight[]> {
    const insights: Insight[] = [];
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];

    const budgets = await this.db
      .select({
        id: schema.budgets.id,
        name: schema.budgets.name,
        categoryId: schema.budgets.categoryId,
        amount: schema.budgets.amount,
        period: schema.budgets.period,
        categoryName: schema.categories.name,
      })
      .from(schema.budgets)
      .leftJoin(
        schema.categories,
        eq(schema.budgets.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.budgets.userId, userId),
          eq(schema.budgets.isActive, true),
        ),
      );

    if (budgets.length === 0) return insights;

    // Get current month spending per category
    const spending = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        total:
          sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
            'total',
          ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, currentMonthStart),
          lte(schema.transactions.date, today),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(schema.transactions.categoryId);

    const spendingMap = new Map(
      spending.map((r) => [r.categoryId, Number(r.total)]),
    );

    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();

    for (const budget of budgets) {
      const spent = spendingMap.get(budget.categoryId) ?? 0;
      const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      const expectedPercent = (dayOfMonth / daysInMonth) * 100;
      const budgetLabel =
        budget.name || budget.categoryName || 'Unknown budget';

      // Over-pacing: spent a higher percentage than the elapsed percentage of the month
      if (percentUsed > expectedPercent + 20 && percentUsed > 50) {
        const projectedTotal = round2(
          (spent / dayOfMonth) * daysInMonth,
        );
        const overBy = round2(projectedTotal - budget.amount);

        insights.push({
          type: 'budget_trend',
          title: `${budgetLabel} budget is over-pacing`,
          description: `You've used ${round2(percentUsed)}% of your $${budget.amount} ${budgetLabel} budget, but only ${round2(expectedPercent)}% of the month has passed. Projected overspend: $${overBy}.`,
          severity: 'warning',
          data: {
            budgetId: budget.id,
            budgetName: budgetLabel,
            budgetAmount: budget.amount,
            spent: round2(spent),
            percentUsed: round2(percentUsed),
            expectedPercent: round2(expectedPercent),
            projectedTotal,
            projectedOverspend: overBy,
          },
          recommendation: `Try to limit ${budgetLabel} spending to $${round2((budget.amount - spent) / Math.max(1, daysInMonth - dayOfMonth))}/day for the rest of the month.`,
        });
      } else if (
        percentUsed < expectedPercent - 30 &&
        budget.amount > 50 &&
        dayOfMonth > 10
      ) {
        insights.push({
          type: 'budget_trend',
          title: `${budgetLabel} budget is under-pacing`,
          description: `You've only used ${round2(percentUsed)}% of your $${budget.amount} ${budgetLabel} budget at ${round2(expectedPercent)}% through the month.`,
          severity: 'info',
          data: {
            budgetId: budget.id,
            budgetName: budgetLabel,
            budgetAmount: budget.amount,
            spent: round2(spent),
            percentUsed: round2(percentUsed),
            expectedPercent: round2(expectedPercent),
            remaining: round2(budget.amount - spent),
          },
          recommendation: `You have $${round2(budget.amount - spent)} left in this budget. Consider moving surplus to savings.`,
        });
      }
    }

    return insights;
  }

  // ── Recurring transaction changes ────────────────────────────

  private async detectRecurringChanges(userId: string): Promise<Insight[]> {
    const insights: Insight[] = [];

    const recurring = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    for (const item of recurring) {
      const merchantKey = item.merchantName ?? item.name;

      // Get the two most recent transactions from this merchant
      const recentTxns = await this.db
        .select({
          amount: schema.transactions.amount,
          date: schema.transactions.date,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`LOWER(COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})) = LOWER(${merchantKey})`,
            eq(schema.transactions.pending, false),
          ),
        )
        .orderBy(desc(schema.transactions.date))
        .limit(2);

      if (recentTxns.length < 2) continue;

      const latestAmount = Math.abs(Number(recentTxns[0].amount));
      const previousAmount = Math.abs(Number(recentTxns[1].amount));

      if (previousAmount === 0) continue;

      const changePercent =
        ((latestAmount - previousAmount) / previousAmount) * 100;

      if (Math.abs(changePercent) > 15) {
        const direction = changePercent > 0 ? 'increased' : 'decreased';
        const severity: InsightSeverity = changePercent > 0 ? 'warning' : 'info';

        insights.push({
          type: 'recurring_change',
          title: `${item.name} charge ${direction} by ${Math.round(Math.abs(changePercent))}%`,
          description: `Your latest ${item.name} charge was $${round2(latestAmount)}, ${direction} from $${round2(previousAmount)} (${round2(changePercent)}% change).`,
          severity,
          data: {
            recurringId: item.id,
            name: item.name,
            merchantName: item.merchantName,
            latestAmount: round2(latestAmount),
            previousAmount: round2(previousAmount),
            changePercent: round2(changePercent),
            latestDate: recentTxns[0].date,
          },
          recommendation:
            changePercent > 0
              ? `Check if ${item.name} raised their prices. Contact them if this wasn't expected.`
              : `${item.name} charged less this time. This could be a promotion or plan change.`,
        });
      }
    }

    return insights;
  }

  // ── Shared helpers ──────────────────────────────────────────

  private async getCategorySpending(
    userId: string,
    startDate: string,
    endDate: string,
  ) {
    return this.db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        total: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
          'total',
        ),
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(schema.transactions.categoryId, schema.categories.name);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
