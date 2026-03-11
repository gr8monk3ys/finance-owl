import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

@Injectable()
export class SpendingAnalyticsService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async getCategoryBreakdown(
    userId: string,
    startDate: string,
    endDate: string,
  ) {
    const cacheKey = `analytics:${userId}:breakdown:${startDate}:${endDate}`;
    return this.cacheService.wrap(cacheKey, 300, () =>
      this._getCategoryBreakdown(userId, startDate, endDate),
    );
  }

  private async _getCategoryBreakdown(
    userId: string,
    startDate: string,
    endDate: string,
  ) {
    const rows = await this.db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
        parentId: schema.categories.parentId,
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
        ),
      )
      .groupBy(
        schema.transactions.categoryId,
        schema.categories.name,
        schema.categories.color,
        schema.categories.icon,
        schema.categories.parentId,
      )
      .orderBy(desc(sql`total`));

    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName || 'Uncategorized',
      categoryColor: r.categoryColor || '#71717a',
      categoryIcon: r.categoryIcon,
      parentId: r.parentId,
      total: Math.abs(this.toNumber(r.total)),
      count: this.toNumber(r.count),
    }));
  }

  async getMonthlyTrend(userId: string, months: number = 6) {
    const cacheKey = `analytics:${userId}:monthly-trend:${months}`;
    return this.cacheService.wrap(cacheKey, 300, () =>
      this._getMonthlyTrend(userId, months),
    );
  }

  private async _getMonthlyTrend(userId: string, months: number = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const monthBucket = sql<string>`left(${schema.transactions.date}, 7)`;

    const rows = await this.db
      .select({
        month: monthBucket.as('month'),
        income: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} < 0 THEN ABS(${schema.transactions.amount}) ELSE 0 END)`.as(
          'income',
        ),
        spending: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
          'spending',
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
      .groupBy(monthBucket)
      .orderBy(sql`month`);

    return rows.map((row) => ({
      month: row.month,
      income: this.toNumber(row.income),
      spending: this.toNumber(row.spending),
    }));
  }

  async getTopMerchants(
    userId: string,
    startDate: string,
    endDate: string,
    limit: number = 10,
  ) {
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
          sql`${schema.transactions.amount} > 0`, // spending only
        ),
      )
      .groupBy(
        sql`COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})`,
      )
      .orderBy(desc(sql`total`))
      .limit(limit);

    return rows.map((r) => ({
      merchantName: r.merchantName,
      total: this.toNumber(r.total),
      count: this.toNumber(r.count),
    }));
  }

  async getMonthlySpending(userId: string, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const [result] = await this.db
      .select({
        total: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as(
          'total',
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

    return this.toNumber(result?.total);
  }

  async getDashboardSummary(userId: string) {
    const cacheKey = `analytics:${userId}:dashboard`;
    return this.cacheService.wrap(cacheKey, 120, () =>
      this._getDashboardSummary(userId),
    );
  }

  private async _getDashboardSummary(userId: string) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];

    const lastMonthStart = new Date(currentYear, currentMonth - 2, 1);
    const lastMonthEnd = new Date(currentYear, currentMonth - 1, 0);
    const prevStart = lastMonthStart.toISOString().split('T')[0];
    const prevEnd = lastMonthEnd.toISOString().split('T')[0];

    const [currentSpending, lastMonthSpending, categoryBreakdown, topMerchants, recentTransactions] =
      await Promise.all([
        this.getMonthlySpending(userId, currentYear, currentMonth),
        this.getMonthlySpending(
          userId,
          lastMonthStart.getFullYear(),
          lastMonthStart.getMonth() + 1,
        ),
        this.getCategoryBreakdown(userId, startDate, endDate),
        this.getTopMerchants(userId, startDate, endDate, 5),
        this.getRecentTransactions(userId, 5),
      ]);

    return {
      currentMonthSpending: currentSpending,
      lastMonthSpending: lastMonthSpending,
      spendingChange:
        lastMonthSpending > 0
          ? ((currentSpending - lastMonthSpending) / lastMonthSpending) * 100
          : 0,
      categoryBreakdown,
      topMerchants,
      recentTransactions,
    };
  }

  private async getRecentTransactions(userId: string, limit: number) {
    const rows = await this.db
      .select({
        id: schema.transactions.id,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        pending: schema.transactions.pending,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        accountName: schema.accounts.name,
        accountType: schema.accounts.type,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .leftJoin(
        schema.accounts,
        eq(schema.transactions.accountId, schema.accounts.id),
      )
      .where(eq(schema.transactions.userId, userId))
      .orderBy(
        desc(schema.transactions.date),
        desc(schema.transactions.createdAt),
      )
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      amount: this.toNumber(row.amount),
    }));
  }

  private toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return 0;
  }
}
