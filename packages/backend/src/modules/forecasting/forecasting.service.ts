import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

export interface ForecastMonth {
  month: string;
  projectedIncome: number;
  projectedExpenses: number;
  projectedBalance: number;
}

export interface ForecastResult {
  currentBalance: number;
  months: ForecastMonth[];
}

export interface CashFlowSummary {
  monthlyRecurringIncome: number;
  monthlyRecurringExpenses: number;
  netMonthlyCashFlow: number;
  incomeItems: { name: string; amount: number; frequency: string; monthlyAmount: number }[];
  expenseItems: { name: string; amount: number; frequency: string; monthlyAmount: number }[];
}

@Injectable()
export class ForecastingService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getForecast(
    userId: string,
    options: { months: number },
  ): Promise<ForecastResult> {
    // Get current total balance across all non-hidden accounts
    const [balanceResult] = await this.db
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

    const currentBalance = balanceResult?.total ?? 0;

    // Get recurring transactions
    const recurring = await this.db
      .select({
        name: schema.recurringTransactions.name,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    // Calculate monthly recurring income and expenses
    let monthlyRecurringIncome = 0;
    let monthlyRecurringExpenses = 0;

    for (const item of recurring) {
      const multiplier = FREQUENCY_MONTHLY_MULTIPLIER[item.frequency] ?? 1;
      const monthlyAmount = Math.abs(item.estimatedAmount) * multiplier;

      if (item.estimatedAmount < 0) {
        // Negative amounts = income (same convention as transactions)
        monthlyRecurringIncome += monthlyAmount;
      } else {
        // Positive amounts = expenses
        monthlyRecurringExpenses += monthlyAmount;
      }
    }

    // Also consider budget amounts for non-recurring expense categories
    const budgets = await this.db
      .select({
        amount: schema.budgets.amount,
        period: schema.budgets.period,
        categoryId: schema.budgets.categoryId,
      })
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId));

    // Get category IDs already covered by recurring transactions
    const recurringCategoryIds = new Set(
      (
        await this.db
          .select({ categoryId: schema.recurringTransactions.categoryId })
          .from(schema.recurringTransactions)
          .where(
            and(
              eq(schema.recurringTransactions.userId, userId),
              eq(schema.recurringTransactions.isActive, true),
            ),
          )
      )
        .map((r) => r.categoryId)
        .filter(Boolean),
    );

    for (const budget of budgets) {
      if (recurringCategoryIds.has(budget.categoryId)) {
        continue; // Already accounted for via recurring transactions
      }
      const periodMultiplier = FREQUENCY_MONTHLY_MULTIPLIER[budget.period] ?? 1;
      monthlyRecurringExpenses += budget.amount * periodMultiplier;
    }

    // Project balance forward month by month
    const months: ForecastMonth[] = [];
    let balance = currentBalance;
    const now = new Date();

    for (let i = 1; i <= options.months; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

      // For assets: income increases balance, expenses decrease it
      // Balance convention: positive balance = assets
      balance = balance + monthlyRecurringIncome - monthlyRecurringExpenses;

      months.push({
        month: monthLabel,
        projectedIncome: Math.round(monthlyRecurringIncome * 100) / 100,
        projectedExpenses: Math.round(monthlyRecurringExpenses * 100) / 100,
        projectedBalance: Math.round(balance * 100) / 100,
      });
    }

    return {
      currentBalance: Math.round(currentBalance * 100) / 100,
      months,
    };
  }

  async getRecurringCashFlow(userId: string): Promise<CashFlowSummary> {
    const recurring = await this.db
      .select({
        name: schema.recurringTransactions.name,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    const incomeItems: CashFlowSummary['incomeItems'] = [];
    const expenseItems: CashFlowSummary['expenseItems'] = [];

    for (const item of recurring) {
      const multiplier = FREQUENCY_MONTHLY_MULTIPLIER[item.frequency] ?? 1;
      const monthlyAmount = Math.abs(item.estimatedAmount) * multiplier;

      const entry = {
        name: item.name,
        amount: Math.abs(item.estimatedAmount),
        frequency: item.frequency,
        monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      };

      if (item.estimatedAmount < 0) {
        incomeItems.push(entry);
      } else {
        expenseItems.push(entry);
      }
    }

    const monthlyRecurringIncome = incomeItems.reduce(
      (sum, i) => sum + i.monthlyAmount,
      0,
    );
    const monthlyRecurringExpenses = expenseItems.reduce(
      (sum, i) => sum + i.monthlyAmount,
      0,
    );

    return {
      monthlyRecurringIncome: Math.round(monthlyRecurringIncome * 100) / 100,
      monthlyRecurringExpenses:
        Math.round(monthlyRecurringExpenses * 100) / 100,
      netMonthlyCashFlow:
        Math.round((monthlyRecurringIncome - monthlyRecurringExpenses) * 100) /
        100,
      incomeItems,
      expenseItems,
    };
  }
}
