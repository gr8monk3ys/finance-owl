import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// ── Response interfaces ────────────────────────────────────────────

export interface CashFlowForecast {
  currentBalance: number;
  projectedDays: ProjectedDay[];
  summary: {
    totalProjectedIncome: number;
    totalProjectedExpenses: number;
    endingBalance: number;
    averageDailyNet: number;
  };
}

export interface ProjectedDay {
  date: string;
  projectedIncome: number;
  projectedExpenses: number;
  runningBalance: number;
}

export interface EndOfMonthProjection {
  currentBalance: number;
  projectedEndBalance: number;
  daysElapsed: number;
  daysRemaining: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  projectedMonthIncome: number;
  projectedMonthExpenses: number;
  dailyBurnRate: number;
  dailyIncomeRate: number;
}

export interface OverdraftRisk {
  atRisk: boolean;
  currentBalance: number;
  lowestProjectedBalance: number;
  lowestBalanceDate: string | null;
  daysUntilNegative: number | null;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface SavingsGoalProjection {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  monthlySavingsRate: number;
  monthsToGoal: number | null;
  projectedCompletionDate: string | null;
  onTrackForDeadline: boolean | null;
  requiredMonthlySavings: number | null;
}

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

@Injectable()
export class AnalyticsForecastingService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Projects daily cash flow for the specified number of days ahead
   * based on recurring income/expenses and current balance.
   */
  async forecastCashFlow(
    userId: string,
    daysAhead: number,
  ): Promise<CashFlowForecast> {
    const currentBalance = await this.getCurrentBalance(userId);
    const recurring = await this.getActiveRecurring(userId);

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Build a day-by-day projection
    const projectedDays: ProjectedDay[] = [];
    let balance = currentBalance;
    let totalProjectedIncome = 0;
    let totalProjectedExpenses = 0;

    for (let i = 1; i <= daysAhead; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      let dayIncome = 0;
      let dayExpenses = 0;

      for (const item of recurring) {
        if (isScheduledForDate(item.nextExpectedDate, item.frequency, dateStr)) {
          const amount = Math.abs(item.estimatedAmount);
          if (item.estimatedAmount < 0) {
            dayIncome += amount;
          } else {
            dayExpenses += amount;
          }
        }
      }

      balance = balance + dayIncome - dayExpenses;
      totalProjectedIncome += dayIncome;
      totalProjectedExpenses += dayExpenses;

      projectedDays.push({
        date: dateStr,
        projectedIncome: round2(dayIncome),
        projectedExpenses: round2(dayExpenses),
        runningBalance: round2(balance),
      });
    }

    return {
      currentBalance: round2(currentBalance),
      projectedDays,
      summary: {
        totalProjectedIncome: round2(totalProjectedIncome),
        totalProjectedExpenses: round2(totalProjectedExpenses),
        endingBalance: round2(balance),
        averageDailyNet:
          daysAhead > 0
            ? round2((totalProjectedIncome - totalProjectedExpenses) / daysAhead)
            : 0,
      },
    };
  }

  /**
   * Projects end-of-month balance based on current spending and income pace.
   */
  async predictEndOfMonthBalance(
    userId: string,
  ): Promise<EndOfMonthProjection> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().split('T')[0];
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const monthEnd = lastDayOfMonth.toISOString().split('T')[0];

    const daysInMonth = lastDayOfMonth.getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

    const currentBalance = await this.getCurrentBalance(userId);

    // Get actual income/expenses so far this month
    const [monthData] = await this.db
      .select({
        income:
          sql<number>`SUM(CASE WHEN ${schema.transactions.amount} < 0 THEN ABS(${schema.transactions.amount}) ELSE 0 END)`.as(
            'income',
          ),
        expenses:
          sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
            'expenses',
          ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, monthStart),
          lte(schema.transactions.date, today),
          eq(schema.transactions.pending, false),
        ),
      );

    const currentMonthIncome = Number(monthData?.income ?? 0);
    const currentMonthExpenses = Number(monthData?.expenses ?? 0);

    const dailyIncomeRate = currentMonthIncome / daysElapsed;
    const dailyBurnRate = currentMonthExpenses / daysElapsed;

    const projectedMonthIncome = round2(dailyIncomeRate * daysInMonth);
    const projectedMonthExpenses = round2(dailyBurnRate * daysInMonth);

    const remainingIncome = dailyIncomeRate * daysRemaining;
    const remainingExpenses = dailyBurnRate * daysRemaining;
    const projectedEndBalance = round2(
      currentBalance + remainingIncome - remainingExpenses,
    );

    return {
      currentBalance: round2(currentBalance),
      projectedEndBalance,
      daysElapsed,
      daysRemaining,
      currentMonthIncome: round2(currentMonthIncome),
      currentMonthExpenses: round2(currentMonthExpenses),
      projectedMonthIncome,
      projectedMonthExpenses,
      dailyBurnRate: round2(dailyBurnRate),
      dailyIncomeRate: round2(dailyIncomeRate),
    };
  }

  /**
   * Identifies overdraft risk by projecting daily balances forward.
   */
  async identifyOverdraftRisk(
    userId: string,
    daysAhead: number,
  ): Promise<OverdraftRisk> {
    const forecast = await this.forecastCashFlow(userId, daysAhead);

    let lowestBalance = forecast.currentBalance;
    let lowestBalanceDate: string | null = null;
    let daysUntilNegative: number | null = null;

    for (let i = 0; i < forecast.projectedDays.length; i++) {
      const day = forecast.projectedDays[i];
      if (day.runningBalance < lowestBalance) {
        lowestBalance = day.runningBalance;
        lowestBalanceDate = day.date;
      }
      if (day.runningBalance < 0 && daysUntilNegative === null) {
        daysUntilNegative = i + 1;
      }
    }

    const atRisk = lowestBalance < 0;
    let riskLevel: OverdraftRisk['riskLevel'];
    let recommendation: string;

    if (!atRisk) {
      if (lowestBalance < 100) {
        riskLevel = 'low';
        recommendation =
          'Your balance may dip below $100. Consider reducing discretionary spending or transferring funds.';
      } else {
        riskLevel = 'none';
        recommendation = 'Your projected balance stays positive throughout the forecast period.';
      }
    } else if (daysUntilNegative !== null && daysUntilNegative <= 7) {
      riskLevel = 'high';
      recommendation = `Your balance is projected to go negative within ${daysUntilNegative} days. Immediate action recommended: pause discretionary spending or arrange a transfer.`;
    } else if (daysUntilNegative !== null && daysUntilNegative <= 14) {
      riskLevel = 'medium';
      recommendation = `Your balance may go negative in about ${daysUntilNegative} days. Review upcoming expenses and consider delaying non-essential payments.`;
    } else {
      riskLevel = 'low';
      recommendation =
        'Your balance may go negative later in the forecast period. Monitor your spending pace.';
    }

    return {
      atRisk,
      currentBalance: round2(forecast.currentBalance),
      lowestProjectedBalance: round2(lowestBalance),
      lowestBalanceDate,
      daysUntilNegative,
      riskLevel,
      recommendation,
    };
  }

  /**
   * Projects time to reach a savings goal at the current savings rate.
   */
  async projectSavingsGoal(
    userId: string,
    goalId: string,
  ): Promise<SavingsGoalProjection> {
    // Fetch the goal
    const [goal] = await this.db
      .select()
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.id, goalId),
          eq(schema.savingsGoals.userId, userId),
        ),
      )
      .limit(1);

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

    // Calculate monthly savings rate from recent contributions (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString().split('T')[0];

    const [contribData] = await this.db
      .select({
        totalContributed: sql<number>`COALESCE(SUM(${schema.savingsContributions.amount}), 0)`.as(
          'total_contributed',
        ),
      })
      .from(schema.savingsContributions)
      .where(
        and(
          eq(schema.savingsContributions.goalId, goalId),
          gte(schema.savingsContributions.date, sinceDate),
        ),
      );

    const totalContributed = Number(contribData?.totalContributed ?? 0);
    // Convert 90-day total to monthly rate
    const monthlySavingsRate = round2((totalContributed / 90) * 30.44);

    let monthsToGoal: number | null = null;
    let projectedCompletionDate: string | null = null;

    if (remaining <= 0) {
      monthsToGoal = 0;
      projectedCompletionDate = new Date().toISOString().split('T')[0];
    } else if (monthlySavingsRate > 0) {
      monthsToGoal = Math.ceil(remaining / monthlySavingsRate);
      const completionDate = new Date();
      completionDate.setMonth(completionDate.getMonth() + monthsToGoal);
      projectedCompletionDate = completionDate.toISOString().split('T')[0];
    }

    // Determine if on track for deadline
    let onTrackForDeadline: boolean | null = null;
    let requiredMonthlySavings: number | null = null;

    if (goal.deadline && remaining > 0) {
      const deadlineDate = new Date(goal.deadline + 'T00:00:00');
      const now = new Date();
      const monthsUntilDeadline = Math.max(
        0,
        (deadlineDate.getFullYear() - now.getFullYear()) * 12 +
          (deadlineDate.getMonth() - now.getMonth()),
      );

      requiredMonthlySavings =
        monthsUntilDeadline > 0
          ? round2(remaining / monthsUntilDeadline)
          : round2(remaining);

      onTrackForDeadline = monthlySavingsRate >= requiredMonthlySavings;
    }

    return {
      goalId: goal.id,
      goalName: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      remaining: round2(remaining),
      monthlySavingsRate,
      monthsToGoal,
      projectedCompletionDate,
      onTrackForDeadline,
      requiredMonthlySavings,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async getCurrentBalance(userId: string): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.accounts.currentBalance}), 0)`.as('total'),
      })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.isHidden, false),
        ),
      );

    return Number(result?.total ?? 0);
  }

  private async getActiveRecurring(userId: string) {
    return this.db
      .select({
        name: schema.recurringTransactions.name,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );
  }
}

// ── Module-level helpers ──────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Determines if a recurring item would fire on a given date by projecting
 * forward from its next expected date using its frequency interval.
 */
function isScheduledForDate(
  nextExpectedDate: string | null,
  frequency: string,
  targetDate: string,
): boolean {
  if (!nextExpectedDate) return false;

  const intervalDays = FREQUENCY_DAYS[frequency];
  if (!intervalDays) return false;

  const target = new Date(targetDate + 'T00:00:00').getTime();
  const next = new Date(nextExpectedDate + 'T00:00:00').getTime();

  if (target < next) return false;

  const diffMs = target - next;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Allow a 1-day tolerance for monthly/quarterly/annual
  if (intervalDays >= 30) {
    return diffDays % intervalDays <= 1 || (intervalDays - (diffDays % intervalDays)) <= 1;
  }

  return diffDays % intervalDays === 0;
}
