import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, sql, desc, inArray } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface SpendingReportRow {
  group: string;
  total: number;
  count: number;
  color?: string | null;
}

export interface IncomeVsExpenseRow {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface NetWorthAccount {
  id: string;
  name: string;
  type: string;
  institutionName: string | null;
  balance: number;
}

export interface NetWorthReport {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accounts: NetWorthAccount[];
}

export interface TrendRow {
  month: string;
  total: number;
  categoryName?: string | null;
}

@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getSpendingReport(
    userId: string,
    options: {
      startDate: string;
      endDate: string;
      accountIds?: string[];
      categoryIds?: string[];
      groupBy: 'category' | 'merchant' | 'account' | 'day' | 'week' | 'month';
    },
  ): Promise<SpendingReportRow[]> {
    const conditions = [
      eq(schema.transactions.userId, userId),
      gte(schema.transactions.date, options.startDate),
      lte(schema.transactions.date, options.endDate),
      eq(schema.transactions.pending, false),
      sql`${schema.transactions.amount} > 0`, // spending only
    ];

    if (options.accountIds && options.accountIds.length > 0) {
      conditions.push(
        inArray(schema.transactions.accountId, options.accountIds),
      );
    }

    if (options.categoryIds && options.categoryIds.length > 0) {
      conditions.push(
        inArray(schema.transactions.categoryId, options.categoryIds),
      );
    }

    switch (options.groupBy) {
      case 'category': {
        const rows = await this.db
          .select({
            group: sql<string>`COALESCE(${schema.categories.name}, 'Uncategorized')`.as('group_name'),
            total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
            count: sql<number>`COUNT(*)`.as('count'),
            color: schema.categories.color,
          })
          .from(schema.transactions)
          .leftJoin(
            schema.categories,
            eq(schema.transactions.categoryId, schema.categories.id),
          )
          .where(and(...conditions))
          .groupBy(schema.transactions.categoryId)
          .orderBy(desc(sql`total`));

        return rows.map((r) => ({
          group: r.group,
          total: r.total,
          count: r.count,
          color: r.color,
        }));
      }

      case 'merchant': {
        const rows = await this.db
          .select({
            group: sql<string>`COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})`.as('group_name'),
            total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
            count: sql<number>`COUNT(*)`.as('count'),
          })
          .from(schema.transactions)
          .where(and(...conditions))
          .groupBy(sql`COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})`)
          .orderBy(desc(sql`total`));

        return rows.map((r) => ({
          group: r.group,
          total: r.total,
          count: r.count,
        }));
      }

      case 'account': {
        const rows = await this.db
          .select({
            group: sql<string>`${schema.accounts.name}`.as('group_name'),
            total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
            count: sql<number>`COUNT(*)`.as('count'),
          })
          .from(schema.transactions)
          .leftJoin(
            schema.accounts,
            eq(schema.transactions.accountId, schema.accounts.id),
          )
          .where(and(...conditions))
          .groupBy(schema.transactions.accountId)
          .orderBy(desc(sql`total`));

        return rows.map((r) => ({
          group: r.group,
          total: r.total,
          count: r.count,
        }));
      }

      case 'day': {
        const rows = await this.db
          .select({
            group: sql<string>`${schema.transactions.date}`.as('group_name'),
            total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
            count: sql<number>`COUNT(*)`.as('count'),
          })
          .from(schema.transactions)
          .where(and(...conditions))
          .groupBy(schema.transactions.date)
          .orderBy(sql`group_name`);

        return rows.map((r) => ({
          group: r.group,
          total: r.total,
          count: r.count,
        }));
      }

      case 'week': {
        const rows = await this.db
          .select({
            group: sql<string>`strftime('%Y-W%W', ${schema.transactions.date})`.as('group_name'),
            total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
            count: sql<number>`COUNT(*)`.as('count'),
          })
          .from(schema.transactions)
          .where(and(...conditions))
          .groupBy(sql`strftime('%Y-W%W', ${schema.transactions.date})`)
          .orderBy(sql`group_name`);

        return rows.map((r) => ({
          group: r.group,
          total: r.total,
          count: r.count,
        }));
      }

      case 'month': {
        const rows = await this.db
          .select({
            group: sql<string>`strftime('%Y-%m', ${schema.transactions.date})`.as('group_name'),
            total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
            count: sql<number>`COUNT(*)`.as('count'),
          })
          .from(schema.transactions)
          .where(and(...conditions))
          .groupBy(sql`strftime('%Y-%m', ${schema.transactions.date})`)
          .orderBy(sql`group_name`);

        return rows.map((r) => ({
          group: r.group,
          total: r.total,
          count: r.count,
        }));
      }
    }
  }

  async getIncomeVsExpense(
    userId: string,
    options: {
      startDate: string;
      endDate: string;
      groupBy: 'month' | 'week';
    },
  ): Promise<IncomeVsExpenseRow[]> {
    const groupExpr =
      options.groupBy === 'month'
        ? sql`strftime('%Y-%m', ${schema.transactions.date})`
        : sql`strftime('%Y-W%W', ${schema.transactions.date})`;

    const rows = await this.db
      .select({
        period: sql<string>`${groupExpr}`.as('period'),
        income: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} < 0 THEN ABS(${schema.transactions.amount}) ELSE 0 END)`.as('income'),
        expenses: sql<number>`SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END)`.as('expenses'),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, options.startDate),
          lte(schema.transactions.date, options.endDate),
          eq(schema.transactions.pending, false),
        ),
      )
      .groupBy(groupExpr)
      .orderBy(sql`period`);

    return rows.map((r) => ({
      period: r.period,
      income: r.income,
      expenses: r.expenses,
      net: r.income - r.expenses,
    }));
  }

  async getNetWorthReport(userId: string): Promise<NetWorthReport> {
    const accountRows = await this.db
      .select({
        id: schema.accounts.id,
        name: schema.accounts.name,
        type: schema.accounts.type,
        institutionName: schema.accounts.institutionName,
        balance: schema.accounts.currentBalance,
      })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.isHidden, false),
        ),
      )
      .orderBy(schema.accounts.type, schema.accounts.name);

    const ASSET_TYPES = ['checking', 'savings', 'investment', 'other'];
    const LIABILITY_TYPES = ['credit_card', 'loan', 'mortgage'];

    const accounts: NetWorthAccount[] = accountRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      institutionName: a.institutionName,
      balance: a.balance ?? 0,
    }));

    const totalAssets = accounts
      .filter((a) => ASSET_TYPES.includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);

    const totalLiabilities = accounts
      .filter((a) => LIABILITY_TYPES.includes(a.type))
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      accounts,
    };
  }

  async getTrendReport(
    userId: string,
    options: { months: number; categoryIds?: string[] },
  ): Promise<TrendRow[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - options.months + 1);
    startDate.setDate(1);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const conditions = [
      eq(schema.transactions.userId, userId),
      gte(schema.transactions.date, start),
      lte(schema.transactions.date, end),
      eq(schema.transactions.pending, false),
      sql`${schema.transactions.amount} > 0`,
    ];

    if (options.categoryIds && options.categoryIds.length > 0) {
      conditions.push(
        inArray(schema.transactions.categoryId, options.categoryIds),
      );
    }

    const rows = await this.db
      .select({
        month: sql<string>`strftime('%Y-%m', ${schema.transactions.date})`.as('month'),
        total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
      })
      .from(schema.transactions)
      .where(and(...conditions))
      .groupBy(sql`strftime('%Y-%m', ${schema.transactions.date})`)
      .orderBy(sql`month`);

    return rows.map((r) => ({
      month: r.month,
      total: r.total,
    }));
  }

  async generateCSV(
    userId: string,
    type: 'transactions' | 'budgets' | 'networth',
    options: { startDate?: string; endDate?: string },
  ): Promise<string> {
    switch (type) {
      case 'transactions':
        return this.generateTransactionsCSV(userId, options);
      case 'budgets':
        return this.generateBudgetsCSV(userId);
      case 'networth':
        return this.generateNetWorthCSV(userId);
    }
  }

  private async generateTransactionsCSV(
    userId: string,
    options: { startDate?: string; endDate?: string },
  ): Promise<string> {
    const conditions = [
      eq(schema.transactions.userId, userId),
      eq(schema.transactions.pending, false),
    ];

    if (options.startDate) {
      conditions.push(gte(schema.transactions.date, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(schema.transactions.date, options.endDate));
    }

    const rows = await this.db
      .select({
        date: schema.transactions.date,
        merchant: sql<string>`COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})`.as('merchant'),
        category: sql<string>`COALESCE(${schema.categories.name}, 'Uncategorized')`.as('category'),
        amount: schema.transactions.amount,
        account: schema.accounts.name,
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
      .where(and(...conditions))
      .orderBy(desc(schema.transactions.date));

    const header = 'Date,Merchant,Category,Amount,Account';
    const lines = rows.map(
      (r) =>
        `${r.date},"${this.escapeCSV(r.merchant)}","${this.escapeCSV(r.category)}",${r.amount},"${this.escapeCSV(r.account ?? '')}"`,
    );

    return [header, ...lines].join('\n');
  }

  private async generateBudgetsCSV(userId: string): Promise<string> {
    const budgets = await this.db
      .select({
        categoryName: schema.categories.name,
        amount: schema.budgets.amount,
        period: schema.budgets.period,
      })
      .from(schema.budgets)
      .leftJoin(
        schema.categories,
        eq(schema.budgets.categoryId, schema.categories.id),
      )
      .where(eq(schema.budgets.userId, userId))
      .orderBy(schema.categories.name);

    // Get spent amounts for each budget
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const header = 'Category,Budgeted,Spent,Remaining,Period';
    const lines: string[] = [];

    for (const budget of budgets) {
      const [result] = await this.db
        .select({
          spent: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END), 0)`.as('spent'),
        })
        .from(schema.transactions)
        .leftJoin(
          schema.categories,
          eq(schema.transactions.categoryId, schema.categories.id),
        )
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`${schema.categories.name} = ${budget.categoryName}`,
            gte(schema.transactions.date, monthStart),
            lte(schema.transactions.date, monthEnd),
            eq(schema.transactions.pending, false),
          ),
        );

      const spent = result?.spent ?? 0;
      const remaining = budget.amount - spent;
      lines.push(
        `"${this.escapeCSV(budget.categoryName ?? 'Unknown')}",${budget.amount},${spent},${remaining},${budget.period}`,
      );
    }

    return [header, ...lines].join('\n');
  }

  private async generateNetWorthCSV(userId: string): Promise<string> {
    const report = await this.getNetWorthReport(userId);
    const today = new Date().toISOString().split('T')[0];

    const header = 'Account,Type,Balance,Date';
    const lines = report.accounts.map(
      (a) =>
        `"${this.escapeCSV(a.name)}",${a.type},${a.balance},${today}`,
    );

    return [header, ...lines].join('\n');
  }

  private escapeCSV(value: string): string {
    return value.replace(/"/g, '""');
  }
}
