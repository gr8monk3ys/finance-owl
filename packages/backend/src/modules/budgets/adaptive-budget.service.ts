import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { OllamaClient } from '../ai/ollama.client';
import * as schema from '../../database/schema';

// ── Types ──────────────────────────────────────────────────────────────

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  suggestedAmount: number;
  averageSpending: number;
  medianSpending: number;
  maxSpending: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface SeasonalPattern {
  categoryName: string;
  pattern: string;
  affectedMonths: number[];
  averageIncrease: number;
  recommendation: string;
}

export interface AdjustmentResult {
  budgetId: string;
  categoryName: string;
  previousAmount: number;
  newAmount: number;
  changePercent: number;
  reason: string;
}

export interface BudgetInsight {
  type:
    | 'under_budget'
    | 'over_budget'
    | 'trending_up'
    | 'trending_down'
    | 'seasonal_alert'
    | 'savings_opportunity';
  title: string;
  description: string;
  categoryName?: string;
  amount?: number;
  severity: 'info' | 'warning' | 'success';
}

export interface CategoryPrediction {
  categoryId: string;
  categoryName: string;
  predictedAmount: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  monthOverMonthChange: number;
}

// Internal helper types
interface MonthlySpending {
  month: string; // YYYY-MM
  total: number;
}

interface CategoryMonthlyData {
  categoryId: string;
  categoryName: string;
  months: MonthlySpending[];
}

// ── Service ────────────────────────────────────────────────────────────

@Injectable()
export class AdaptiveBudgetService {
  private readonly logger = new Logger(AdaptiveBudgetService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly ollamaClient: OllamaClient,
  ) {}

  // ── Public Methods ─────────────────────────────────────────────────

  /**
   * Analyze 3-month spending history per category and suggest realistic budget limits.
   */
  async suggestBudgets(userId: string): Promise<BudgetSuggestion[]> {
    const categoryData = await this.getCategorySpendingHistory(userId, 3);

    if (categoryData.length === 0) {
      return [];
    }

    const suggestions: BudgetSuggestion[] = [];

    for (const cat of categoryData) {
      if (cat.months.length === 0) continue;

      const totals = cat.months.map((m) => m.total);
      const avg = this.average(totals);
      const median = this.median(totals);
      const max = Math.max(...totals);
      const stdDev = this.standardDeviation(totals);

      // Confidence is based on data consistency
      const coefficientOfVariation = avg > 0 ? stdDev / avg : 1;
      const confidence: 'high' | 'medium' | 'low' =
        cat.months.length >= 3 && coefficientOfVariation < 0.2
          ? 'high'
          : cat.months.length >= 2 && coefficientOfVariation < 0.5
            ? 'medium'
            : 'low';

      // Suggest based on data distribution:
      // - Use median + 10% buffer for high confidence (stable spending)
      // - Use average + 15% buffer for medium confidence
      // - Use max of avg and median + 20% buffer for low confidence
      let suggestedAmount: number;
      let reasoning: string;

      if (confidence === 'high') {
        suggestedAmount = Math.ceil(median * 1.1);
        reasoning = `Based on consistent spending of ~$${median.toFixed(0)}/month over ${cat.months.length} months. Added 10% buffer.`;
      } else if (confidence === 'medium') {
        suggestedAmount = Math.ceil(avg * 1.15);
        reasoning = `Based on average spending of ~$${avg.toFixed(0)}/month with moderate variation. Added 15% buffer.`;
      } else {
        suggestedAmount = Math.ceil(Math.max(avg, median) * 1.2);
        reasoning = `Limited or highly variable spending data. Using conservative estimate with 20% buffer.`;
      }

      // Round to nearest $5 for cleaner numbers
      suggestedAmount = Math.ceil(suggestedAmount / 5) * 5;

      suggestions.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        suggestedAmount,
        averageSpending: Math.round(avg * 100) / 100,
        medianSpending: Math.round(median * 100) / 100,
        maxSpending: Math.round(max * 100) / 100,
        confidence,
        reasoning,
      });
    }

    // Try to enhance reasoning with AI if available
    await this.enrichSuggestionsWithAI(suggestions);

    return suggestions.sort((a, b) => b.averageSpending - a.averageSpending);
  }

  /**
   * Detect seasonal spending patterns (holidays, summer, back-to-school, etc).
   */
  async detectSeasonalPatterns(userId: string): Promise<SeasonalPattern[]> {
    // Need at least 6 months of data to detect seasonal patterns
    const categoryData = await this.getCategorySpendingHistory(userId, 12);
    const patterns: SeasonalPattern[] = [];

    for (const cat of categoryData) {
      if (cat.months.length < 6) continue;

      const totals = cat.months.map((m) => m.total);
      const overallAvg = this.average(totals);
      if (overallAvg === 0) continue;

      // Group spending by calendar month
      const byCalendarMonth: Record<number, number[]> = {};
      for (const m of cat.months) {
        const monthNum = parseInt(m.month.split('-')[1], 10);
        if (!byCalendarMonth[monthNum]) byCalendarMonth[monthNum] = [];
        byCalendarMonth[monthNum].push(m.total);
      }

      // Detect months that are significantly above average
      const spikeMonths: { month: number; increase: number }[] = [];
      for (const [monthStr, amounts] of Object.entries(byCalendarMonth)) {
        const monthAvg = this.average(amounts);
        const increase = ((monthAvg - overallAvg) / overallAvg) * 100;
        if (increase > 25) {
          // 25%+ above average counts as a spike
          spikeMonths.push({
            month: parseInt(monthStr, 10),
            increase: Math.round(increase),
          });
        }
      }

      if (spikeMonths.length === 0) continue;

      // Classify patterns
      const affectedMonths = spikeMonths.map((s) => s.month);
      const avgIncrease = this.average(spikeMonths.map((s) => s.increase));
      const pattern = this.classifySeasonalPattern(affectedMonths);

      patterns.push({
        categoryName: cat.categoryName,
        pattern: pattern.name,
        affectedMonths,
        averageIncrease: Math.round(avgIncrease),
        recommendation: pattern.recommendation(
          cat.categoryName,
          Math.round(avgIncrease),
        ),
      });
    }

    return patterns;
  }

  /**
   * Auto-adjust existing budgets based on recent spending trends.
   */
  async autoAdjustBudgets(
    userId: string,
    sensitivity: 'conservative' | 'moderate' | 'aggressive',
  ): Promise<AdjustmentResult[]> {
    const budgets = await this.db
      .select({
        id: schema.budgets.id,
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
      .where(eq(schema.budgets.userId, userId));

    if (budgets.length === 0) return [];

    // Multipliers control how aggressively budgets are adjusted
    const multipliers = {
      conservative: { up: 0.05, down: 0.03, buffer: 1.15 },
      moderate: { up: 0.10, down: 0.07, buffer: 1.10 },
      aggressive: { up: 0.20, down: 0.15, buffer: 1.05 },
    };
    const config = multipliers[sensitivity];

    const results: AdjustmentResult[] = [];
    const categoryData = await this.getCategorySpendingHistory(userId, 3);
    const categoryMap = new Map(
      categoryData.map((c) => [c.categoryId, c]),
    );

    for (const budget of budgets) {
      if (!budget.categoryId) continue;

      const catData = categoryMap.get(budget.categoryId);
      if (!catData || catData.months.length === 0) continue;

      const recentTotals = catData.months.map((m) => m.total);
      const avg = this.average(recentTotals);
      const trend = this.calculateTrend(recentTotals);

      let newAmount = budget.amount;
      let reason = '';

      // Over budget consistently: increase
      if (avg > budget.amount * 1.05) {
        const overage = avg - budget.amount;
        const adjustment = Math.min(overage * config.buffer, budget.amount * config.up * 3);
        newAmount = budget.amount + adjustment;
        reason = `Spending averages $${avg.toFixed(0)}/month, exceeding budget by $${overage.toFixed(0)}. Adjusted up.`;
      }
      // Under budget consistently: decrease (free up funds)
      else if (avg < budget.amount * 0.6 && trend !== 'increasing') {
        const surplus = budget.amount - avg;
        const adjustment = surplus * config.down * 3;
        newAmount = budget.amount - adjustment;
        reason = `Spending averages $${avg.toFixed(0)}/month, well below $${budget.amount.toFixed(0)} budget. Adjusted down to free up funds.`;
      }
      // Trending up: preemptive increase
      else if (trend === 'increasing' && recentTotals.length >= 2) {
        const recentAvg = this.average(recentTotals.slice(-2));
        if (recentAvg > budget.amount * 0.85) {
          const adjustment = budget.amount * config.up;
          newAmount = budget.amount + adjustment;
          reason = `Spending trending upward and approaching budget limit. Preemptive adjustment.`;
        }
      }

      // Round to nearest $5
      newAmount = Math.ceil(newAmount / 5) * 5;

      // Only include if there's an actual change
      if (newAmount === budget.amount) continue;

      const changePercent =
        ((newAmount - budget.amount) / budget.amount) * 100;

      // Apply the update
      await this.db
        .update(schema.budgets)
        .set({ amount: newAmount, updatedAt: new Date() })
        .where(
          and(
            eq(schema.budgets.id, budget.id),
            eq(schema.budgets.userId, userId),
          ),
        );

      results.push({
        budgetId: budget.id,
        categoryName: budget.categoryName || 'Unknown',
        previousAmount: budget.amount,
        newAmount,
        changePercent: Math.round(changePercent * 10) / 10,
        reason,
      });
    }

    return results;
  }

  /**
   * Get insights about spending vs budget performance.
   */
  async getBudgetInsights(userId: string): Promise<BudgetInsight[]> {
    const insights: BudgetInsight[] = [];

    // Load budgets with current spending
    const budgets = await this.db
      .select({
        id: schema.budgets.id,
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
      .where(eq(schema.budgets.userId, userId));

    const categoryData = await this.getCategorySpendingHistory(userId, 3);
    const categoryMap = new Map(
      categoryData.map((c) => [c.categoryId, c]),
    );

    // Current period spending
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    for (const budget of budgets) {
      if (!budget.categoryId) continue;

      const catData = categoryMap.get(budget.categoryId);
      const currentSpent = await this.getSpentForCategory(
        userId,
        budget.categoryId,
        monthStart,
        monthEnd,
      );

      const percentUsed = budget.amount > 0 ? (currentSpent / budget.amount) * 100 : 0;
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const expectedPercent = (dayOfMonth / daysInMonth) * 100;

      const catName = budget.categoryName || 'Unknown';

      // Over budget
      if (percentUsed >= 100) {
        const overAmount = currentSpent - budget.amount;
        insights.push({
          type: 'over_budget',
          title: `${catName} is over budget`,
          description: `You've spent $${currentSpent.toFixed(0)} of your $${budget.amount.toFixed(0)} ${catName} budget, exceeding it by $${overAmount.toFixed(0)}.`,
          categoryName: catName,
          amount: overAmount,
          severity: 'warning',
        });
      }
      // Significantly under budget (savings opportunity)
      else if (
        percentUsed < expectedPercent * 0.5 &&
        dayOfMonth > 15
      ) {
        const projected = (currentSpent / dayOfMonth) * daysInMonth;
        const savings = budget.amount - projected;
        if (savings > 20) {
          insights.push({
            type: 'savings_opportunity',
            title: `Potential savings in ${catName}`,
            description: `You're on track to spend only $${projected.toFixed(0)} of your $${budget.amount.toFixed(0)} budget. Consider saving the extra $${savings.toFixed(0)}.`,
            categoryName: catName,
            amount: savings,
            severity: 'success',
          });
        }
      }
      // Spending faster than expected
      else if (percentUsed > expectedPercent * 1.3 && percentUsed < 100) {
        insights.push({
          type: 'trending_up',
          title: `${catName} spending is ahead of pace`,
          description: `You've used ${percentUsed.toFixed(0)}% of your ${catName} budget but we're only ${expectedPercent.toFixed(0)}% through the month. Consider slowing down.`,
          categoryName: catName,
          severity: 'warning',
        });
      }
      // Comfortably under budget
      else if (percentUsed < expectedPercent * 0.7 && dayOfMonth > 10) {
        insights.push({
          type: 'under_budget',
          title: `${catName} is on track`,
          description: `Great job! You've only used ${percentUsed.toFixed(0)}% of your ${catName} budget with ${daysInMonth - dayOfMonth} days left.`,
          categoryName: catName,
          severity: 'success',
        });
      }

      // Trend analysis from historical data
      if (catData && catData.months.length >= 2) {
        const trend = this.calculateTrend(catData.months.map((m) => m.total));
        const recentTotals = catData.months.map((m) => m.total);
        const avg = this.average(recentTotals);

        if (trend === 'increasing' && avg > budget.amount * 0.8) {
          insights.push({
            type: 'trending_up',
            title: `${catName} spending is trending upward`,
            description: `Your ${catName} spending has been increasing over the past ${catData.months.length} months, averaging $${avg.toFixed(0)}/month. Your budget is $${budget.amount.toFixed(0)}.`,
            categoryName: catName,
            severity: 'warning',
          });
        } else if (trend === 'decreasing') {
          insights.push({
            type: 'trending_down',
            title: `${catName} spending is decreasing`,
            description: `Your ${catName} spending has been dropping. Recent average: $${avg.toFixed(0)}/month. You might be able to reduce this budget.`,
            categoryName: catName,
            severity: 'info',
          });
        }
      }
    }

    // Detect seasonal alerts
    const patterns = await this.detectSeasonalPatterns(userId);
    const nextMonth = now.getMonth() + 2; // 1-indexed next month
    const upcomingMonth = nextMonth > 12 ? nextMonth - 12 : nextMonth;

    for (const pattern of patterns) {
      if (pattern.affectedMonths.includes(upcomingMonth)) {
        insights.push({
          type: 'seasonal_alert',
          title: `Seasonal spike expected for ${pattern.categoryName}`,
          description: `Based on past patterns, ${pattern.categoryName} spending typically increases by ${pattern.averageIncrease}% next month. ${pattern.recommendation}`,
          categoryName: pattern.categoryName,
          amount: pattern.averageIncrease,
          severity: 'info',
        });
      }
    }

    // Sort: warnings first, then info, then success
    const severityOrder = { warning: 0, info: 1, success: 2 };
    return insights.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );
  }

  /**
   * Predict next month's spending per category.
   */
  async predictNextMonth(userId: string): Promise<CategoryPrediction[]> {
    const categoryData = await this.getCategorySpendingHistory(userId, 6);
    const predictions: CategoryPrediction[] = [];

    for (const cat of categoryData) {
      if (cat.months.length < 2) continue;

      const totals = cat.months.map((m) => m.total);
      const trend = this.calculateTrend(totals);
      const avg = this.average(totals);
      const stdDev = this.standardDeviation(totals);

      // Weighted average: more recent months count more
      const weightedAvg = this.weightedAverage(totals);

      // Simple linear regression for prediction
      let predicted: number;
      if (totals.length >= 3) {
        predicted = this.linearExtrapolation(totals);
      } else {
        predicted = weightedAvg;
      }

      // Clamp prediction to reasonable range (don't predict negative spending)
      predicted = Math.max(0, predicted);

      // Confidence based on data consistency and amount of data
      const coefficientOfVariation = avg > 0 ? stdDev / avg : 1;
      let confidence = 1 - Math.min(coefficientOfVariation, 1);
      // Boost confidence with more data points
      confidence *= Math.min(cat.months.length / 6, 1);
      confidence = Math.round(confidence * 100) / 100;

      // Month-over-month change
      const lastMonthTotal =
        totals.length > 0 ? totals[totals.length - 1] : 0;
      const momChange =
        lastMonthTotal > 0
          ? ((predicted - lastMonthTotal) / lastMonthTotal) * 100
          : 0;

      predictions.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        predictedAmount: Math.round(predicted * 100) / 100,
        confidence,
        trend,
        monthOverMonthChange: Math.round(momChange * 10) / 10,
      });
    }

    return predictions.sort((a, b) => b.predictedAmount - a.predictedAmount);
  }

  // ── Private: Data Retrieval ────────────────────────────────────────

  private async getCategorySpendingHistory(
    userId: string,
    months: number,
  ): Promise<CategoryMonthlyData[]> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const start = startDate.toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];

    const rows = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        month: sql<string>`to_char(${schema.transactions.date}::date, 'YYYY-MM')`.as(
          'month',
        ),
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
          gte(schema.transactions.date, start),
          lte(schema.transactions.date, end),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(
        schema.transactions.categoryId,
        schema.categories.name,
        sql`to_char(${schema.transactions.date}::date, 'YYYY-MM')`,
      )
      .orderBy(
        asc(schema.transactions.categoryId),
        asc(sql`to_char(${schema.transactions.date}::date, 'YYYY-MM')`),
      );

    // Group by category
    const categoryMap = new Map<string, CategoryMonthlyData>();
    for (const row of rows) {
      if (!row.categoryId) continue;
      const total = Number(row.total) || 0;
      if (total === 0) continue;

      if (!categoryMap.has(row.categoryId)) {
        categoryMap.set(row.categoryId, {
          categoryId: row.categoryId,
          categoryName: row.categoryName || 'Uncategorized',
          months: [],
        });
      }
      categoryMap.get(row.categoryId)!.months.push({
        month: row.month,
        total,
      });
    }

    return Array.from(categoryMap.values());
  }

  private async getSpentForCategory(
    userId: string,
    categoryId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    // Include child categories
    const childCategories = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.parentId, categoryId));

    const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];

    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END), 0)`.as(
          'total',
        ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.categoryId} IN (${sql.join(
            categoryIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      );

    return Number(result?.total) || 0;
  }

  // ── Private: Statistical Helpers ───────────────────────────────────

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.average(values);
    const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
    return Math.sqrt(this.average(squareDiffs));
  }

  private weightedAverage(values: number[]): number {
    if (values.length === 0) return 0;
    // Linear weights: most recent gets highest weight
    let weightSum = 0;
    let valueSum = 0;
    for (let i = 0; i < values.length; i++) {
      const weight = i + 1;
      valueSum += values[i] * weight;
      weightSum += weight;
    }
    return valueSum / weightSum;
  }

  private linearExtrapolation(values: number[]): number {
    // Simple linear regression to predict the next value
    const n = values.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return this.average(values);

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return intercept + slope * n; // Predict at index n (next month)
  }

  private calculateTrend(
    values: number[],
  ): 'increasing' | 'stable' | 'decreasing' {
    if (values.length < 2) return 'stable';

    // Use linear regression slope
    const n = values.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 'stable';

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const avg = sumY / n;

    // Slope relative to average determines trend
    const relativeSlope = avg > 0 ? slope / avg : 0;

    if (relativeSlope > 0.05) return 'increasing';
    if (relativeSlope < -0.05) return 'decreasing';
    return 'stable';
  }

  // ── Private: Seasonal Pattern Classification ───────────────────────

  private classifySeasonalPattern(months: number[]): {
    name: string;
    recommendation: (cat: string, increase: number) => string;
  } {
    const monthSet = new Set(months);

    // Holiday season (Nov-Dec)
    if (monthSet.has(11) || monthSet.has(12)) {
      return {
        name: 'holiday_spike',
        recommendation: (cat, inc) =>
          `Consider increasing your ${cat} budget by ${inc}% during November-December for holiday spending.`,
      };
    }

    // Summer (Jun-Aug)
    if (
      (monthSet.has(6) || monthSet.has(7) || monthSet.has(8)) &&
      months.every((m) => m >= 6 && m <= 8)
    ) {
      return {
        name: 'summer_increase',
        recommendation: (cat, inc) =>
          `Your ${cat} spending typically rises ${inc}% in summer. Plan ahead with a seasonal budget bump.`,
      };
    }

    // Back to school (Aug-Sep)
    if (monthSet.has(8) || monthSet.has(9)) {
      return {
        name: 'back_to_school',
        recommendation: (cat, inc) =>
          `Back-to-school season drives ${cat} spending up by ${inc}%. Budget extra for August-September.`,
      };
    }

    // Year end (Dec-Jan)
    if (monthSet.has(12) || monthSet.has(1)) {
      return {
        name: 'year_end_surge',
        recommendation: (cat, inc) =>
          `Year-end spending in ${cat} tends to spike by ${inc}%. Set aside extra funds for December-January.`,
      };
    }

    // Spring (Mar-May)
    if (months.every((m) => m >= 3 && m <= 5)) {
      return {
        name: 'spring_increase',
        recommendation: (cat, inc) =>
          `Spring tends to bring a ${inc}% increase in ${cat} spending. Adjust your budget accordingly.`,
      };
    }

    // Generic seasonal pattern
    const monthNames = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const affectedNames = months.map((m) => monthNames[m]).join(', ');
    return {
      name: 'periodic_spike',
      recommendation: (cat, inc) =>
        `${cat} spending typically increases by ${inc}% during ${affectedNames}. Consider budgeting extra during these months.`,
    };
  }

  // ── Private: AI Enhancement (optional) ─────────────────────────────

  private async enrichSuggestionsWithAI(
    suggestions: BudgetSuggestion[],
  ): Promise<void> {
    if (!this.ollamaClient.isAvailable() || suggestions.length === 0) return;

    try {
      const summaryText = suggestions
        .map(
          (s) =>
            `${s.categoryName}: avg=$${s.averageSpending.toFixed(0)}, median=$${s.medianSpending.toFixed(0)}, max=$${s.maxSpending.toFixed(0)}, suggested=$${s.suggestedAmount}`,
        )
        .join('\n');

      const prompt = `You are a personal finance assistant. Given these budget category spending patterns, provide a brief, actionable one-sentence tip for each category. Be specific and practical.

Spending data:
${summaryText}

Respond with one line per category in format: CategoryName: tip
Keep each tip under 30 words.`;

      const response = await this.ollamaClient.generate(prompt, {
        temperature: 0.3,
      });

      if (!response) return;

      // Parse AI response and merge into suggestions
      const lines = response.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const name = line.substring(0, colonIdx).trim();
        const tip = line.substring(colonIdx + 1).trim();

        const match = suggestions.find(
          (s) =>
            s.categoryName.toLowerCase() === name.toLowerCase() ||
            name.toLowerCase().includes(s.categoryName.toLowerCase()),
        );

        if (match && tip.length > 10) {
          match.reasoning += ` AI tip: ${tip}`;
        }
      }
    } catch (error) {
      this.logger.debug(`AI enrichment skipped: ${error}`);
    }
  }
}
