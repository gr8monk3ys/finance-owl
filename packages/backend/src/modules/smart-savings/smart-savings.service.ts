import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import {
  savingsRules,
  savingsTransfers,
  savingsAnalysis,
} from './smart-savings.schema';

@Injectable()
export class SmartSavingsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Analyze 3 months of transactions to determine spending patterns,
   * safe savings amount, and spending reduction opportunities.
   */
  async analyzeSpendingPatterns(userId: string) {
    const now = new Date();
    const threeMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      1,
    );
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Get monthly income and expenses over the past 3 months
    const monthlyData = await this.db
      .select({
        month: sql<string>`strftime('%Y-%m', ${schema.transactions.date})`.as(
          'month',
        ),
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
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(sql`strftime('%Y-%m', ${schema.transactions.date})`)
      .orderBy(sql`month`);

    const monthCount = monthlyData.length || 1;

    const totalIncome = monthlyData.reduce((sum, m) => sum + (m.income || 0), 0);
    const totalExpenses = monthlyData.reduce(
      (sum, m) => sum + (m.expenses || 0),
      0,
    );

    const averageMonthlyIncome =
      Math.round((totalIncome / monthCount) * 100) / 100;
    const averageMonthlyExpenses =
      Math.round((totalExpenses / monthCount) * 100) / 100;
    const averageSurplus =
      Math.round((averageMonthlyIncome - averageMonthlyExpenses) * 100) / 100;

    // Safe savings: 50% of average surplus, rounded down to nearest dollar
    const safeSavingsAmount =
      averageSurplus > 0 ? Math.floor((averageSurplus * 0.5) * 100) / 100 : 0;

    // Current savings rate
    const currentSavingsRate =
      averageMonthlyIncome > 0
        ? Math.round(
            (Math.max(0, averageSurplus) / averageMonthlyIncome) * 100 * 100,
          ) / 100
        : 0;

    // Recommended savings rate based on 50/30/20 rule: 20% of income
    const recommendedSavingsRate = 20;

    // Get category spending to identify reduction opportunities
    const categorySpending = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
        total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
        count: sql<number>`COUNT(*)`.as('count'),
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
          sql`${schema.transactions.amount} > 0`, // spending only
        ),
      )
      .groupBy(schema.transactions.categoryId)
      .orderBy(desc(sql`total`));

    // Calculate average spending per category
    const avgSpendPerCategory =
      categorySpending.length > 0
        ? totalExpenses / monthCount / categorySpending.length
        : 0;

    // Categories spending above average are reduction opportunities
    const spendingReductions = categorySpending
      .filter((cat) => {
        const monthlyAvg = cat.total / monthCount;
        return monthlyAvg > avgSpendPerCategory;
      })
      .map((cat) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName || 'Uncategorized',
        categoryColor: cat.categoryColor || '#71717a',
        categoryIcon: cat.categoryIcon,
        monthlyAverage: Math.round((cat.total / monthCount) * 100) / 100,
        overallAverage: Math.round(avgSpendPerCategory * 100) / 100,
        potentialSaving:
          Math.round(
            (cat.total / monthCount - avgSpendPerCategory) * 100,
          ) / 100,
      }));

    // Store the analysis
    const analysisDate = now.toISOString().split('T')[0];

    await this.db
      .insert(savingsAnalysis)
      .values({
        userId,
        averageMonthlyIncome,
        averageMonthlyExpenses,
        averageSurplus,
        recommendedSavingsRate,
        currentSavingsRate,
        analysisDate,
      });

    return {
      averageMonthlyIncome,
      averageMonthlyExpenses,
      averageSurplus,
      safeSavingsAmount,
      currentSavingsRate,
      recommendedSavingsRate,
      monthlyData,
      spendingReductions,
      analysisDate,
    };
  }

  /**
   * Get the most recent stored analysis for a user, or null.
   */
  async getLatestAnalysis(userId: string) {
    const [analysis] = await this.db
      .select()
      .from(savingsAnalysis)
      .where(eq(savingsAnalysis.userId, userId))
      .orderBy(desc(savingsAnalysis.createdAt))
      .limit(1);

    return analysis || null;
  }

  /**
   * Create a new savings rule.
   */
  async createRule(
    userId: string,
    data: {
      name: string;
      ruleType: string;
      amount?: number;
      roundUpTo?: number;
      sourceAccountId?: string;
      targetGoalId?: string;
    },
  ) {
    const [rule] = await this.db
      .insert(savingsRules)
      .values({
        userId,
        name: data.name,
        ruleType: data.ruleType,
        amount: data.amount,
        roundUpTo: data.roundUpTo,
        sourceAccountId: data.sourceAccountId,
        targetGoalId: data.targetGoalId,
      })
      .returning();

    return rule;
  }

  /**
   * List active savings rules for a user.
   */
  async getRules(userId: string) {
    return this.db
      .select()
      .from(savingsRules)
      .where(eq(savingsRules.userId, userId))
      .orderBy(desc(savingsRules.createdAt));
  }

  /**
   * Update a savings rule.
   */
  async updateRule(
    userId: string,
    ruleId: string,
    data: {
      name?: string;
      ruleType?: string;
      amount?: number;
      roundUpTo?: number;
      sourceAccountId?: string;
      targetGoalId?: string;
      isActive?: number;
    },
  ) {
    const [existing] = await this.db
      .select()
      .from(savingsRules)
      .where(
        and(eq(savingsRules.id, ruleId), eq(savingsRules.userId, userId)),
      )
      .limit(1);

    if (!existing) throw new NotFoundException('Savings rule not found');

    const [updated] = await this.db
      .update(savingsRules)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(savingsRules.id, ruleId), eq(savingsRules.userId, userId)),
      )
      .returning();

    return updated;
  }

  /**
   * Delete a savings rule.
   */
  async deleteRule(userId: string, ruleId: string) {
    const [existing] = await this.db
      .select()
      .from(savingsRules)
      .where(
        and(eq(savingsRules.id, ruleId), eq(savingsRules.userId, userId)),
      )
      .limit(1);

    if (!existing) throw new NotFoundException('Savings rule not found');

    await this.db
      .delete(savingsRules)
      .where(
        and(eq(savingsRules.id, ruleId), eq(savingsRules.userId, userId)),
      );
  }

  /**
   * Calculate the round-up savings for a given transaction amount.
   */
  calculateRoundUp(transactionAmount: number, roundUpTo: number): number {
    const absAmount = Math.abs(transactionAmount);
    const rounded = Math.ceil(absAmount / roundUpTo) * roundUpTo;
    return Math.round((rounded - absAmount) * 100) / 100;
  }

  /**
   * Calculate this month's surplus available for auto-save based on the surplus rule.
   */
  async calculateSurplusSavings(userId: string) {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];

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
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      );

    const income = monthData?.income || 0;
    const expenses = monthData?.expenses || 0;
    const surplus = income - expenses;

    // Get active surplus rules
    const [surplusRule] = await this.db
      .select()
      .from(savingsRules)
      .where(
        and(
          eq(savingsRules.userId, userId),
          eq(savingsRules.ruleType, 'surplus'),
          eq(savingsRules.isActive, 1),
        ),
      )
      .limit(1);

    if (!surplusRule || surplus <= 0) {
      return {
        currentMonthIncome: Math.round(income * 100) / 100,
        currentMonthExpenses: Math.round(expenses * 100) / 100,
        currentMonthSurplus: Math.round(surplus * 100) / 100,
        savingsAmount: 0,
        surplusPercentage: surplusRule?.amount || 50,
      };
    }

    const percentage = surplusRule.amount || 50;
    const savingsAmount = Math.floor(surplus * (percentage / 100) * 100) / 100;

    return {
      currentMonthIncome: Math.round(income * 100) / 100,
      currentMonthExpenses: Math.round(expenses * 100) / 100,
      currentMonthSurplus: Math.round(surplus * 100) / 100,
      savingsAmount,
      surplusPercentage: percentage,
    };
  }

  /**
   * Project savings over N months based on active rules.
   */
  async getProjectedSavings(userId: string, months: number = 12) {
    const rules = await this.db
      .select()
      .from(savingsRules)
      .where(
        and(eq(savingsRules.userId, userId), eq(savingsRules.isActive, 1)),
      );

    // Get average monthly transaction count and amounts for round-up estimates
    const now = new Date();
    const threeMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      1,
    );
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const [txStats] = await this.db
      .select({
        avgAmount:
          sql<number>`AVG(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE NULL END)`.as(
            'avg_amount',
          ),
        txCount: sql<number>`COUNT(*)`.as('tx_count'),
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
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      );

    const monthCount = 3;
    const avgMonthlyTxCount = (txStats?.txCount || 0) / monthCount;
    const avgTxAmount = txStats?.avgAmount || 0;
    const avgMonthlyIncome = (txStats?.income || 0) / monthCount;
    const avgMonthlyExpenses = (txStats?.expenses || 0) / monthCount;
    const avgMonthlySurplus = avgMonthlyIncome - avgMonthlyExpenses;

    // Calculate expected monthly savings from each rule
    let monthlyEstimate = 0;

    for (const rule of rules) {
      switch (rule.ruleType) {
        case 'round_up': {
          // Estimate round-up savings per transaction
          const roundUpTo = rule.roundUpTo || 1;
          // Average round-up is half the roundUpTo value
          const avgRoundUp = roundUpTo / 2;
          monthlyEstimate += avgRoundUp * avgMonthlyTxCount;
          break;
        }
        case 'percentage': {
          const pct = rule.amount || 0;
          monthlyEstimate += avgMonthlyIncome * (pct / 100);
          break;
        }
        case 'fixed': {
          monthlyEstimate += rule.amount || 0;
          break;
        }
        case 'surplus': {
          const surplusPct = rule.amount || 50;
          if (avgMonthlySurplus > 0) {
            monthlyEstimate += avgMonthlySurplus * (surplusPct / 100);
          }
          break;
        }
      }
    }

    monthlyEstimate = Math.round(monthlyEstimate * 100) / 100;

    // Build month-by-month projection
    const projection: { month: string; savings: number; cumulative: number }[] =
      [];
    let cumulative = 0;

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(
        now.getFullYear(),
        now.getMonth() + i,
        1,
      );
      const monthLabel = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
      cumulative += monthlyEstimate;

      projection.push({
        month: monthLabel,
        savings: monthlyEstimate,
        cumulative: Math.round(cumulative * 100) / 100,
      });
    }

    return {
      monthlyEstimate,
      activeRuleCount: rules.length,
      projection,
    };
  }

  /**
   * Get historical savings transfers.
   */
  async getSavingsHistory(userId: string, months: number = 6) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const startDate = cutoffDate.toISOString().split('T')[0];

    const transfers = await this.db
      .select({
        id: savingsTransfers.id,
        ruleId: savingsTransfers.ruleId,
        ruleName: savingsRules.name,
        ruleType: savingsRules.ruleType,
        amount: savingsTransfers.amount,
        calculatedFrom: savingsTransfers.calculatedFrom,
        status: savingsTransfers.status,
        createdAt: savingsTransfers.createdAt,
      })
      .from(savingsTransfers)
      .leftJoin(savingsRules, eq(savingsTransfers.ruleId, savingsRules.id))
      .where(
        and(
          eq(savingsTransfers.userId, userId),
          gte(savingsTransfers.createdAt, cutoffDate),
        ),
      )
      .orderBy(desc(savingsTransfers.createdAt));

    const totalSaved = transfers
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      transfers,
      totalSaved: Math.round(totalSaved * 100) / 100,
    };
  }

  /**
   * Get the full smart savings dashboard: analysis, rules, projections, history.
   */
  async getDashboard(userId: string) {
    const [analysis, rules, projected, history] = await Promise.all([
      this.getLatestAnalysis(userId),
      this.getRules(userId),
      this.getProjectedSavings(userId, 12),
      this.getSavingsHistory(userId, 6),
    ]);

    return {
      analysis,
      rules,
      projected,
      history,
    };
  }
}
