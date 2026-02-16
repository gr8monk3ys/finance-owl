import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import {
  NotificationsService,
  NotificationType,
  NotificationSeverity,
} from './notifications.service';

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns the chain itself, and awaiting resolves to `data`.
 */
function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockDb: any;

  const userId = 'user-123';
  const notifId = 'notif-456';

  const baseNotification = {
    id: notifId,
    userId,
    type: NotificationType.SYSTEM,
    severity: NotificationSeverity.INFO,
    title: 'Test Notification',
    body: 'This is a test',
    data: null,
    actionUrl: null,
    read: false,
    deleted: false,
    readAt: null,
    deletedAt: null,
    createdAt: new Date('2026-02-15T00:00:00Z'),
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new NotificationsService(mockDb);
  });

  // ────────────────────────────────────────────────────────────────
  // createNotification
  // ────────────────────────────────────────────────────────────────

  describe('createNotification', () => {
    it('should insert a notification and return it', async () => {
      mockDb.insert.mockReturnValueOnce(mockQuery([baseNotification]));

      const result = await service.createNotification(
        userId,
        NotificationType.SYSTEM,
        'Test Notification',
        'This is a test',
      );

      expect(result).toEqual(baseNotification);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should use default severity INFO when not provided', async () => {
      const insertChain = mockQuery([baseNotification]);
      mockDb.insert.mockReturnValueOnce(insertChain);

      await service.createNotification(
        userId,
        NotificationType.SYSTEM,
        'Test',
        'Body',
      );

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' }),
      );
    });

    it('should accept a custom severity', async () => {
      const criticalNotif = {
        ...baseNotification,
        severity: NotificationSeverity.CRITICAL,
      };
      const insertChain = mockQuery([criticalNotif]);
      mockDb.insert.mockReturnValueOnce(insertChain);

      const result = await service.createNotification(
        userId,
        NotificationType.SECURITY_ALERT,
        'Security Alert',
        'Suspicious login',
        NotificationSeverity.CRITICAL,
      );

      expect(result.severity).toBe('critical');
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical' }),
      );
    });

    it('should include actionUrl when provided', async () => {
      const withUrl = { ...baseNotification, actionUrl: '/settings' };
      const insertChain = mockQuery([withUrl]);
      mockDb.insert.mockReturnValueOnce(insertChain);

      await service.createNotification(
        userId,
        NotificationType.SYSTEM,
        'Test',
        'Body',
        NotificationSeverity.INFO,
        '/settings',
      );

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ actionUrl: '/settings' }),
      );
    });

    it('should push event to notificationStream$', async () => {
      mockDb.insert.mockReturnValueOnce(mockQuery([baseNotification]));

      const events: any[] = [];
      const sub = service.notificationStream$.subscribe((e) => events.push(e));

      await service.createNotification(
        userId,
        NotificationType.SYSTEM,
        'Test',
        'Body',
      );

      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe(userId);
      expect(events[0].notification).toEqual(baseNotification);

      sub.unsubscribe();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getUserNotifications
  // ────────────────────────────────────────────────────────────────

  describe('getUserNotifications', () => {
    it('should return paginated results with total', async () => {
      const items = [baseNotification];
      mockDb.select
        .mockReturnValueOnce(mockQuery(items))
        .mockReturnValueOnce(mockQuery([{ total: 1 }]));

      const result = await service.getUserNotifications(userId);

      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should respect custom limit and offset', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 0 }]));

      const result = await service.getUserNotifications(userId, {
        limit: 5,
        offset: 10,
      });

      expect(result.limit).toBe(5);
      expect(result.offset).toBe(10);
    });

    it('should filter unread only when requested', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([baseNotification]))
        .mockReturnValueOnce(mockQuery([{ total: 1 }]));

      const result = await service.getUserNotifications(userId, {
        unreadOnly: true,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should return empty items when no notifications exist', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 0 }]));

      const result = await service.getUserNotifications(userId);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // markAsRead
  // ────────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark an unread notification as read', async () => {
      const updated = { ...baseNotification, read: true, readAt: new Date() };

      // findByIdOrThrow select
      mockDb.select.mockReturnValueOnce(mockQuery([baseNotification]));
      // update + returning
      mockDb.update.mockReturnValueOnce(mockQuery([updated]));

      const result = await service.markAsRead(userId, notifId);

      expect(result.read).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return early if notification is already read', async () => {
      const alreadyRead = { ...baseNotification, read: true };

      mockDb.select.mockReturnValueOnce(mockQuery([alreadyRead]));

      const result = await service.markAsRead(userId, notifId);

      expect(result.read).toBe(true);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.markAsRead(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // markAllAsRead
  // ────────────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read and return count', async () => {
      const updated = [
        { ...baseNotification, read: true },
        { ...baseNotification, id: 'notif-789', read: true },
      ];

      mockDb.update.mockReturnValueOnce(mockQuery(updated));

      const result = await service.markAllAsRead(userId);

      expect(result.updated).toBe(2);
    });

    it('should return 0 when there are no unread notifications', async () => {
      mockDb.update.mockReturnValueOnce(mockQuery([]));

      const result = await service.markAllAsRead(userId);

      expect(result.updated).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // deleteNotification
  // ────────────────────────────────────────────────────────────────

  describe('deleteNotification', () => {
    it('should soft-delete a notification', async () => {
      // findByIdOrThrow
      mockDb.select.mockReturnValueOnce(mockQuery([baseNotification]));
      // update (soft delete)
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      await service.deleteNotification(userId, notifId);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.deleteNotification(userId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not allow deleting another user notification', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.deleteNotification('other-user', notifId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getUnreadCount
  // ────────────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return the unread count', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 5 }]));

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 5 });
    });

    it('should return 0 when no unread notifications', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 0 }]));

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
    });

    it('should return 0 when query returns undefined total', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([{}]));

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Enum values
  // ────────────────────────────────────────────────────────────────

  describe('NotificationType enum', () => {
    it('should have all required notification types', () => {
      expect(NotificationType.BILL_REMINDER).toBe('bill_reminder');
      expect(NotificationType.BUDGET_ALERT).toBe('budget_alert');
      expect(NotificationType.ANOMALY_DETECTED).toBe('anomaly_detected');
      expect(NotificationType.GOAL_MILESTONE).toBe('goal_milestone');
      expect(NotificationType.SUBSCRIPTION_CHANGE).toBe('subscription_change');
      expect(NotificationType.SECURITY_ALERT).toBe('security_alert');
      expect(NotificationType.SYSTEM).toBe('system');
    });
  });

  describe('NotificationSeverity enum', () => {
    it('should have all severity levels', () => {
      expect(NotificationSeverity.INFO).toBe('info');
      expect(NotificationSeverity.WARNING).toBe('warning');
      expect(NotificationSeverity.CRITICAL).toBe('critical');
    });
  });
});
