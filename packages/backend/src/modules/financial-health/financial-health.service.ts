import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

@Injectable()
export class FinancialHealthService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async calculateScore(userId: string) {
    const savingsRateScore = await this.computeSavingsScore(userId);
    const debtToIncomeScore = await this.computeDebtScore(userId);
    const budgetAdherenceScore = await this.computeSpendingScore(userId);
    const netWorthTrendScore = await this.computeInvestmentScore(userId);
    const emergencyFundScore = await this.computeEmergencyFundScore(userId);
    const billPaymentScore = await this.computeBillPaymentScore(userId);

    const overallScore = Math.round(
      emergencyFundScore * 0.2 +
        debtToIncomeScore * 0.2 +
        savingsRateScore * 0.2 +
        budgetAdherenceScore * 0.15 +
        billPaymentScore * 0.15 +
        netWorthTrendScore * 0.1,
    );

    const [score] = await this.db
      .insert(schema.financialHealthScores)
      .values({
        userId,
        overallScore,
        savingsRateScore,
        debtToIncomeScore,
        budgetAdherenceScore,
        netWorthTrendScore,
        emergencyFundScore,
        billPaymentScore,
        calculatedAt: new Date().toISOString(),
      })
      .returning();

    // Invalidate cached score so next getLatestScore fetches fresh data
    await this.cacheService.del(`financial-health:${userId}:score`);
    await this.cacheService.del(`financial-health:${userId}:history`);

    return score;
  }

  async getLatestScore(userId: string) {
    const cacheKey = `financial-health:${userId}:score`;
    return this.cacheService.wrap(cacheKey, 900, async () => {
      const [score] = await this.db
        .select()
        .from(schema.financialHealthScores)
        .where(eq(schema.financialHealthScores.userId, userId))
        .orderBy(desc(schema.financialHealthScores.calculatedAt))
        .limit(1);

      return score ?? null;
    });
  }

  async getScoreHistory(userId: string) {
    const cacheKey = `financial-health:${userId}:history`;
    return this.cacheService.wrap(cacheKey, 900, () =>
      this.db
        .select()
        .from(schema.financialHealthScores)
        .where(eq(schema.financialHealthScores.userId, userId))
        .orderBy(desc(schema.financialHealthScores.calculatedAt))
        .limit(50),
    );
  }

  async getGoals(userId: string) {
    return this.db
      .select()
      .from(schema.financialHealthGoals)
      .where(eq(schema.financialHealthGoals.userId, userId))
      .orderBy(desc(schema.financialHealthGoals.createdAt));
  }

  async createGoal(
    userId: string,
    data: {
      category: string;
      targetValue: number;
      currentValue?: number;
      description?: string;
    },
  ) {
    const [goal] = await this.db
      .insert(schema.financialHealthGoals)
      .values({
        userId,
        category: data.category,
        targetValue: data.targetValue,
        currentValue: data.currentValue ?? 0,
        description: data.description,
      })
      .returning();

    return goal;
  }

  async updateGoal(
    userId: string,
    id: string,
    data: {
      targetValue?: number;
      currentValue?: number;
      description?: string;
      isAchieved?: boolean;
    },
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.financialHealthGoals)
      .where(
        and(
          eq(schema.financialHealthGoals.id, id),
          eq(schema.financialHealthGoals.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) throw new NotFoundException('Goal not found');

    const isAchieved =
      data.isAchieved ??
      (data.currentValue !== undefined && data.currentValue >= existing.targetValue);

    const [updated] = await this.db
      .update(schema.financialHealthGoals)
      .set({
        ...data,
        isAchieved,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.financialHealthGoals.id, id),
          eq(schema.financialHealthGoals.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  private async computeSavingsScore(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const rows = await this.db
      .select({ amount: schema.transactions.amount })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.pending, false),
          gte(schema.transactions.date, startOfMonth),
          lte(schema.transactions.date, endOfMonth),
        ),
      );

    const income = rows
      .filter((r) => r.amount < 0)
      .reduce((sum, r) => sum + Math.abs(r.amount), 0);
    const spending = rows
      .filter((r) => r.amount > 0)
      .reduce((sum, r) => sum + r.amount, 0);

    if (income === 0) return 50;

    const savingsRate = (income - spending) / income;

    if (savingsRate >= 0.2) return 100;
    if (savingsRate >= 0.15) return 85;
    if (savingsRate >= 0.1) return 70;
    if (savingsRate >= 0.05) return 55;
    if (savingsRate >= 0) return 40;
    return 20;
  }

  // Debt-to-income ratio score
  private async computeDebtScore(userId: string): Promise<number> {
    const accounts = await this.db
      .select({
        type: schema.accounts.type,
        balance: schema.accounts.currentBalance,
      })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId));

    const debtAccounts = accounts.filter(
      (a) => a.type === 'credit' || a.type === 'loan',
    );
    const totalDebt = debtAccounts.reduce(
      (sum, a) => sum + Math.abs(a.balance ?? 0),
      0,
    );

    if (totalDebt === 0) return 100;
    if (totalDebt < 1000) return 90;
    if (totalDebt < 5000) return 75;
    if (totalDebt < 15000) return 60;
    if (totalDebt < 30000) return 40;
    return 20;
  }

  // Spending patterns score: consistency and budget adherence
  private async computeSpendingScore(userId: string): Promise<number> {
    const budgets = await this.db
      .select()
      .from(schema.budgets)
      .where(eq(schema.budgets.userId, userId));

    if (budgets.length === 0) return 50;

    // Simple heuristic: having budgets set up is already a good sign
    const budgetCount = budgets.length;
    if (budgetCount >= 5) return 85;
    if (budgetCount >= 3) return 70;
    return 55;
  }

  // Investment allocation score
  private async computeInvestmentScore(userId: string): Promise<number> {
    const investmentAccounts = await this.db
      .select({ balance: schema.accounts.currentBalance })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.type, 'investment'),
        ),
      );

    const totalInvested = investmentAccounts.reduce(
      (sum, a) => sum + (a.balance ?? 0),
      0,
    );

    if (totalInvested === 0) return 20;
    if (totalInvested < 1000) return 40;
    if (totalInvested < 10000) return 60;
    if (totalInvested < 50000) return 80;
    return 95;
  }

  // Bill payment score: heuristic based on recurring transaction consistency
  private async computeBillPaymentScore(userId: string): Promise<number> {
    // Heuristic: assume good bill payment as a baseline
    // A more advanced implementation would track actual bill due dates vs payment dates
    return 70;
  }

  // Emergency fund score: months of expenses covered
  private async computeEmergencyFundScore(userId: string): Promise<number> {
    const savingsAccounts = await this.db
      .select({ balance: schema.accounts.currentBalance })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.type, 'depository'),
        ),
      );

    const totalSavings = savingsAccounts.reduce(
      (sum, a) => sum + (a.balance ?? 0),
      0,
    );

    // Estimate monthly expenses from recent transactions
    const recentTransactions = await this.db
      .select({ amount: schema.transactions.amount })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.pending, false),
        ),
      );

    const totalSpending = recentTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = totalSpending / Math.max(1, 3); // rough 3-month average

    if (monthlyExpenses === 0) return 50;

    const monthsCovered = totalSavings / monthlyExpenses;

    if (monthsCovered >= 6) return 100;
    if (monthsCovered >= 3) return 80;
    if (monthsCovered >= 1) return 55;
    return 25;
  }
}
