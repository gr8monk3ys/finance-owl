import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class YearReviewService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async generate(userId: string, year: number) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Fetch all non-pending transactions for the year
    const transactions = await this.db
      .select({
        amount: schema.transactions.amount,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        date: schema.transactions.date,
        categoryId: schema.transactions.categoryId,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.pending, false),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
        ),
      );

    // Separate income (negative amounts in Plaid convention) and spending
    const income = transactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const spending = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSaved = income - spending;
    const transactionCount = transactions.length;
    const averageTransaction =
      transactionCount > 0 ? spending / transactionCount : 0;

    // Find biggest purchase
    const spendingTransactions = transactions.filter((t) => t.amount > 0);
    let biggestPurchase = 0;
    let biggestPurchaseDescription = '';

    for (const t of spendingTransactions) {
      if (t.amount > biggestPurchase) {
        biggestPurchase = t.amount;
        biggestPurchaseDescription = t.merchantName ?? t.name;
      }
    }

    // Top merchant by total spending
    const merchantTotals = new Map<string, number>();
    for (const t of spendingTransactions) {
      const merchant = t.merchantName ?? t.name;
      merchantTotals.set(
        merchant,
        (merchantTotals.get(merchant) ?? 0) + t.amount,
      );
    }
    const topMerchant =
      [...merchantTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    // Top category by total spending
    const categoryTotals = new Map<string, number>();
    for (const t of spendingTransactions) {
      if (t.categoryId) {
        categoryTotals.set(
          t.categoryId,
          (categoryTotals.get(t.categoryId) ?? 0) + t.amount,
        );
      }
    }
    const topCategoryId = [...categoryTotals.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    let topCategory: string | null = null;
    if (topCategoryId) {
      const [cat] = await this.db
        .select({ name: schema.categories.name })
        .from(schema.categories)
        .where(eq(schema.categories.id, topCategoryId))
        .limit(1);
      topCategory = cat?.name ?? null;
    }

    // Monthly breakdown
    const monthlyMap = new Map<number, { income: number; spending: number }>();
    for (let m = 1; m <= 12; m++) {
      monthlyMap.set(m, { income: 0, spending: 0 });
    }
    for (const t of transactions) {
      const month = parseInt(t.date.substring(5, 7), 10);
      const entry = monthlyMap.get(month)!;
      if (t.amount < 0) {
        entry.income += Math.abs(t.amount);
      } else {
        entry.spending += t.amount;
      }
    }
    const monthlyBreakdown = [...monthlyMap.entries()].map(
      ([month, data]) => ({
        month,
        income: Math.round(data.income * 100) / 100,
        spending: Math.round(data.spending * 100) / 100,
      }),
    );

    // Category breakdown
    const categoryBreakdownEntries: { categoryId: string; name: string; amount: number }[] = [];
    for (const [catId, amount] of categoryTotals.entries()) {
      const [cat] = await this.db
        .select({ name: schema.categories.name })
        .from(schema.categories)
        .where(eq(schema.categories.id, catId))
        .limit(1);
      categoryBreakdownEntries.push({
        categoryId: catId,
        name: cat?.name ?? 'Unknown',
        amount: Math.round(amount * 100) / 100,
      });
    }
    categoryBreakdownEntries.sort((a, b) => b.amount - a.amount);

    // Upsert the review: delete existing then insert
    await this.db
      .delete(schema.yearReviews)
      .where(
        and(
          eq(schema.yearReviews.userId, userId),
          eq(schema.yearReviews.year, year),
        ),
      );

    const [review] = await this.db
      .insert(schema.yearReviews)
      .values({
        userId,
        year,
        totalIncome: Math.round(income * 100) / 100,
        totalSpending: Math.round(spending * 100) / 100,
        totalSaved: Math.round(totalSaved * 100) / 100,
        topCategory,
        topMerchant,
        transactionCount,
        averageTransaction: Math.round(averageTransaction * 100) / 100,
        biggestPurchase: Math.round(biggestPurchase * 100) / 100,
        biggestPurchaseDescription: biggestPurchaseDescription || null,
        monthlyBreakdown: JSON.stringify(monthlyBreakdown),
        categoryBreakdown: JSON.stringify(categoryBreakdownEntries),
        generatedAt: new Date().toISOString(),
      })
      .returning();

    return {
      ...review,
      monthlyBreakdown,
      categoryBreakdown: categoryBreakdownEntries,
    };
  }

  async getReview(userId: string, year: number) {
    const [review] = await this.db
      .select()
      .from(schema.yearReviews)
      .where(
        and(
          eq(schema.yearReviews.userId, userId),
          eq(schema.yearReviews.year, year),
        ),
      )
      .limit(1);

    if (!review) return null;

    return {
      ...review,
      monthlyBreakdown: review.monthlyBreakdown
        ? JSON.parse(review.monthlyBreakdown)
        : [],
      categoryBreakdown: review.categoryBreakdown
        ? JSON.parse(review.categoryBreakdown)
        : [],
    };
  }

  async getAvailableYears(userId: string) {
    const rows = await this.db
      .select({
        year: sql<number>`CAST(strftime('%Y', ${schema.transactions.date}) AS INTEGER)`.as(
          'year',
        ),
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .groupBy(sql`strftime('%Y', ${schema.transactions.date})`)
      .orderBy(
        desc(
          sql`CAST(strftime('%Y', ${schema.transactions.date}) AS INTEGER)`,
        ),
      );

    return rows.map((r) => r.year);
  }
}
