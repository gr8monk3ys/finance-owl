import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface CalendarBill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: string;
  isPaid: boolean;
  isOverdue: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  accountName?: string;
}

export interface CalendarDay {
  date: string; // ISO date YYYY-MM-DD
  bills: CalendarBill[];
  totalDue: number;
  isToday: boolean;
  isPast: boolean;
}

export interface MonthSummary {
  totalDue: number;
  totalPaid: number;
  totalUpcoming: number;
  billCount: number;
  paidCount: number;
  overdueCount: number;
  nextDueDate?: string;
  nextDueAmount?: number;
}

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annual: 365,
  yearly: 365,
};

@Injectable()
export class BillsCalendarService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Get all bills/recurring transactions for a date range
   */
  async getUpcomingBills(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarBill[]> {
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
        accountName: schema.accounts.name,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.categories,
        eq(schema.recurringTransactions.categoryId, schema.categories.id),
      )
      .leftJoin(
        schema.accounts,
        eq(schema.recurringTransactions.accountId, schema.accounts.id),
      )
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    // Get transactions in the range to determine paid status
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const paidTransactions = await this.db
      .select({
        merchantName: schema.transactions.merchantName,
        name: schema.transactions.name,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startStr),
          lte(schema.transactions.date, endStr),
        ),
      );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const bills: CalendarBill[] = [];

    for (const sub of activeSubscriptions) {
      const projectedDates = this.projectDates(
        sub.nextExpectedDate,
        sub.frequency,
        startDate,
        endDate,
      );

      for (const dateStr of projectedDates) {
        // Check if a matching transaction exists (paid)
        const isPaid = this.isBillPaid(
          sub.merchantName ?? sub.name,
          sub.estimatedAmount,
          dateStr,
          paidTransactions,
        );

        const normalizedFreq = this.normalizeFrequency(sub.frequency);

        bills.push({
          id: sub.id,
          name: sub.merchantName ?? sub.name,
          amount: sub.estimatedAmount,
          dueDate: new Date(dateStr + 'T00:00:00'),
          category: sub.categoryName ?? 'Uncategorized',
          isPaid,
          isOverdue: !isPaid && dateStr < todayStr,
          frequency: normalizedFreq,
          accountName: sub.accountName ?? undefined,
        });
      }
    }

    bills.sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
    );

    return bills;
  }

  /**
   * Get monthly calendar with bills mapped to dates
   */
  async getMonthlyCalendar(
    userId: string,
    year: number,
    month: number,
  ): Promise<CalendarDay[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month

    const bills = await this.getUpcomingBills(userId, startDate, endDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Build map of bills by date
    const billsByDate = new Map<string, CalendarBill[]>();
    for (const bill of bills) {
      const dateStr = bill.dueDate.toISOString().split('T')[0];
      if (!billsByDate.has(dateStr)) {
        billsByDate.set(dateStr, []);
      }
      billsByDate.get(dateStr)!.push(bill);
    }

    // Generate calendar days for the entire month
    const daysInMonth = endDate.getDate();
    const calendarDays: CalendarDay[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayBills = billsByDate.get(dateStr) ?? [];

      calendarDays.push({
        date: dateStr,
        bills: dayBills,
        totalDue: dayBills
          .filter((b) => !b.isPaid)
          .reduce((sum, b) => sum + b.amount, 0),
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
      });
    }

    return calendarDays;
  }

  /**
   * Get weekly view - 7 days starting from startDate
   */
  async getWeeklyView(
    userId: string,
    startDate: Date,
  ): Promise<CalendarDay[]> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const bills = await this.getUpcomingBills(userId, startDate, endDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Build map of bills by date
    const billsByDate = new Map<string, CalendarBill[]>();
    for (const bill of bills) {
      const dateStr = bill.dueDate.toISOString().split('T')[0];
      if (!billsByDate.has(dateStr)) {
        billsByDate.set(dateStr, []);
      }
      billsByDate.get(dateStr)!.push(bill);
    }

    // Generate 7 days
    const calendarDays: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayBills = billsByDate.get(dateStr) ?? [];

      calendarDays.push({
        date: dateStr,
        bills: dayBills,
        totalDue: dayBills
          .filter((b) => !b.isPaid)
          .reduce((sum, b) => sum + b.amount, 0),
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
      });
    }

    return calendarDays;
  }

  /**
   * Mark a bill as paid by creating a matching transaction
   */
  async markBillPaid(userId: string, billId: string): Promise<void> {
    // Find the recurring transaction
    const [subscription] = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        accountId: schema.recurringTransactions.accountId,
        categoryId: schema.recurringTransactions.categoryId,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.id, billId),
          eq(schema.recurringTransactions.userId, userId),
        ),
      )
      .limit(1);

    if (!subscription) {
      throw new NotFoundException('Bill not found');
    }

    const today = new Date().toISOString().split('T')[0];

    // Create a manual transaction to represent the payment
    if (subscription.accountId) {
      await this.db.insert(schema.transactions).values({
        userId,
        accountId: subscription.accountId,
        amount: -subscription.estimatedAmount, // negative = outflow
        name: subscription.name,
        merchantName: subscription.merchantName,
        categoryId: subscription.categoryId,
        date: today,
        pending: false,
        categorizationSource: 'manual',
        isManual: true,
      });
    }

    // Advance the next expected date
    const intervalDays = FREQUENCY_DAYS[subscription.frequency] ?? 30;
    const nextDate = new Date(
      subscription.nextExpectedDate
        ? subscription.nextExpectedDate + 'T00:00:00'
        : today + 'T00:00:00',
    );
    nextDate.setDate(nextDate.getDate() + intervalDays);

    await this.db
      .update(schema.recurringTransactions)
      .set({
        nextExpectedDate: nextDate.toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(schema.recurringTransactions.id, billId));
  }

  /**
   * Get bill summary for a month (total due, paid, upcoming)
   */
  async getMonthSummary(
    userId: string,
    year: number,
    month: number,
  ): Promise<MonthSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const bills = await this.getUpcomingBills(userId, startDate, endDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const totalDue = bills.reduce((sum, b) => sum + b.amount, 0);
    const paidBills = bills.filter((b) => b.isPaid);
    const totalPaid = paidBills.reduce((sum, b) => sum + b.amount, 0);
    const overdueBills = bills.filter((b) => b.isOverdue);
    const upcomingBills = bills.filter(
      (b) => !b.isPaid && !b.isOverdue,
    );
    const totalUpcoming = upcomingBills.reduce(
      (sum, b) => sum + b.amount,
      0,
    );

    // Find next due bill
    const futureBills = bills
      .filter((b) => !b.isPaid && b.dueDate.toISOString().split('T')[0] >= todayStr)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return {
      totalDue: Math.round(totalDue * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalUpcoming: Math.round(totalUpcoming * 100) / 100,
      billCount: bills.length,
      paidCount: paidBills.length,
      overdueCount: overdueBills.length,
      nextDueDate: futureBills[0]?.dueDate.toISOString().split('T')[0],
      nextDueAmount: futureBills[0]?.amount,
    };
  }

  /**
   * Project recurring dates into a given range
   */
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

    // Move forward if date is in the past relative to range start
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

  /**
   * Check if a bill has been paid by looking for a matching transaction
   */
  private isBillPaid(
    merchantOrName: string,
    estimatedAmount: number,
    dateStr: string,
    transactions: {
      merchantName: string | null;
      name: string;
      amount: number;
      date: string;
    }[],
  ): boolean {
    const lowerMerchant = merchantOrName.toLowerCase();

    // Look for a transaction within 3 days of the due date that matches
    const dueDate = new Date(dateStr + 'T00:00:00');
    const windowStart = new Date(dueDate);
    windowStart.setDate(windowStart.getDate() - 3);
    const windowEnd = new Date(dueDate);
    windowEnd.setDate(windowEnd.getDate() + 3);

    const startStr = windowStart.toISOString().split('T')[0];
    const endStr = windowEnd.toISOString().split('T')[0];

    return transactions.some((tx) => {
      const txMerchant = (tx.merchantName ?? tx.name).toLowerCase();
      const amountMatch =
        Math.abs(Math.abs(tx.amount) - estimatedAmount) <
        estimatedAmount * 0.15; // 15% tolerance
      const dateMatch = tx.date >= startStr && tx.date <= endStr;
      const nameMatch = txMerchant.includes(lowerMerchant) ||
        lowerMerchant.includes(txMerchant);

      return nameMatch && amountMatch && dateMatch;
    });
  }

  /**
   * Normalize frequency string to the CalendarBill type
   */
  private normalizeFrequency(
    freq: string,
  ): 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' {
    const map: Record<string, CalendarBill['frequency']> = {
      weekly: 'weekly',
      biweekly: 'biweekly',
      monthly: 'monthly',
      quarterly: 'quarterly',
      annual: 'yearly',
      yearly: 'yearly',
    };
    return map[freq] ?? 'monthly';
  }
}
