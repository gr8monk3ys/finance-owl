import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { notificationPreferences } from '../notifications/notification-preferences.schema';
import {
  NotificationSeverity,
  NotificationType,
  NotificationsService,
} from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { planBillReminders, type PlannedBillReminder } from './bill-reminder-window';

/**
 * The single bill-reminder implementation.
 *
 * It reads rows, hands the window arithmetic to `planBillReminders`, and
 * writes whatever that decides. The decision of *which* bills to remind about
 * lives in the pure function; everything here is I/O.
 */
@Injectable()
export class BillReminderService {
  private readonly logger = new Logger(BillReminderService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    private readonly notifications: NotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async run(now: Date = new Date()): Promise<number> {
    this.logger.log('Running daily bill reminder check');

    const users = await this.db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users);

    let totalReminders = 0;

    for (const user of users) {
      try {
        totalReminders += await this.remindUser(user.id, user.email, now);
      } catch (error) {
        this.logger.error(`Bill reminder processing failed for user ${user.id}: ${error}`);
      }
    }

    this.logger.log(
      `Bill reminder check complete: ${totalReminders} reminders sent for ${users.length} users`,
    );

    return totalReminders;
  }

  private async remindUser(userId: string, userEmail: string, now: Date): Promise<number> {
    const [prefs] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

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

    const planned = planBillReminders(prefs ?? null, subscriptions, now);
    if (planned.length === 0) return 0;

    const alreadyReminded = await this.subscriptionsRemindedToday(userId, now);

    let sent = 0;

    for (const reminder of planned) {
      if (alreadyReminded.has(reminder.subscriptionId)) continue;

      // Written here rather than through NotificationsService.createNotification
      // because the `data` payload is what makes same-day deduplication
      // possible, and that method has no parameter for it.
      const [notification] = await this.db
        .insert(schema.notifications)
        .values({
          userId,
          type: NotificationType.BILL_REMINDER,
          severity: severityFor(reminder.daysUntilDue),
          title: `${reminder.billName} is due ${reminder.dueLabel}`,
          body:
            `Your ${reminder.frequency} payment of ${formatUsd(reminder.amount)} ` +
            `for ${reminder.billName} is due ${reminder.dueLabel}.`,
          actionUrl: '/bills',
          data: JSON.stringify({
            subscriptionId: reminder.subscriptionId,
            billName: reminder.billName,
            amount: reminder.amount,
            dueDate: reminder.dueDate,
            frequency: reminder.frequency,
          }),
        })
        .returning();

      // Keep the SSE endpoint live: subscribers see the reminder without a reload.
      if (notification) {
        this.notifications.notificationStream$.next({ userId, notification });
      }

      if (reminder.sendEmail) {
        await this.emailService.sendBillReminder(userEmail, {
          billName: reminder.billName,
          amount: reminder.amount,
          dueDate: reminder.dueDate,
        });
      }

      sent++;
    }

    return sent;
  }

  /**
   * Bills already reminded about today, so a re-run (a retry, a redeploy, an
   * operator kicking the queue) does not double-notify.
   *
   * Read in one query and matched in memory: the previous implementation
   * filtered with `json_extract(...)`, which is SQLite and throws on the
   * Postgres this application actually runs.
   */
  private async subscriptionsRemindedToday(userId: string, now: Date): Promise<Set<string>> {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const rows = await this.db
      .select({ data: schema.notifications.data })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.type, NotificationType.BILL_REMINDER),
          gte(schema.notifications.createdAt, startOfToday),
        ),
      );

    const ids = new Set<string>();

    for (const row of rows) {
      const subscriptionId = readSubscriptionId(row.data);
      if (subscriptionId) ids.add(subscriptionId);
    }

    return ids;
  }
}

function severityFor(daysUntilDue: PlannedBillReminder['daysUntilDue']): NotificationSeverity {
  if (daysUntilDue <= 1) return NotificationSeverity.CRITICAL;
  if (daysUntilDue <= 3) return NotificationSeverity.WARNING;
  return NotificationSeverity.INFO;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function readSubscriptionId(data: string | null): string | null {
  if (!data) return null;

  try {
    const parsed = JSON.parse(data) as { subscriptionId?: unknown };
    return typeof parsed.subscriptionId === 'string' ? parsed.subscriptionId : null;
  } catch {
    return null;
  }
}
