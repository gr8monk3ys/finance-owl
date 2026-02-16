import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

// ── Response interfaces ────────────────────────────────────────────

export interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  total: number;
  percentage: number;
  count: number;
}

export interface MerchantSpending {
  merchantName: string;
  total: number;
  count: number;
  averageTransaction: number;
}

export interface TimeSeriesPoint {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface IncomeVsExpenses {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  periods: TimeSeriesPoint[];
}

export interface CategoryTrend {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string;
  months: { month: string; total: number }[];
  averageMonthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
}

export interface DailyAverageResult {
  dailyAverage: number;
  totalSpent: number;
  daysAnalyzed: number;
  highestDay: { date: string; amount: number } | null;
  lowestDay: { date: string; amount: number } | null;
}

type Granularity = 'day' | 'week' | 'month';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Category breakdown with amounts, percentages, and transaction counts
   * for a given date range.
   */
  async getSpendingByCategory(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<CategorySpending[]> {
    const cacheKey = `analytics:${userId}:spending:category:${startDate}:${endDate}`;
    return this.cacheService.wrap(cacheKey, 300, () =>
      this._getSpendingByCategory(userId, startDate, endDate),
    );
  }

  private async _getSpendingByCategory(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<CategorySpending[]> {
    const rows = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
        total: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
          'total',
        ),
        count: sql<number>`COUNT(CASE WHEN ${schema.transactions.amount} > 0 THEN 1 END)`.as(
          'count',
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
      .groupBy(
        schema.transactions.categoryId,
        schema.categories.name,
        schema.categories.color,
        schema.categories.icon,
      )
      .orderBy(desc(sql`total`));

    const grandTotal = rows.reduce((sum, r) => sum + Number(r.total), 0);

    return rows
      .filter((r) => Number(r.total) > 0)
      .map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName || 'Uncategorized',
        categoryColor: r.categoryColor || '#71717a',
        categoryIcon: r.categoryIcon,
        total: round2(Number(r.total)),
        percentage: grandTotal > 0 ? round2((Number(r.total) / grandTotal) * 100) : 0,
        count: Number(r.count),
      }));
  }

  /**
   * Top merchants by total spend within a date range.
   */
  async getSpendingByMerchant(
    userId: string,
    startDate: string,
    endDate: string,
    limit: number = 10,
  ): Promise<MerchantSpending[]> {
    const cacheKey = `analytics:${userId}:spending:merchant:${startDate}:${endDate}:${limit}`;
    return this.cacheService.wrap(cacheKey, 300, () =>
      this._getSpendingByMerchant(userId, startDate, endDate, limit),
    );
  }

  private async _getSpendingByMerchant(
    userId: string,
    startDate: string,
    endDate: string,
    limit: number = 10,
  ): Promise<MerchantSpending[]> {
    const rows = await this.db
      .select({
        merchantName:
          sql<string>`COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})`.as(
            'merchant_name',
          ),
        total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
          sql`${schema.transactions.amount} > 0`,
        ),
      )
      .groupBy(
        sql`COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})`,
      )
      .orderBy(desc(sql`total`))
      .limit(limit);

    return rows.map((r) => ({
      merchantName: r.merchantName,
      total: round2(Number(r.total)),
      count: Number(r.count),
      averageTransaction: Number(r.count) > 0 ? round2(Number(r.total) / Number(r.count)) : 0,
    }));
  }

  /**
   * Time-series spending data at day/week/month granularity.
   */
  async getSpendingOverTime(
    userId: string,
    startDate: string,
    endDate: string,
    granularity: Granularity = 'month',
  ): Promise<TimeSeriesPoint[]> {
    const periodExpr = buildPeriodExpression(granularity);

    const rows = await this.db
      .select({
        period: sql<string>`${periodExpr}`.as('period'),
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
      .groupBy(sql`${periodExpr}`)
      .orderBy(sql`period`);

    return rows.map((r) => ({
      period: r.period,
      income: round2(Number(r.income)),
      expenses: round2(Number(r.expenses)),
      net: round2(Number(r.income) - Number(r.expenses)),
    }));
  }

  /**
   * Income vs expenses comparison with net cash flow and savings rate.
   */
  async getIncomeVsExpenses(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<IncomeVsExpenses> {
    const periods = await this.getSpendingOverTime(
      userId,
      startDate,
      endDate,
      'month',
    );

    const totalIncome = periods.reduce((sum, p) => sum + p.income, 0);
    const totalExpenses = periods.reduce((sum, p) => sum + p.expenses, 0);
    const netCashFlow = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;

    return {
      totalIncome: round2(totalIncome),
      totalExpenses: round2(totalExpenses),
      netCashFlow: round2(netCashFlow),
      savingsRate: round2(savingsRate),
      periods,
    };
  }

  /**
   * Month-over-month trends by category across a specified number of months.
   */
  async getCategoryTrends(
    userId: string,
    months: number = 6,
  ): Promise<CategoryTrend[]> {
    const cacheKey = `analytics:${userId}:trends:${months}`;
    return this.cacheService.wrap(cacheKey, 600, () =>
      this._getCategoryTrends(userId, months),
    );
  }

  private async _getCategoryTrends(
    userId: string,
    months: number = 6,
  ): Promise<CategoryTrend[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const rows = await this.db
      .select({
        month: sql<string>`to_char(${schema.transactions.date}::date, 'YYYY-MM')`.as('month'),
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
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
        sql`to_char(${schema.transactions.date}::date, 'YYYY-MM')`,
        schema.transactions.categoryId,
        schema.categories.name,
        schema.categories.color,
      )
      .orderBy(sql`month`);

    // Group by category
    const categoryMap = new Map<
      string | null,
      {
        categoryId: string | null;
        categoryName: string;
        categoryColor: string;
        months: Map<string, number>;
      }
    >();

    for (const row of rows) {
      const key = row.categoryId;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          categoryId: row.categoryId,
          categoryName: row.categoryName || 'Uncategorized',
          categoryColor: row.categoryColor || '#71717a',
          months: new Map(),
        });
      }
      categoryMap.get(key)!.months.set(row.month, Number(row.total));
    }

    const results: CategoryTrend[] = [];

    for (const [, cat] of categoryMap) {
      const monthEntries = Array.from(cat.months.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, total: round2(total) }));

      const totals = monthEntries.map((m) => m.total);
      const averageMonthly =
        totals.length > 0
          ? round2(totals.reduce((a, b) => a + b, 0) / totals.length)
          : 0;

      // Determine trend direction from first half vs second half
      const { trend, changePercent } = computeTrend(totals);

      results.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryColor: cat.categoryColor,
        months: monthEntries,
        averageMonthly,
        trend,
        changePercent,
      });
    }

    // Sort by average monthly spending descending
    results.sort((a, b) => b.averageMonthly - a.averageMonthly);

    return results;
  }

  /**
   * Daily average spend over a rolling window.
   */
  async getDailyAverageSpend(
    userId: string,
    days: number = 30,
  ): Promise<DailyAverageResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const rows = await this.db
      .select({
        date: schema.transactions.date,
        total: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
          'total',
        ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, start),
          lte(schema.transactions.date, end),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(schema.transactions.date)
      .orderBy(schema.transactions.date);

    if (rows.length === 0) {
      return {
        dailyAverage: 0,
        totalSpent: 0,
        daysAnalyzed: days,
        highestDay: null,
        lowestDay: null,
      };
    }

    const dayTotals = rows.map((r) => ({
      date: r.date,
      amount: round2(Number(r.total)),
    }));

    const totalSpent = dayTotals.reduce((sum, d) => sum + d.amount, 0);
    const dailyAverage = round2(totalSpent / days);

    let highestDay = dayTotals[0];
    let lowestDay = dayTotals[0];

    for (const day of dayTotals) {
      if (day.amount > highestDay.amount) highestDay = day;
      if (day.amount < lowestDay.amount) lowestDay = day;
    }

    return {
      dailyAverage,
      totalSpent: round2(totalSpent),
      daysAnalyzed: days,
      highestDay,
      lowestDay,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns a SQL expression that buckets transaction dates by the requested
 * granularity. Uses PostgreSQL date functions.
 */
function buildPeriodExpression(granularity: Granularity) {
  switch (granularity) {
    case 'day':
      return sql.raw(`${schema.transactions.date.name}`);
    case 'week':
      return sql`to_char(date_trunc('week', ${schema.transactions.date}::date), 'YYYY-"W"IW')`;
    case 'month':
      return sql`to_char(${schema.transactions.date}::date, 'YYYY-MM')`;
  }
}

/**
 * Computes whether spending is trending up, down, or stable by comparing
 * the first half of the period to the second half.
 */
function computeTrend(totals: number[]): {
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
} {
  if (totals.length < 2) {
    return { trend: 'stable', changePercent: 0 };
  }

  const mid = Math.floor(totals.length / 2);
  const firstHalf = totals.slice(0, mid);
  const secondHalf = totals.slice(mid);

  const avgFirst =
    firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond =
    secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgFirst === 0) {
    return {
      trend: avgSecond > 0 ? 'increasing' : 'stable',
      changePercent: avgSecond > 0 ? 100 : 0,
    };
  }

  const changePercent = round2(((avgSecond - avgFirst) / avgFirst) * 100);

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (changePercent > 10) {
    trend = 'increasing';
  } else if (changePercent < -10) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  return { trend, changePercent };
}
