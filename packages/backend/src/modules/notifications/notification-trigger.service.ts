import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import {
  NotificationsService,
  NotificationType,
  NotificationSeverity,
} from './notifications.service';
import { EmailService } from '../email/email.service';

/**
 * High-level trigger methods that compose notification creation with
 * user preference checks. Every public method in this service:
 *
 *  1. Loads the user's notification preferences
 *  2. Decides whether to send based on those preferences
 *  3. Delegates to NotificationsService.createNotification()
 *  4. Sends an email via EmailService if the preference is enabled
 *
 * Other modules (budgets, anomalies, bills, etc.) should inject this
 * service rather than calling NotificationsService directly.
 */
@Injectable()
export class NotificationTriggerService {
  private readonly logger = new Logger(NotificationTriggerService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly emailService?: EmailService,
  ) {}

  // ── Bill Reminder ───────────────────────────────────────────────
  async triggerBillReminder(
    userId: string,
    billName: string,
    amount: number,
    dueDate: string,
    daysBefore: number,
  ) {
    const prefs = await this.getPreferences(userId);

    if (prefs && !prefs.emailBillReminders) {
      this.logger.debug(`Bill reminder suppressed for user=${userId} (preference off)`);
      return null;
    }

    const severity =
      daysBefore <= 1
        ? NotificationSeverity.CRITICAL
        : daysBefore <= 3
          ? NotificationSeverity.WARNING
          : NotificationSeverity.INFO;

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

    const title =
      daysBefore === 0
        ? `${billName} is due today`
        : daysBefore === 1
          ? `${billName} is due tomorrow`
          : `${billName} is due in ${daysBefore} days`;

    const message = `Your ${billName} payment of ${formattedAmount} is due on ${dueDate}.`;

    const notification = await this.notificationsService.createNotification(
      userId,
      NotificationType.BILL_REMINDER,
      title,
      message,
      severity,
      '/bills',
    );

    // Send email if preference is enabled (default: enabled)
    if (!prefs || prefs.emailBillReminders) {
      await this.sendEmailForUser(userId, (email) =>
        this.emailService!.sendBillReminder(email, {
          billName,
          amount,
          dueDate,
        }),
      );
    }

    return notification;
  }

  // ── Budget Alert ────────────────────────────────────────────────
  async triggerBudgetAlert(
    userId: string,
    budgetName: string,
    percentUsed: number,
    amount: number,
    limit: number,
  ) {
    const prefs = await this.getPreferences(userId);

    if (prefs && !prefs.emailBudgetAlerts) {
      this.logger.debug(`Budget alert suppressed for user=${userId} (preference off)`);
      return null;
    }

    const severity =
      percentUsed >= 100
        ? NotificationSeverity.CRITICAL
        : percentUsed >= 90
          ? NotificationSeverity.WARNING
          : NotificationSeverity.INFO;

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
    const formattedLimit = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(limit);

    const roundedPercent = Math.round(percentUsed);

    let title: string;
    if (percentUsed >= 100) {
      title = `${budgetName} budget exceeded`;
    } else {
      title = `${budgetName} budget at ${roundedPercent}%`;
    }

    const message = `You've spent ${formattedAmount} of your ${formattedLimit} ${budgetName} budget (${roundedPercent}%).`;

    const notification = await this.notificationsService.createNotification(
      userId,
      NotificationType.BUDGET_ALERT,
      title,
      message,
      severity,
      '/budgets',
    );

    // Send email if preference is enabled (default: enabled)
    if (!prefs || prefs.emailBudgetAlerts) {
      await this.sendEmailForUser(userId, (email) =>
        this.emailService!.sendBudgetAlert(email, {
          budgetName,
          amountSpent: amount,
          budgetLimit: limit,
          percentUsed,
        }),
      );
    }

    return notification;
  }

  // ── Anomaly Alert ───────────────────────────────────────────────
  async triggerAnomalyAlert(
    userId: string,
    anomalyType: string,
    description: string,
    transaction?: { id: string; name: string; amount: number },
  ) {
    const prefs = await this.getPreferences(userId);

    if (prefs && !prefs.emailAnomalies) {
      this.logger.debug(`Anomaly alert suppressed for user=${userId} (preference off)`);
      return null;
    }

    const titleMap: Record<string, string> = {
      unusual_amount: 'Unusual transaction amount detected',
      unusual_merchant: 'Transaction from unfamiliar merchant',
      unusual_timing: 'Transaction at unusual time',
      duplicate_charge: 'Possible duplicate charge detected',
      velocity_spike: 'Unusual spending velocity',
      geographic_anomaly: 'Transaction from unusual location',
      category_spending_spike: 'Spending spike in category',
      recurring_charge_change: 'Recurring charge amount changed',
    };

    const title = titleMap[anomalyType] ?? 'Unusual activity detected';

    let message = description;
    if (transaction) {
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Math.abs(transaction.amount));
      message += ` Transaction: ${transaction.name} for ${formattedAmount}.`;
    }

    const actionUrl = transaction ? `/transactions/${transaction.id}` : '/anomalies';

    const notification = await this.notificationsService.createNotification(
      userId,
      NotificationType.ANOMALY_DETECTED,
      title,
      message,
      NotificationSeverity.WARNING,
      actionUrl,
    );

    // Send email if preference is enabled (default: enabled)
    if (!prefs || prefs.emailAnomalies) {
      const today = new Date().toISOString().split('T')[0];
      await this.sendEmailForUser(userId, (email) =>
        this.emailService!.sendAnomalyAlert(email, {
          merchantName: transaction?.name ?? 'Unknown Merchant',
          amount: transaction?.amount ?? 0,
          date: today,
          reason: description,
          transactionId: transaction?.id,
        }),
      );
    }

    return notification;
  }

  // ── Goal Milestone ──────────────────────────────────────────────
  async triggerGoalMilestone(
    userId: string,
    goalName: string,
    milestone: number,
    currentAmount: number,
  ) {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(currentAmount);

    let title: string;
    let severity: NotificationSeverity;

    if (milestone >= 100) {
      title = `Goal achieved: ${goalName}!`;
      severity = NotificationSeverity.INFO;
    } else {
      title = `${goalName} is ${milestone}% complete`;
      severity = NotificationSeverity.INFO;
    }

    const message =
      milestone >= 100
        ? `Congratulations! You've reached your ${goalName} savings goal with ${formattedAmount} saved.`
        : `You've saved ${formattedAmount} toward your ${goalName} goal (${milestone}% complete).`;

    return this.notificationsService.createNotification(
      userId,
      NotificationType.GOAL_MILESTONE,
      title,
      message,
      severity,
      '/savings-goals',
    );
  }

  // ── Security Alert ──────────────────────────────────────────────
  async triggerSecurityAlert(
    userId: string,
    eventType: string,
    details: string,
    meta?: { device?: string; ipAddress?: string; location?: string },
  ) {
    // Security alerts are always sent regardless of preferences

    const titleMap: Record<string, string> = {
      login_new_device: 'New device login detected',
      password_changed: 'Password changed',
      two_factor_enabled: 'Two-factor authentication enabled',
      two_factor_disabled: 'Two-factor authentication disabled',
      failed_login_attempts: 'Multiple failed login attempts',
      session_revoked: 'Session revoked',
      account_locked: 'Account temporarily locked',
    };

    const title = titleMap[eventType] ?? 'Security event detected';

    const notification = await this.notificationsService.createNotification(
      userId,
      NotificationType.SECURITY_ALERT,
      title,
      details,
      NotificationSeverity.CRITICAL,
      '/settings/security',
    );

    // Security emails are always sent (never suppressed by preferences)
    await this.sendEmailForUser(userId, (email) =>
      this.emailService!.sendSecurityAlert(email, {
        eventType,
        eventTitle: title,
        details,
        device: meta?.device,
        ipAddress: meta?.ipAddress,
        location: meta?.location,
        timestamp: new Date().toISOString(),
      }),
    );

    return notification;
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /**
   * Look up user email and send email via EmailService.
   * Swallows errors so that a failed email never breaks
   * the in-app notification flow.
   */
  private async sendEmailForUser(
    userId: string,
    sender: (email: string) => Promise<boolean>,
  ): Promise<void> {
    if (!this.emailService) {
      return;
    }

    try {
      const userEmail = await this.getUserEmail(userId);
      if (!userEmail) {
        this.logger.warn(`No email found for user=${userId}, skipping email`);
        return;
      }

      await sender(userEmail);
    } catch (error) {
      this.logger.error(`Failed to send email for user=${userId}: ${error}`);
    }
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    const [user] = await this.db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user?.email ?? null;
  }

  private async getPreferences(userId: string) {
    const [prefs] = await this.db
      .select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, userId))
      .limit(1);

    return prefs ?? null;
  }
}
