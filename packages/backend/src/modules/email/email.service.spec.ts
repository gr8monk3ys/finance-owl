import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockConfigService(
  overrides: Record<string, string | number | undefined> = {},
): ConfigService {
  const defaults: Record<string, string | number | undefined> = {
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'testuser',
    SMTP_PASS: 'testpass',
    SMTP_FROM: 'Test <test@financeowl.app>',
    FRONTEND_URL: 'https://app.financeowl.app',
    ...overrides,
  };

  return {
    get: vi.fn((key: string, defaultValue?: any) => {
      const val = defaults[key];
      return val !== undefined ? val : defaultValue;
    }),
  } as unknown as ConfigService;
}

/**
 * Creates a mock nodemailer transport that we can inject via
 * the private `transporter` field.
 */
function createMockTransporter(sendMailImpl?: (...args: any[]) => Promise<any>) {
  return {
    sendMail: sendMailImpl ?? vi.fn().mockResolvedValue({ messageId: 'test-id' }),
  };
}

function getPrivateField<T>(obj: any, field: string): T {
  return obj[field] as T;
}

function setPrivateField(obj: any, field: string, value: any): void {
  obj[field] = value;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;
  let mockSendMail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    configService = createMockConfigService();
    service = new EmailService(configService, {} as any);
    mockSendMail = vi.fn().mockResolvedValue({ messageId: 'msg-123' });
    // Simulate onModuleInit without starting the real interval
    setPrivateField(service, 'transporter', createMockTransporter(mockSendMail));
  });

  afterEach(() => {
    // Clean up interval if onModuleInit was called
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  // ════════════════════════════════════════════════════════════════════
  // 1. sendEmail — basic send
  // ════════════════════════════════════════════════════════════════════

  describe('sendEmail', () => {
    it('should send an email via the transporter and return true', async () => {
      const result = await service.sendEmail(
        'user@example.com',
        'Test Subject',
        '<h1>Hello</h1>',
        'Hello plain',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledOnce();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<h1>Hello</h1>',
          text: 'Hello plain',
        }),
      );
    });

    it('should auto-generate plain text from HTML when text is not provided', async () => {
      await service.sendEmail(
        'user@example.com',
        'Subject',
        '<p>Hello <strong>World</strong></p>',
      );

      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.text).toBeDefined();
      expect(callArgs.text).toContain('Hello');
      expect(callArgs.text).toContain('World');
      expect(callArgs.text).not.toContain('<p>');
    });

    it('should use the configured from address', async () => {
      await service.sendEmail('u@test.com', 'Sub', '<p>hi</p>');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Test <test@financeowl.app>',
        }),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. Graceful fallback when SMTP not configured
  // ════════════════════════════════════════════════════════════════════

  describe('SMTP not configured', () => {
    it('should return false when transporter is null', async () => {
      setPrivateField(service, 'transporter', null);

      const result = await service.sendEmail(
        'user@test.com',
        'Subject',
        '<p>body</p>',
      );

      expect(result).toBe(false);
    });

    it('should not attempt to send mail when SMTP_HOST is missing', () => {
      const noSmtpConfig = createMockConfigService({ SMTP_HOST: undefined });
      const svc = new EmailService(noSmtpConfig, {} as any);
      svc.onModuleInit();

      expect(getPrivateField(svc, 'transporter')).toBeNull();

      svc.onModuleDestroy();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 3. Retry queue — enqueues on failure
  // ════════════════════════════════════════════════════════════════════

  describe('retry queue', () => {
    it('should enqueue email when send fails and return true', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.sendEmail(
        'user@test.com',
        'Failed Email',
        '<p>body</p>',
      );

      // Returns true because it is queued for retry
      expect(result).toBe(true);
      expect(service.queueSize).toBe(1);
    });

    it('should successfully retry a queued email', async () => {
      // First call fails
      mockSendMail.mockRejectedValueOnce(new Error('Timeout'));
      await service.sendEmail('user@test.com', 'Retry Test', '<p>body</p>');

      expect(service.queueSize).toBe(1);

      // Advance time past the retry delay (5s base)
      vi.advanceTimersByTime(6_000);

      // Reset sendMail to succeed on retry
      mockSendMail.mockResolvedValueOnce({ messageId: 'retry-ok' });

      // Manually trigger queue processing
      await (service as any).processQueue();

      expect(service.queueSize).toBe(0);
    });

    it('should not retry before the backoff delay', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Timeout'));
      await service.sendEmail('user@test.com', 'Early Retry', '<p>body</p>');

      // Only 2 seconds have passed (backoff is 5s)
      vi.advanceTimersByTime(2_000);

      // Reset so next call would succeed
      mockSendMail.mockResolvedValueOnce({ messageId: 'early-ok' });

      await (service as any).processQueue();

      // Still in queue because backoff hasn't elapsed
      expect(service.queueSize).toBe(1);
    });

    it('should permanently remove email after max attempts', async () => {
      // All attempts fail
      mockSendMail.mockRejectedValue(new Error('Permanent failure'));

      await service.sendEmail('user@test.com', 'Perm Fail', '<p>body</p>');
      expect(service.queueSize).toBe(1); // attempt 1 done, queued

      // Retry attempt 2 (backoff 5s)
      vi.advanceTimersByTime(6_000);
      await (service as any).processQueue();
      expect(service.queueSize).toBe(1); // attempt 2 done, still queued

      // Retry attempt 3 (backoff 10s = 5000 * 2^1)
      vi.advanceTimersByTime(11_000);
      await (service as any).processQueue();

      // After 3 attempts total, removed from queue
      expect(service.queueSize).toBe(0);
    });

    it('should use exponential backoff delays', async () => {
      mockSendMail.mockRejectedValue(new Error('fail'));

      await service.sendEmail('user@test.com', 'Backoff', '<p>body</p>');

      // After first fail: nextRetryAt = now + 5000ms (BASE_DELAY)
      const queue = getPrivateField<Map<string, any>>(service, 'queue');
      const entry = Array.from(queue.values())[0];
      const firstRetryDelay = entry.nextRetryAt - entry.createdAt;

      // Should be approximately 5000ms (the BASE_DELAY_MS)
      expect(firstRetryDelay).toBeGreaterThanOrEqual(4900);
      expect(firstRetryDelay).toBeLessThanOrEqual(5100);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 4. Template-based send methods
  // ════════════════════════════════════════════════════════════════════

  describe('sendBillReminder', () => {
    it('should send a bill reminder email with correct subject and content', async () => {
      const result = await service.sendBillReminder('user@test.com', {
        billName: 'Netflix',
        amount: 15.99,
        dueDate: '2026-02-20',
      });

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledOnce();

      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toContain('Netflix');
      expect(args.subject).toContain('$15.99');
      expect(args.html).toContain('Netflix');
      expect(args.html).toContain('Bill Reminder');
      expect(args.html).toContain('FinanceOwl');
      expect(args.text).toContain('Netflix');
      expect(args.text).toContain('$15.99');
    });
  });

  describe('sendBudgetAlert', () => {
    it('should send a budget alert email with progress information', async () => {
      const result = await service.sendBudgetAlert('user@test.com', {
        budgetName: 'Dining Out',
        amountSpent: 450,
        budgetLimit: 500,
        percentUsed: 90,
      });

      expect(result).toBe(true);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toContain('Dining Out');
      expect(args.subject).toContain('90%');
      expect(args.html).toContain('Dining Out');
      expect(args.html).toContain('90%');
      expect(args.text).toContain('Dining Out');
    });
  });

  describe('sendAnomalyAlert', () => {
    it('should send an anomaly alert email with transaction details', async () => {
      const result = await service.sendAnomalyAlert('user@test.com', {
        merchantName: 'Suspicious Store',
        amount: -299.99,
        date: '2026-02-15',
        reason: 'Amount is 5x higher than your usual spending at this merchant.',
        transactionId: 'tx-abc-123',
      });

      expect(result).toBe(true);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toContain('Suspicious Store');
      expect(args.html).toContain('Suspicious Store');
      expect(args.html).toContain('flagged');
      expect(args.text).toContain('flagged');
    });
  });

  describe('sendSecurityAlert', () => {
    it('should send a security alert email with device info', async () => {
      const result = await service.sendSecurityAlert('user@test.com', {
        eventType: 'login_new_device',
        eventTitle: 'New device login detected',
        details: 'A new device was used to sign in to your account.',
        device: 'Chrome on macOS',
        ipAddress: '203.0.113.42',
        location: 'San Francisco, CA',
        timestamp: '2026-02-15T10:30:00Z',
      });

      expect(result).toBe(true);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toContain('Security Alert');
      expect(args.html).toContain('Chrome on macOS');
      expect(args.html).toContain('203.0.113.42');
      expect(args.html).toContain("wasn't you");
      expect(args.text).toContain("WASN'T YOU");
    });
  });

  describe('sendWeeklyDigest', () => {
    it('should send a weekly digest email with all sections', async () => {
      const result = await service.sendWeeklyDigest('user@test.com', {
        totalIncome: 3500,
        totalExpenses: 2100,
        net: 1400,
        topCategories: [
          { name: 'Groceries', amount: 350 },
          { name: 'Dining', amount: 250 },
        ],
        upcomingBills: [
          { name: 'Rent', amount: 1500, dueDate: '2026-02-20' },
        ],
        budgetStatuses: [
          { name: 'Groceries', spent: 350, limit: 400, percentUsed: 87.5 },
        ],
      });

      expect(result).toBe(true);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toContain('Weekly Summary');
      expect(args.html).toContain('Groceries');
      expect(args.html).toContain('Dining');
      expect(args.html).toContain('Rent');
      expect(args.text).toContain('Groceries');
      expect(args.text).toContain('$3,500.00');
    });
  });

  describe('sendWelcome', () => {
    it('should send a welcome email with getting started steps', async () => {
      const result = await service.sendWelcome('user@test.com', {
        userName: 'Alice',
      });

      expect(result).toBe(true);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toBe('Welcome to FinanceOwl!');
      expect(args.html).toContain('Alice');
      expect(args.html).toContain('Connect Your Accounts');
      expect(args.html).toContain('Set Up Budgets');
      expect(args.html).toContain('Configure Alerts');
      expect(args.text).toContain('Alice');
      expect(args.text).toContain('Connect Your Accounts');
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 5. Template output — structure validation
  // ════════════════════════════════════════════════════════════════════

  describe('template HTML output', () => {
    it('should include unsubscribe link in all emails', async () => {
      await service.sendBillReminder('u@test.com', {
        billName: 'Test',
        amount: 10,
        dueDate: '2026-01-01',
      });

      const args = mockSendMail.mock.calls[0][0];
      expect(args.html).toContain('unsubscribe=all');
      expect(args.html).toContain('Manage notification preferences');
    });

    it('should include FinanceOwl branding with green accent color', async () => {
      await service.sendBillReminder('u@test.com', {
        billName: 'Test',
        amount: 10,
        dueDate: '2026-01-01',
      });

      const args = mockSendMail.mock.calls[0][0];
      expect(args.html).toContain('#10b981');
      expect(args.html).toContain('FinanceOwl');
    });

    it('should have responsive max-width 600px wrapper', async () => {
      await service.sendWelcome('u@test.com', { userName: 'Bob' });

      const args = mockSendMail.mock.calls[0][0];
      expect(args.html).toContain('max-width:600px');
    });

    it('should use inline CSS (no <link> stylesheet tags)', async () => {
      await service.sendSecurityAlert('u@test.com', {
        eventType: 'password_changed',
        eventTitle: 'Password changed',
        details: 'Your password was recently changed.',
        timestamp: new Date().toISOString(),
      });

      const args = mockSendMail.mock.calls[0][0];
      // Should NOT have external stylesheets
      expect(args.html).not.toMatch(/<link[^>]+stylesheet/i);
      // Should have inline styles
      expect(args.html).toMatch(/style="/);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 6. Lifecycle hooks
  // ════════════════════════════════════════════════════════════════════

  describe('lifecycle', () => {
    it('onModuleInit should initialise transport when SMTP_HOST is set', () => {
      const svc = new EmailService(configService, {} as any);
      svc.onModuleInit();

      expect(getPrivateField(svc, 'transporter')).not.toBeNull();

      svc.onModuleDestroy();
    });

    it('onModuleDestroy should clear the queue interval', () => {
      const svc = new EmailService(configService, {} as any);
      svc.onModuleInit();

      const timer = getPrivateField(svc, 'queueTimer');
      expect(timer).not.toBeNull();

      svc.onModuleDestroy();

      expect(getPrivateField(svc, 'queueTimer')).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // 7. MAX_ATTEMPTS constant
  // ════════════════════════════════════════════════════════════════════

  describe('constants', () => {
    it('MAX_ATTEMPTS should be 3', () => {
      expect(EmailService.MAX_ATTEMPTS).toBe(3);
    });
  });
});
