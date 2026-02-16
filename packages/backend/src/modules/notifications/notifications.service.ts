import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { Subject } from 'rxjs';
import {
  DATABASE_TOKEN,
  type DrizzleDB,
} from '../../database/database.module';
import * as schema from '../../database/schema';

// ── Notification Types ──────────────────────────────────────────────
export enum NotificationType {
  BILL_REMINDER = 'bill_reminder',
  BUDGET_ALERT = 'budget_alert',
  ANOMALY_DETECTED = 'anomaly_detected',
  GOAL_MILESTONE = 'goal_milestone',
  SUBSCRIPTION_CHANGE = 'subscription_change',
  SECURITY_ALERT = 'security_alert',
  SYSTEM = 'system',
}

export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

// ── Interfaces ──────────────────────────────────────────────────────
export interface NotificationEvent {
  userId: string;
  notification: typeof schema.notifications.$inferSelect;
}

export interface ListNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /**
   * RxJS Subject used by the SSE endpoint. Every call to
   * createNotification() pushes an event here so connected
   * clients get real-time updates.
   */
  readonly notificationStream$ = new Subject<NotificationEvent>();

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  // ── Create ──────────────────────────────────────────────────────
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    severity: NotificationSeverity = NotificationSeverity.INFO,
    actionUrl?: string,
  ) {
    const [notification] = await this.db
      .insert(schema.notifications)
      .values({
        userId,
        type,
        severity,
        title,
        body: message,
        actionUrl: actionUrl ?? null,
        read: false,
        deleted: false,
      })
      .returning();

    this.logger.debug(
      `Notification created: type=${type} user=${userId} id=${notification.id}`,
    );

    // Push to the real-time stream
    this.notificationStream$.next({ userId, notification });

    return notification;
  }

  // ── List (paginated, filterable) ────────────────────────────────
  async getUserNotifications(
    userId: string,
    options: ListNotificationsOptions = {},
  ) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const conditions = [
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.deleted, false),
    ];

    if (unreadOnly) {
      conditions.push(eq(schema.notifications.read, false));
    }

    const items = await this.db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await this.db
      .select({ total: count() })
      .from(schema.notifications)
      .where(and(...conditions));

    return {
      items,
      total: totalResult?.total ?? 0,
      limit,
      offset,
    };
  }

  // ── Mark single as read ─────────────────────────────────────────
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.findByIdOrThrow(userId, notificationId);

    if (notification.read) {
      return notification;
    }

    const [updated] = await this.db
      .update(schema.notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  // ── Mark all as read ────────────────────────────────────────────
  async markAllAsRead(userId: string) {
    const result = await this.db
      .update(schema.notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, false),
          eq(schema.notifications.deleted, false),
        ),
      )
      .returning();

    return { updated: result.length };
  }

  // ── Soft delete ─────────────────────────────────────────────────
  async deleteNotification(userId: string, notificationId: string) {
    await this.findByIdOrThrow(userId, notificationId);

    await this.db
      .update(schema.notifications)
      .set({ deleted: true, deletedAt: new Date() })
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId),
        ),
      );
  }

  // ── Unread count ────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const [result] = await this.db
      .select({ total: count() })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, false),
          eq(schema.notifications.deleted, false),
        ),
      );

    return { count: result?.total ?? 0 };
  }

  // ── Internal helper ─────────────────────────────────────────────
  private async findByIdOrThrow(userId: string, notificationId: string) {
    const [notification] = await this.db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.deleted, false),
        ),
      )
      .limit(1);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }
}
