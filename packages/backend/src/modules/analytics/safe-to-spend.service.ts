import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface SafeToSpend {
  totalAvailable: number;
  upcomingBills: number;
  savingsAllocations: number;
  budgetRemaining: number;
  safeToSpend: number;
  daysLeftInMonth: number;
  dailyAllowance: number;
  lastCalculated: Date;
}

export interface DailyAllowance {
  safeToSpend: number;
  daysLeftInMonth: number;
  dailyAllowance: number;
  dailyBreakdown: Array<{
    date: string;
    allowance: number;
    cumulative: number;
  }>;
}

export interface AffordabilityCheck {
  amount: number;
  canAfford: boolean;
  safeToSpend: number;
  remainingAfterPurchase: number;
  dailyAllowanceAfter: number;
  daysLeftInMonth: number;
  impact: 'none' | 'low' | 'medium' | 'high' | 'over_budget';
  recommendation: string;
}

@Injectable()
export class SafeToSpendService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Calculate safe-to-spend: available cash - upcoming bills - savings allocations - budget commitments
   */
  async calculate(userId: string): Promise<SafeToSpend> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const today = now.toISOString().split('T')[0];
    const monthEnd = new Date(currentYear, currentMonth, 0);
    const endDate = monthEnd.toISOString().split('T')[0];
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    const daysLeftInMonth = Math.max(
      1,
      Math.ceil(
        (monthEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1,
    );

    // 1. Get total available cash across checking/savings accounts
    const totalAvailable = await this.getTotalAvailable(userId);

    // 2. Get upcoming bills for the rest of the month (recurring transactions not yet paid)
    const upcomingBills = await this.getUpcomingBills(userId, today, endDate);

    // 3. Get savings allocations (committed savings goal contributions)
    const savingsAllocations = await this.getSavingsAllocations(userId);

    // 4. Get remaining budget commitments
    const budgetRemaining = await this.getBudgetRemaining(
      userId,
      monthStart,
      today,
    );

    // Calculate safe-to-spend
    const safeToSpend = Math.max(
      0,
      totalAvailable - upcomingBills - savingsAllocations - budgetRemaining,
    );

    const dailyAllowance =
      daysLeftInMonth > 0
        ? Math.round((safeToSpend / daysLeftInMonth) * 100) / 100
        : 0;

    return {
      totalAvailable: Math.round(totalAvailable * 100) / 100,
      upcomingBills: Math.round(upcomingBills * 100) / 100,
      savingsAllocations: Math.round(savingsAllocations * 100) / 100,
      budgetRemaining: Math.round(budgetRemaining * 100) / 100,
      safeToSpend: Math.round(safeToSpend * 100) / 100,
      daysLeftInMonth,
      dailyAllowance,
      lastCalculated: now,
    };
  }

  /**
   * Daily breakdown for the rest of the month
   */
  async getDailyAllowance(userId: string): Promise<DailyAllowance> {
    const result = await this.calculate(userId);
    const { safeToSpend, daysLeftInMonth, dailyAllowance } = result;

    const now = new Date();
    const dailyBreakdown: DailyAllowance['dailyBreakdown'] = [];

    for (let i = 0; i < daysLeftInMonth; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const cumulative =
        Math.round(dailyAllowance * (i + 1) * 100) / 100;

      dailyBreakdown.push({
        date: dateStr,
        allowance: dailyAllowance,
        cumulative,
      });
    }

    return {
      safeToSpend,
      daysLeftInMonth,
      dailyAllowance,
      dailyBreakdown,
    };
  }

  /**
   * What-if calculator: "Can I afford this $X purchase?"
   */
  async canIAfford(
    userId: string,
    amount: number,
  ): Promise<AffordabilityCheck> {
    const result = await this.calculate(userId);
    const { safeToSpend, daysLeftInMonth } = result;

    const remainingAfterPurchase = safeToSpend - amount;
    const canAfford = remainingAfterPurchase >= 0;

    const dailyAllowanceAfter =
      daysLeftInMonth > 0
        ? Math.round(
            (Math.max(0, remainingAfterPurchase) / daysLeftInMonth) * 100,
          ) / 100
        : 0;

    // Determine impact level
    let impact: AffordabilityCheck['impact'];
    let recommendation: string;

    if (amount <= 0) {
      impact = 'none';
      recommendation = 'Please enter a positive amount.';
    } else if (!canAfford) {
      impact = 'over_budget';
      recommendation = `This purchase exceeds your safe-to-spend by ${formatCurrency(Math.abs(remainingAfterPurchase))}. Consider waiting or adjusting your budget.`;
    } else {
      const ratio = amount / safeToSpend;
      if (ratio <= 0.1) {
        impact = 'low';
        recommendation = `Go for it! This is only ${(ratio * 100).toFixed(0)}% of your safe-to-spend amount.`;
      } else if (ratio <= 0.3) {
        impact = 'low';
        recommendation = `This is a manageable purchase at ${(ratio * 100).toFixed(0)}% of your safe-to-spend. You would still have ${formatCurrency(remainingAfterPurchase)} left.`;
      } else if (ratio <= 0.6) {
        impact = 'medium';
        recommendation = `This is a significant purchase at ${(ratio * 100).toFixed(0)}% of your safe-to-spend. Your daily allowance would drop to ${formatCurrency(dailyAllowanceAfter)}/day.`;
      } else {
        impact = 'high';
        recommendation = `This would use ${(ratio * 100).toFixed(0)}% of your safe-to-spend. Consider splitting this across months or finding savings elsewhere.`;
      }
    }

    return {
      amount: Math.round(amount * 100) / 100,
      canAfford,
      safeToSpend: Math.round(safeToSpend * 100) / 100,
      remainingAfterPurchase: Math.round(remainingAfterPurchase * 100) / 100,
      dailyAllowanceAfter,
      daysLeftInMonth,
      impact,
      recommendation,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private async getTotalAvailable(userId: string): Promise<number> {
    const accounts = await this.db
      .select({
        balance: schema.accounts.currentBalance,
        type: schema.accounts.type,
      })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.isHidden, false),
        ),
      );

    let total = 0;
    for (const acct of accounts) {
      // Only count checking and savings balances as "available"
      if (['checking', 'savings'].includes(acct.type)) {
        total += acct.balance ?? 0;
      }
    }
    return total;
  }

  private async getUpcomingBills(
    userId: string,
    todayStr: string,
    endDateStr: string,
  ): Promise<number> {
    const rows = await this.db
      .select({
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
          gte(schema.recurringTransactions.nextExpectedDate, todayStr),
          lte(schema.recurringTransactions.nextExpectedDate, endDateStr),
        ),
      );

    return rows.reduce((sum, r) => sum + Math.abs(r.estimatedAmount), 0);
  }

  private async getSavingsAllocations(userId: string): Promise<number> {
    // Get active savings goals with remaining amounts and monthly contribution estimates
    const goals = await this.db
      .select({
        targetAmount: schema.savingsGoals.targetAmount,
        currentAmount: schema.savingsGoals.currentAmount,
        deadline: schema.savingsGoals.deadline,
        isCompleted: schema.savingsGoals.isCompleted,
      })
      .from(schema.savingsGoals)
      .where(
        and(
          eq(schema.savingsGoals.userId, userId),
          eq(schema.savingsGoals.isCompleted, false),
        ),
      );

    const now = new Date();
    let monthlyAllocation = 0;

    for (const goal of goals) {
      const remaining = goal.targetAmount - goal.currentAmount;
      if (remaining <= 0) continue;

      if (goal.deadline) {
        const deadlineDate = new Date(goal.deadline + 'T00:00:00');
        const monthsLeft = Math.max(
          1,
          (deadlineDate.getFullYear() - now.getFullYear()) * 12 +
            (deadlineDate.getMonth() - now.getMonth()),
        );
        monthlyAllocation += remaining / monthsLeft;
      } else {
        // If no deadline, assume a 12-month horizon
        monthlyAllocation += remaining / 12;
      }
    }

    return monthlyAllocation;
  }

  private async getBudgetRemaining(
    userId: string,
    monthStart: string,
    todayStr: string,
  ): Promise<number> {
    // Get budgets and what has been spent this month
    const budgetsData = await this.db
      .select({
        budgetId: schema.budgets.id,
        budgetAmount: schema.budgets.amount,
        categoryId: schema.budgets.categoryId,
      })
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId));

    if (budgetsData.length === 0) return 0;

    // Get spending this month per category
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
          gte(schema.transactions.date, monthStart),
          lte(schema.transactions.date, todayStr),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(schema.transactions.categoryId);

    const spendingMap = new Map<string | null, number>();
    for (const row of spending) {
      spendingMap.set(row.categoryId, row.total);
    }

    let totalRemaining = 0;
    for (const budget of budgetsData) {
      const spent = spendingMap.get(budget.categoryId) ?? 0;
      const remaining = Math.max(0, budget.budgetAmount - spent);
      totalRemaining += remaining;
    }

    return totalRemaining;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
