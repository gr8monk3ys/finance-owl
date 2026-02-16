import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, and, sql } from 'drizzle-orm';
import { QUEUES } from './jobs.module';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { notificationPreferences } from '../notifications/notification-preferences.schema';
import { EmailService } from '../email/email.service';

@Processor(QUEUES.ALERTS, { name: 'bill-reminder-worker' })
export class BillReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(BillReminderProcessor.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'daily-bill-reminder') return;

    this.logger.log('Running daily bill reminder check');

    const users = await this.db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users);

    let totalReminders = 0;

    for (const user of users) {
      try {
        const count = await this.processUserBillReminders(user.id, user.email);
        totalReminders += count;
      } catch (error) {
        this.logger.error(
          `Bill reminder processing failed for user ${user.id}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Bill reminder check complete: ${totalReminders} reminders sent for ${users.length} users`,
    );
  }

  private async processUserBillReminders(
    userId: string,
    userEmail: string,
  ): Promise<number> {
    // Get user notification preferences
    const [prefs] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // Default to 3 days before if no preferences set
    const daysBefore = prefs?.billReminderDaysBefore ?? 3;
    const emailEnabled = prefs?.emailBillReminders ?? 1;

    // Query all active confirmed recurring transactions for this user
    const subscriptions = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        nextExpectedDate: schema.recurringTransactions.nextExpectedDate,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
          eq(schema.recurringTransactions.isConfirmed, true),
        ),
      );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() + daysBefore);

    let reminderCount = 0;

    for (const sub of subscriptions) {
      if (!sub.nextExpectedDate) continue;

      const dueDate = new Date(sub.nextExpectedDate + 'T00:00:00');

      // Check if the due date falls within the reminder window (today to cutoff)
      if (dueDate < today || dueDate > cutoffDate) continue;

      // Check if we already created a notification for this bill today
      const existingNotification = await this.findExistingReminder(
        userId,
        sub.id,
        today,
      );

      if (existingNotification) continue;

      // Create in-app notification
      const billName = sub.merchantName || sub.name;
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      const dueLabel =
        daysUntilDue === 0
          ? 'today'
          : daysUntilDue === 1
            ? 'tomorrow'
            : `in ${daysUntilDue} days`;

      await this.db.insert(schema.notifications).values({
        userId,
        type: 'bill_reminder',
        title: `Upcoming Bill: ${billName}`,
        body: `Your ${sub.frequency} payment of $${sub.estimatedAmount.toFixed(2)} for ${billName} is due ${dueLabel}.`,
        data: JSON.stringify({
          subscriptionId: sub.id,
          billName,
          amount: sub.estimatedAmount,
          dueDate: sub.nextExpectedDate,
          frequency: sub.frequency,
        }),
      });

      // Send email if user has email bill reminders enabled
      if (emailEnabled) {
        await this.emailService.sendBillReminder(userEmail, {
          billName,
          amount: sub.estimatedAmount,
          dueDate: sub.nextExpectedDate,
        });
      }

      reminderCount++;
    }

    return reminderCount;
  }

  private async findExistingReminder(
    userId: string,
    subscriptionId: string,
    today: Date,
  ): Promise<boolean> {
    const todayStr = today.toISOString().split('T')[0];

    const [existing] = await this.db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.type, 'bill_reminder'),
          sql`json_extract(${schema.notifications.data}, '$.subscriptionId') = ${subscriptionId}`,
          sql`date(${schema.notifications.createdAt}) = ${todayStr}`,
        ),
      )
      .limit(1);

    return !!existing;
  }
}
