import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationTriggerService } from './notification-trigger.service';
import { NotificationType, NotificationSeverity } from './notifications.service';

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns the chain itself, and awaiting resolves to `data`.
 */
function mockQuery(data: any) {
  const chain: any = {};
  for (const m of ['select', 'from', 'where', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('NotificationTriggerService', () => {
  const userId = 'user-123';
  const email = 'owl@example.com';

  let mockDb: any;
  let notificationsService: any;
  let emailService: any;
  let service: NotificationTriggerService;

  /**
   * Queue db.select() results in the order the service issues them:
   * preferences first (where the method reads them), then the user's email.
   */
  function queueSelects(...results: any[][]) {
    for (const r of results) {
      mockDb.select.mockReturnValueOnce(mockQuery(r));
    }
  }

  beforeEach(() => {
    mockDb = { select: vi.fn() };
    notificationsService = {
      createNotification: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    };
    emailService = {
      sendBudgetAlert: vi.fn().mockResolvedValue(true),
      sendAnomalyAlert: vi.fn().mockResolvedValue(true),
      sendSecurityAlert: vi.fn().mockResolvedValue(true),
    };
    service = new NotificationTriggerService(mockDb, notificationsService, emailService);
  });

  // ────────────────────────────────────────────────────────────────
  // triggerBudgetAlert
  // ────────────────────────────────────────────────────────────────

  describe('triggerBudgetAlert', () => {
    it('returns null and sends nothing when the user turned budget alerts off', async () => {
      queueSelects([{ userId, emailBudgetAlerts: false }]);

      const result = await service.triggerBudgetAlert(userId, 'Groceries', 95, 475, 500);

      expect(result).toBeNull();
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
      expect(emailService.sendBudgetAlert).not.toHaveBeenCalled();
    });

    it('defaults to sending (in-app + email) when the user has no preferences row', async () => {
      queueSelects([], [{ email }]);

      const result = await service.triggerBudgetAlert(userId, 'Groceries', 80, 400, 500);

      expect(result).toEqual({ id: 'notif-1' });
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        userId,
        NotificationType.BUDGET_ALERT,
        'Groceries budget at 80%',
        "You've spent $400.00 of your $500.00 Groceries budget (80%).",
        NotificationSeverity.INFO,
        '/budgets',
      );
      expect(emailService.sendBudgetAlert).toHaveBeenCalledWith(email, {
        budgetName: 'Groceries',
        amountSpent: 400,
        budgetLimit: 500,
        percentUsed: 80,
      });
    });

    it.each([
      [75, NotificationSeverity.INFO],
      [89.99, NotificationSeverity.INFO],
      [90, NotificationSeverity.WARNING],
      [99.9, NotificationSeverity.WARNING],
      [100, NotificationSeverity.CRITICAL],
      [150, NotificationSeverity.CRITICAL],
    ])('maps %s%% used to severity %s', async (percent, severity) => {
      queueSelects([{ userId, emailBudgetAlerts: true }], [{ email }]);

      await service.triggerBudgetAlert(userId, 'Dining', percent, 1, 1);

      expect(notificationsService.createNotification.mock.calls[0][4]).toBe(severity);
    });

    it('titles a budget at or past 100% as exceeded, not by percentage', async () => {
      queueSelects([{ userId, emailBudgetAlerts: true }], [{ email }]);

      await service.triggerBudgetAlert(userId, 'Rent', 120, 2400, 2000);

      const [, , title, message] = notificationsService.createNotification.mock.calls[0];
      expect(title).toBe('Rent budget exceeded');
      expect(message).toBe("You've spent $2,400.00 of your $2,000.00 Rent budget (120%).");
    });

    it('rounds the displayed percentage but passes the exact value to email', async () => {
      queueSelects([{ userId, emailBudgetAlerts: true }], [{ email }]);

      await service.triggerBudgetAlert(userId, 'Fuel', 99.6, 99.6, 100);

      const [, , title, message] = notificationsService.createNotification.mock.calls[0];
      // 99.6 rounds to 100 in the text, yet it is still under the limit:
      // the "exceeded" title and CRITICAL severity key off the raw value.
      expect(title).toBe('Fuel budget at 100%');
      expect(message).toBe("You've spent $99.60 of your $100.00 Fuel budget (100%).");
      expect(notificationsService.createNotification.mock.calls[0][4]).toBe(
        NotificationSeverity.WARNING,
      );
      expect(emailService.sendBudgetAlert.mock.calls[0][1].percentUsed).toBe(99.6);
    });

    it('still returns the in-app notification when the email send throws', async () => {
      queueSelects([{ userId, emailBudgetAlerts: true }], [{ email }]);
      emailService.sendBudgetAlert.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await service.triggerBudgetAlert(userId, 'Groceries', 91, 455, 500);

      expect(result).toEqual({ id: 'notif-1' });
    });

    it('skips email when the user has no email address on record', async () => {
      queueSelects([{ userId, emailBudgetAlerts: true }], []);

      const result = await service.triggerBudgetAlert(userId, 'Groceries', 91, 455, 500);

      expect(result).toEqual({ id: 'notif-1' });
      expect(emailService.sendBudgetAlert).not.toHaveBeenCalled();
    });

    it('creates the in-app notification without touching the db for email when EmailService is absent', async () => {
      service = new NotificationTriggerService(mockDb, notificationsService);
      queueSelects([{ userId, emailBudgetAlerts: true }]);

      const result = await service.triggerBudgetAlert(userId, 'Groceries', 91, 455, 500);

      expect(result).toEqual({ id: 'notif-1' });
      // Only the preferences lookup ran; the email lookup was never issued.
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // triggerAnomalyAlert
  // ────────────────────────────────────────────────────────────────

  describe('triggerAnomalyAlert', () => {
    it('returns null when the user turned anomaly alerts off', async () => {
      queueSelects([{ userId, emailAnomalies: false }]);

      const result = await service.triggerAnomalyAlert(userId, 'unusual_amount', 'Big spend');

      expect(result).toBeNull();
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('describes the transaction with its absolute amount and links to it', async () => {
      queueSelects([{ userId, emailAnomalies: true }], [{ email }]);

      await service.triggerAnomalyAlert(userId, 'duplicate_charge', 'Charged twice.', {
        id: 'txn-9',
        name: 'Coffee Co',
        amount: -1234.5,
      });

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        userId,
        NotificationType.ANOMALY_DETECTED,
        'Possible duplicate charge detected',
        'Charged twice. Transaction: Coffee Co for $1,234.50.',
        NotificationSeverity.WARNING,
        '/transactions/txn-9',
      );
      expect(emailService.sendAnomalyAlert).toHaveBeenCalledWith(
        email,
        expect.objectContaining({
          merchantName: 'Coffee Co',
          amount: -1234.5,
          reason: 'Charged twice.',
          transactionId: 'txn-9',
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      );
    });

    it('falls back to a generic title, /anomalies link and placeholder merchant without a transaction', async () => {
      queueSelects([], [{ email }]);

      await service.triggerAnomalyAlert(userId, 'not_a_known_type', 'Something odd.');

      const [, , title, message, , actionUrl] =
        notificationsService.createNotification.mock.calls[0];
      expect(title).toBe('Unusual activity detected');
      expect(message).toBe('Something odd.');
      expect(actionUrl).toBe('/anomalies');
      expect(emailService.sendAnomalyAlert.mock.calls[0][1]).toMatchObject({
        merchantName: 'Unknown Merchant',
        amount: 0,
        transactionId: undefined,
      });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // triggerGoalMilestone
  // ────────────────────────────────────────────────────────────────

  describe('triggerGoalMilestone', () => {
    it('reports partial progress with the formatted saved amount', async () => {
      await service.triggerGoalMilestone(userId, 'Vacation', 50, 1500);

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        userId,
        NotificationType.GOAL_MILESTONE,
        'Vacation is 50% complete',
        "You've saved $1,500.00 toward your Vacation goal (50% complete).",
        NotificationSeverity.INFO,
        '/savings-goals',
      );
      // Milestones never consult preferences or send email.
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('congratulates once the milestone reaches 100%', async () => {
      await service.triggerGoalMilestone(userId, 'Emergency Fund', 100, 10000);

      const [, , title, message] = notificationsService.createNotification.mock.calls[0];
      expect(title).toBe('Goal achieved: Emergency Fund!');
      expect(message).toBe(
        "Congratulations! You've reached your Emergency Fund savings goal with $10,000.00 saved.",
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // triggerSecurityAlert
  // ────────────────────────────────────────────────────────────────

  describe('triggerSecurityAlert', () => {
    it('always sends, as CRITICAL, without reading preferences', async () => {
      queueSelects([{ email }]);

      await service.triggerSecurityAlert(userId, 'password_changed', 'Your password changed.', {
        device: 'Firefox on Linux',
        ipAddress: '203.0.113.7',
      });

      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        userId,
        NotificationType.SECURITY_ALERT,
        'Password changed',
        'Your password changed.',
        NotificationSeverity.CRITICAL,
        '/settings/security',
      );
      // The single select is the email lookup, not a preferences read.
      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(emailService.sendSecurityAlert).toHaveBeenCalledWith(
        email,
        expect.objectContaining({
          eventType: 'password_changed',
          eventTitle: 'Password changed',
          device: 'Firefox on Linux',
          ipAddress: '203.0.113.7',
          location: undefined,
        }),
      );
    });

    it('uses a generic title for an unknown event type', async () => {
      queueSelects([{ email }]);

      await service.triggerSecurityAlert(userId, 'mystery', 'Details.');

      expect(notificationsService.createNotification.mock.calls[0][2]).toBe(
        'Security event detected',
      );
    });

    it('swallows a failure in the email lookup itself', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('db gone');
      });

      const result = await service.triggerSecurityAlert(userId, 'account_locked', 'Locked.');

      expect(result).toEqual({ id: 'notif-1' });
      expect(emailService.sendSecurityAlert).not.toHaveBeenCalled();
    });
  });
});
