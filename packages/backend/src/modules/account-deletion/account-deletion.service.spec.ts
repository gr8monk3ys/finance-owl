import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';

function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'groupBy',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;
  let mockDb: any;
  let mockEmailService: any;
  let mockConfigService: any;
  let mockBankSyncService: any;
  let mockBillingService: any;

  const mockUserId = 'user-123';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hash',
    totpEnabled: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const pastDate = new Date(Date.now() - 1000).toISOString();

  const mockPendingDeletion = {
    id: 'del-1',
    userId: mockUserId,
    status: 'pending',
    reason: 'Switching services',
    scheduledAt: futureDate,
    completedAt: null,
    createdAt: new Date('2026-02-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        // The transaction callback receives the same mock db so all
        // pre-configured mockReturnValueOnce calls are consumed normally.
        return cb(mockDb);
      }),
    };

    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue(true),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue;
      }),
    };

    mockBankSyncService = {
      unlinkItem: vi.fn().mockResolvedValue(undefined),
    };

    mockBillingService = {
      cancelSubscription: vi
        .fn()
        .mockResolvedValue({ canceled: true, effectiveDate: new Date().toISOString() }),
    };

    service = new AccountDeletionService(
      mockDb,
      mockEmailService,
      mockConfigService,
      mockBankSyncService,
      mockBillingService,
    );
  });

  // ---------------------------------------------------------------------------
  // requestDeletion
  // ---------------------------------------------------------------------------
  describe('requestDeletion', () => {
    it('should throw ConflictException if deletion is already pending', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPendingDeletion]));

      await expect(service.requestDeletion(mockUserId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // No pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // User not found
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.requestDeletion(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should create a deletion request with 14-day grace period', async () => {
      // No existing pending
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // User found
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // Insert deletion request
      mockDb.insert.mockReturnValueOnce(mockQuery([mockPendingDeletion]));

      const result = await service.requestDeletion(mockUserId, 'Switching services');

      expect(result.status).toBe('pending_deletion');
      expect(result.scheduledAt).toBeDefined();
      expect(result.daysRemaining).toBeGreaterThanOrEqual(13);
      expect(result.daysRemaining).toBeLessThanOrEqual(14);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Account Deletion Requested'),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // cancelDeletion
  // ---------------------------------------------------------------------------
  describe('cancelDeletion', () => {
    it('should throw NotFoundException if no pending deletion exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.cancelDeletion(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if grace period has expired', async () => {
      const expiredDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };
      mockDb.select.mockReturnValueOnce(mockQuery([expiredDeletion]));

      await expect(service.cancelDeletion(mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should cancel a pending deletion and send confirmation email', async () => {
      // Find pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([mockPendingDeletion]));
      // Update status
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      // Get user for email
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));

      const result = await service.cancelDeletion(mockUserId);

      expect(result.status).toBe('cancelled');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Deletion Cancelled'),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // executeDeletion
  // ---------------------------------------------------------------------------
  describe('executeDeletion', () => {
    it('should throw NotFoundException if no pending deletion exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.executeDeletion(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if grace period has not expired', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPendingDeletion]));

      await expect(service.executeDeletion(mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should execute deletion when grace period has passed', async () => {
      const readyDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };

      // Find pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([readyDeletion]));

      // Mark as processing
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      // Get user
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));

      // Plaid items
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Stripe subscription
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Transaction IDs for splits
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Savings goal IDs for contributions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Budget IDs for alerts/periods
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // All the delete calls (many of them)
      for (let i = 0; i < 25; i++) {
        mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      }

      // Anonymize audit logs
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      // More deletes for sessions, webauthn, deletion requests, user
      for (let i = 0; i < 5; i++) {
        mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      }

      await service.executeDeletion(mockUserId);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Account Deleted'),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should call bankSyncService.unlinkItem for each Plaid item', async () => {
      const readyDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };

      const mockPlaidItems = [
        { id: 'pi-1', plaidItemId: 'plaid-item-1', userId: mockUserId, accessToken: 'enc-token-1' },
        { id: 'pi-2', plaidItemId: 'plaid-item-2', userId: mockUserId, accessToken: 'enc-token-2' },
      ];

      // Find pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([readyDeletion]));
      // Mark as processing
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      // Get user
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // Plaid items
      mockDb.select.mockReturnValueOnce(mockQuery(mockPlaidItems));
      // Stripe subscription
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Transaction IDs for splits
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Savings goal IDs for contributions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Budget IDs for alerts/periods
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      for (let i = 0; i < 30; i++) {
        mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      }
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      await service.executeDeletion(mockUserId);

      expect(mockBankSyncService.unlinkItem).toHaveBeenCalledTimes(2);
      expect(mockBankSyncService.unlinkItem).toHaveBeenCalledWith(mockUserId, 'pi-1');
      expect(mockBankSyncService.unlinkItem).toHaveBeenCalledWith(mockUserId, 'pi-2');
    });

    it('should continue deletion when Plaid revocation fails', async () => {
      const readyDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };

      const mockPlaidItems = [
        { id: 'pi-1', plaidItemId: 'plaid-item-1', userId: mockUserId, accessToken: 'enc-token-1' },
      ];

      mockBankSyncService.unlinkItem.mockRejectedValueOnce(new Error('Plaid API error'));

      // Find pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([readyDeletion]));
      // Mark as processing
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      // Get user
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // Plaid items
      mockDb.select.mockReturnValueOnce(mockQuery(mockPlaidItems));
      // Stripe subscription
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Transaction IDs for splits
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Savings goal IDs for contributions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Budget IDs for alerts/periods
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      for (let i = 0; i < 30; i++) {
        mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      }
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      // Should not throw despite Plaid failure
      await service.executeDeletion(mockUserId);

      expect(mockBankSyncService.unlinkItem).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Account Deleted'),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should call billingService.cancelSubscription for active subscriptions', async () => {
      const readyDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };

      const mockSubscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
      };

      // Find pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([readyDeletion]));
      // Mark as processing
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      // Get user
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // Plaid items
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Stripe subscription
      mockDb.select.mockReturnValueOnce(mockQuery([mockSubscription]));

      // Transaction IDs for splits
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Savings goal IDs for contributions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Budget IDs for alerts/periods
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      for (let i = 0; i < 30; i++) {
        mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      }
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      await service.executeDeletion(mockUserId);

      expect(mockBillingService.cancelSubscription).toHaveBeenCalledWith(mockUserId, false);
    });

    it('should continue deletion when Stripe cancellation fails', async () => {
      const readyDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };

      const mockSubscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_stripe_123',
        status: 'active',
      };

      mockBillingService.cancelSubscription.mockRejectedValueOnce(new Error('Stripe API error'));

      // Find pending deletion
      mockDb.select.mockReturnValueOnce(mockQuery([readyDeletion]));
      // Mark as processing
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      // Get user
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // Plaid items
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Stripe subscription
      mockDb.select.mockReturnValueOnce(mockQuery([mockSubscription]));

      // Transaction IDs for splits
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Savings goal IDs for contributions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Budget IDs for alerts/periods
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      for (let i = 0; i < 30; i++) {
        mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      }
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      // Should not throw despite Stripe failure
      await service.executeDeletion(mockUserId);

      expect(mockBillingService.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Account Deleted'),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getDeletionStatus
  // ---------------------------------------------------------------------------
  describe('getDeletionStatus', () => {
    it('should return none when no deletion requests exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getDeletionStatus(mockUserId);

      expect(result.status).toBe('none');
    });

    it('should return none when latest request is completed', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ ...mockPendingDeletion, status: 'completed' }]),
      );

      const result = await service.getDeletionStatus(mockUserId);

      expect(result.status).toBe('none');
    });

    it('should return pending_deletion with days remaining', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPendingDeletion]));

      const result = await service.getDeletionStatus(mockUserId);

      expect(result.status).toBe('pending_deletion');
      expect(result.scheduledAt).toBe(futureDate);
      expect(result.daysRemaining).toBeGreaterThanOrEqual(13);
      expect(result.daysRemaining).toBeLessThanOrEqual(14);
    });

    it('should return 0 days remaining when past the scheduled date', async () => {
      const pastDeletion = {
        ...mockPendingDeletion,
        scheduledAt: pastDate,
      };
      mockDb.select.mockReturnValueOnce(mockQuery([pastDeletion]));

      const result = await service.getDeletionStatus(mockUserId);

      expect(result.status).toBe('pending_deletion');
      expect(result.daysRemaining).toBe(0);
    });

    it('should return processing status', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ ...mockPendingDeletion, status: 'processing' }]),
      );

      const result = await service.getDeletionStatus(mockUserId);

      expect(result.status).toBe('processing');
    });
  });
});
