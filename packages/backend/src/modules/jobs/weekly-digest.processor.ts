import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, and, gte, lte } from 'drizzle-orm';
import { QUEUES } from './jobs.module';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { notificationPreferences } from '../notifications/notification-preferences.schema';
import { EmailService } from '../email/email.service';
import type { WeeklyDigestData } from '../email/templates';

@Processor(QUEUES.ALERTS, { name: 'weekly-digest-worker' })
export class WeeklyDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(WeeklyDigestProcessor.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'weekly-digest') return;

    this.logger.log('Running weekly digest generation');

    const users = await this.db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users);

    let sentCount = 0;

    for (const user of users) {
      try {
        const sent = await this.processUserDigest(user.id, user.email);
        if (sent) sentCount++;
      } catch (error) {
        this.logger.error(`Weekly digest failed for user ${user.id}: ${error}`);
      }
    }

    this.logger.log(`Weekly digest complete: ${sentCount} emails sent for ${users.length} users`);
  }

  private async processUserDigest(userId: string, userEmail: string): Promise<boolean> {
    // Check if user has weekly digest enabled
    const [prefs] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // Default to enabled if no preferences exist
    const digestEnabled = prefs?.emailWeeklyDigest ?? 1;
    if (!digestEnabled) return false;

    // Calculate date range (past 7 days)
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Aggregate weekly spending
    const digestData = await this.aggregateWeeklyData(userId, startStr, endStr);

    // Only send if there is data to report
    if (
      digestData.totalExpenses === 0 &&
      digestData.totalIncome === 0 &&
      digestData.upcomingBills.length === 0
    ) {
      return false;
    }

    return this.emailService.sendWeeklyDigest(userEmail, digestData);
  }

  private async aggregateWeeklyData(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Omit<WeeklyDigestData, 'appUrl' | 'settingsUrl'>> {
    // Get all transactions for the week
    const transactions = await this.db
      .select({
        amount: schema.transactions.amount,
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
        ),
      );

    // Calculate income (negative amounts) and expenses (positive amounts)
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals = new Map<string, { name: string; amount: number }>();

    for (const tx of transactions) {
      if (tx.amount > 0) {
        totalExpenses += tx.amount;

        const categoryName = tx.categoryName || 'Uncategorized';
        const existing = categoryTotals.get(categoryName);
        if (existing) {
          existing.amount += tx.amount;
        } else {
          categoryTotals.set(categoryName, {
            name: categoryName,
            amount: tx.amount,
          });
        }
      } else {
        totalIncome += Math.abs(tx.amount);
      }
    }

    // Sort categories by amount descending, take top 5
    const topCategories = Array.from(categoryTotals.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((cat) => ({
        name: cat.name,
        amount: Math.round(cat.amount * 100) / 100,
      }));

    // Get upcoming bills for the next 7 days
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const todayStr = today.toISOString().split('T')[0];
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const upcomingSubscriptions = await this.db
      .select({
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
          eq(schema.recurringTransactions.isConfirmed, true),
          gte(schema.recurringTransactions.nextExpectedDate, todayStr),
          lte(schema.recurringTransactions.nextExpectedDate, nextWeekStr),
        ),
      );

    const upcomingBills = upcomingSubscriptions.map((sub) => ({
      name: sub.merchantName || sub.name,
      amount: sub.estimatedAmount,
      dueDate: sub.nextExpectedDate!,
    }));

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      net: Math.round((totalIncome - totalExpenses) * 100) / 100,
      topCategories,
      upcomingBills,
      budgetStatuses: [],
    };
  }
}
