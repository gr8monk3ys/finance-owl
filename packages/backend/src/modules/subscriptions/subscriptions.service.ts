import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface SubscriptionSummary {
  monthlyTotal: number;
  annualTotal: number;
  activeCount: number;
  byCategory: {
    categoryId: string | null;
    categoryName: string | null;
    categoryColor: string | null;
    total: number;
    count: number;
  }[];
}

export interface UpcomingBill {
  id: string;
  name: string;
  merchantName: string | null;
  estimatedAmount: number;
  frequency: string;
  expectedDate: string;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface PriceChange {
  subscriptionId: string;
  name: string;
  merchantName: string | null;
  estimatedAmount: number;
  latestAmount: number;
  changePercent: number;
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
export class SubscriptionsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async findAll(userId: string) {
    return this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
        isActive: schema.recurringTransactions.isActive,
        isConfirmed: schema.recurringTransactions.isConfirmed,
        accountId: schema.recurringTransactions.accountId,
        categoryId: schema.recurringTransactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        createdAt: schema.recurringTransactions.createdAt,
        updatedAt: schema.recurringTransactions.updatedAt,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.categories,
        eq(schema.recurringTransactions.categoryId, schema.categories.id),
      )
      .where(eq(schema.recurringTransactions.userId, userId))
      .orderBy(schema.recurringTransactions.nextExpectedDate);
  }

  async findOne(userId: string, id: string) {
    const [subscription] = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
        isActive: schema.recurringTransactions.isActive,
        isConfirmed: schema.recurringTransactions.isConfirmed,
        accountId: schema.recurringTransactions.accountId,
        categoryId: schema.recurringTransactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        createdAt: schema.recurringTransactions.createdAt,
        updatedAt: schema.recurringTransactions.updatedAt,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.categories,
        eq(schema.recurringTransactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.recurringTransactions.id, id),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .limit(1);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async confirm(userId: string, id: string) {
    await this.findOne(userId, id);

    const [updated] = await this.db
      .update(schema.recurringTransactions)
      .set({
        isConfirmed: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.recurringTransactions.id, id),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async dismiss(userId: string, id: string) {
    await this.findOne(userId, id);

    const [updated] = await this.db
      .update(schema.recurringTransactions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.recurringTransactions.id, id),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async create(
    userId: string,
    data: {
      name: string;
      merchantName?: string;
      estimatedAmount: number;
      frequency: string;
      categoryId?: string;
      nextExpectedDate?: string;
    },
  ) {
    const [subscription] = await this.db
      .insert(schema.recurringTransactions)
      .values({
        userId,
        name: data.name,
        merchantName: data.merchantName ?? null,
        estimatedAmount: data.estimatedAmount,
        frequency: data.frequency,
        categoryId: data.categoryId ?? null,
        nextExpectedDate: data.nextExpectedDate ?? null,
        isActive: true,
        isConfirmed: true,
      })
      .returning();

    return subscription;
  }

  async update(
    userId: string,
    id: string,
    data: {
      name?: string;
      merchantName?: string;
      estimatedAmount?: number;
      frequency?: string;
      categoryId?: string;
      nextExpectedDate?: string;
    },
  ) {
    await this.findOne(userId, id);

    const [updated] = await this.db
      .update(schema.recurringTransactions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.recurringTransactions.id, id),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.db
      .delete(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.id, id),
          eq(schema.recurringTransactions.userId, userId),
        ),
      );
  }

  async getSummary(userId: string): Promise<SubscriptionSummary> {
    const subscriptions = await this.db
      .select({
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        categoryId: schema.recurringTransactions.categoryId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.categories,
        eq(schema.recurringTransactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    let monthlyTotal = 0;
    const categoryMap = new Map<
      string | null,
      {
        categoryId: string | null;
        categoryName: string | null;
        categoryColor: string | null;
        total: number;
        count: number;
      }
    >();

    for (const sub of subscriptions) {
      const multiplier = FREQUENCY_MONTHLY_MULTIPLIER[sub.frequency] ?? 1;
      const monthlyAmount = sub.estimatedAmount * multiplier;
      monthlyTotal += monthlyAmount;

      const key = sub.categoryId ?? '__uncategorized__';
      const existing = categoryMap.get(key);

      if (existing) {
        existing.total += monthlyAmount;
        existing.count += 1;
      } else {
        categoryMap.set(key, {
          categoryId: sub.categoryId,
          categoryName: sub.categoryName,
          categoryColor: sub.categoryColor,
          total: monthlyAmount,
          count: 1,
        });
      }
    }

    return {
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      annualTotal: Math.round(monthlyTotal * 12 * 100) / 100,
      activeCount: subscriptions.length,
      byCategory: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
    };
  }

  async getUpcomingBills(userId: string, days: number = 30): Promise<UpcomingBill[]> {
    const activeSubscriptions = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.categories,
        eq(schema.recurringTransactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const bills: UpcomingBill[] = [];

    for (const sub of activeSubscriptions) {
      const projectedDates = this.projectDates(sub.nextExpectedDate, sub.frequency, today, endDate);

      for (const date of projectedDates) {
        bills.push({
          id: sub.id,
          name: sub.name,
          merchantName: sub.merchantName,
          estimatedAmount: sub.estimatedAmount,
          frequency: sub.frequency,
          expectedDate: date,
          categoryName: sub.categoryName,
          categoryColor: sub.categoryColor,
        });
      }
    }

    bills.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());

    return bills;
  }

  async detectPriceChanges(userId: string): Promise<PriceChange[]> {
    const activeSubscriptions = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    const changes: PriceChange[] = [];

    for (const sub of activeSubscriptions) {
      const merchantKey = sub.merchantName ?? sub.name;

      const [latestTx] = await this.db
        .select({ amount: schema.transactions.amount })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            sql`LOWER(COALESCE(${schema.transactions.merchantName}, ${schema.transactions.name})) = LOWER(${merchantKey})`,
          ),
        )
        .orderBy(desc(schema.transactions.date))
        .limit(1);

      if (!latestTx) {
        continue;
      }

      const latestAmount = Math.abs(latestTx.amount);
      const changePercent =
        sub.estimatedAmount > 0
          ? ((latestAmount - sub.estimatedAmount) / sub.estimatedAmount) * 100
          : 0;

      if (Math.abs(changePercent) > 10) {
        changes.push({
          subscriptionId: sub.id,
          name: sub.name,
          merchantName: sub.merchantName,
          estimatedAmount: sub.estimatedAmount,
          latestAmount,
          changePercent: Math.round(changePercent * 100) / 100,
        });
      }
    }

    return changes;
  }

  private projectDates(
    nextExpectedDate: string | null,
    frequency: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): string[] {
    if (!nextExpectedDate) {
      return [];
    }

    const intervalDays = FREQUENCY_DAYS[frequency] ?? 30;
    const dates: string[] = [];
    const current = new Date(nextExpectedDate + 'T00:00:00');

    // Move forward if date is in the past
    while (current < rangeStart) {
      current.setDate(current.getDate() + intervalDays);
    }

    // Collect dates within range
    while (current <= rangeEnd) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + intervalDays);
    }

    return dates;
  }
}
