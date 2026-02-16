import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataExportService } from './data-export.service';

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
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('DataExportService', () => {
  let service: DataExportService;
  let mockDb: any;
  let mockEmailService: any;

  const mockUserId = 'user-123';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockExportRequest = {
    id: 'export-1',
    userId: mockUserId,
    format: 'json',
    status: 'processing',
    downloadUrl: null,
    expiresAt: null,
    completedAt: null,
    createdAt: new Date('2026-02-15'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue(true),
    };

    service = new DataExportService(mockDb, mockEmailService);
  });

  // ---------------------------------------------------------------------------
  // requestExport
  // ---------------------------------------------------------------------------
  describe('requestExport', () => {
    it('should reject if an export is already in progress', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ ...mockExportRequest, status: 'processing' }]),
      );

      await expect(service.requestExport(mockUserId, 'json')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create an export request and return completed status', async () => {
      // Check existing: none in progress
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert export request
      mockDb.insert.mockReturnValueOnce(mockQuery([mockExportRequest]));

      // gatherUserData: user profile
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // preferences
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // accounts
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // budgets
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // recurring transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // savings goals
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // notification preferences
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // notifications
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // financial health scores
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // audit log
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Update export request with download URL
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      // Get user for email
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));

      const result = await service.requestExport(mockUserId, 'json');

      expect(result.status).toBe('completed');
      expect(result.id).toBe('export-1');
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Data Export is Ready'),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle CSV format export', async () => {
      // Check existing: none
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Insert export request
      mockDb.insert.mockReturnValueOnce(
        mockQuery([{ ...mockExportRequest, format: 'csv' }]),
      );

      // gatherUserData: user profile
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // preferences
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // accounts
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // budgets
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // recurring transactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // savings goals
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // notification preferences
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // notifications
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // financial health scores
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // audit log
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Update
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      // User for email
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));

      const result = await service.requestExport(mockUserId, 'csv');

      expect(result.status).toBe('completed');
    });
  });

  // ---------------------------------------------------------------------------
  // getExportStatus
  // ---------------------------------------------------------------------------
  describe('getExportStatus', () => {
    it('should return none when no export requests exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getExportStatus(mockUserId);

      expect(result).toEqual({ status: 'none' });
    });

    it('should return the latest export request status', async () => {
      const completedExport = {
        ...mockExportRequest,
        status: 'completed',
        downloadUrl: 'abc123',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      mockDb.select.mockReturnValueOnce(mockQuery([completedExport]));

      const result = await service.getExportStatus(mockUserId);

      expect(result.status).toBe('completed');
      expect((result as any).downloadUrl).toBe('abc123');
    });

    it('should mark expired exports correctly', async () => {
      const expiredExport = {
        ...mockExportRequest,
        status: 'completed',
        downloadUrl: 'expired-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      mockDb.select.mockReturnValueOnce(mockQuery([expiredExport]));

      // Update status to expired
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.getExportStatus(mockUserId);

      expect(result.status).toBe('expired');
      expect((result as any).downloadUrl).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getExportDownload
  // ---------------------------------------------------------------------------
  describe('getExportDownload', () => {
    it('should return null for non-existent token', () => {
      const result = service.getExportDownload('non-existent');

      expect(result).toBeNull();
    });

    it('should return export data for valid token', () => {
      // Manually set data in the store
      (service as any).exportStore.set('valid-token', {
        data: '{"test": true}',
        contentType: 'application/json',
        filename: 'export.json',
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      const result = service.getExportDownload('valid-token');

      expect(result).not.toBeNull();
      expect(result!.contentType).toBe('application/json');
      expect(result!.data).toBe('{"test": true}');
    });

    it('should return null for expired token', () => {
      (service as any).exportStore.set('expired-token', {
        data: '{}',
        contentType: 'application/json',
        filename: 'export.json',
        expiresAt: Date.now() - 1000,
      });

      const result = service.getExportDownload('expired-token');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // convertToCsv
  // ---------------------------------------------------------------------------
  describe('convertToCsv', () => {
    it('should generate valid CSV with user data', () => {
      const exportData = {
        exportedAt: '2026-02-15T00:00:00.000Z',
        format: 'csv' as const,
        user: mockUser,
        preferences: null,
        accounts: [
          {
            id: 'acc-1',
            name: 'Checking',
            type: 'checking',
            mask: '****1234',
            currentBalance: 1500.5,
          },
        ],
        transactions: [],
        budgets: [],
        budgetPeriods: [],
        recurringTransactions: [],
        savingsGoals: [],
        savingsContributions: [],
        notificationPreferences: null,
        notifications: [],
        financialHealthScores: [],
        auditLog: [],
      };

      const csv = service.convertToCsv(exportData);

      expect(csv).toContain('# FinanceOwl Data Export');
      expect(csv).toContain('## User Profile');
      expect(csv).toContain('test@example.com');
      expect(csv).toContain('## Accounts');
      expect(csv).toContain('****1234');
    });

    it('should handle empty data sets gracefully', () => {
      const exportData = {
        exportedAt: '2026-02-15T00:00:00.000Z',
        format: 'csv' as const,
        user: mockUser,
        preferences: null,
        accounts: [],
        transactions: [],
        budgets: [],
        budgetPeriods: [],
        recurringTransactions: [],
        savingsGoals: [],
        savingsContributions: [],
        notificationPreferences: null,
        notifications: [],
        financialHealthScores: [],
        auditLog: [],
      };

      const csv = service.convertToCsv(exportData);

      expect(csv).toContain('## User Profile');
      expect(csv).not.toContain('## Accounts');
      expect(csv).not.toContain('## Transactions');
    });

    it('should properly escape CSV values with commas', () => {
      const exportData = {
        exportedAt: '2026-02-15T00:00:00.000Z',
        format: 'csv' as const,
        user: { ...mockUser, name: 'User, With Comma' },
        preferences: null,
        accounts: [],
        transactions: [],
        budgets: [],
        budgetPeriods: [],
        recurringTransactions: [],
        savingsGoals: [],
        savingsContributions: [],
        notificationPreferences: null,
        notifications: [],
        financialHealthScores: [],
        auditLog: [],
      };

      const csv = service.convertToCsv(exportData);

      expect(csv).toContain('"User, With Comma"');
    });
  });

  // ---------------------------------------------------------------------------
  // cleanExpiredExports
  // ---------------------------------------------------------------------------
  describe('cleanExpiredExports', () => {
    it('should clean expired exports from memory', () => {
      (service as any).exportStore.set('expired-1', {
        data: '{}',
        contentType: 'application/json',
        filename: 'export.json',
        expiresAt: Date.now() - 1000,
      });
      (service as any).exportStore.set('valid-1', {
        data: '{}',
        contentType: 'application/json',
        filename: 'export.json',
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      const cleaned = service.cleanExpiredExports();

      expect(cleaned).toBe(1);
      expect((service as any).exportStore.size).toBe(1);
      expect((service as any).exportStore.has('valid-1')).toBe(true);
    });

    it('should return 0 when no expired exports exist', () => {
      const cleaned = service.cleanExpiredExports();

      expect(cleaned).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // gatherUserData
  // ---------------------------------------------------------------------------
  describe('gatherUserData', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.gatherUserData('non-existent', 'json'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should gather all user data with masked account numbers', async () => {
      // User
      mockDb.select.mockReturnValueOnce(mockQuery([mockUser]));
      // Preferences
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ userId: mockUserId, currency: 'USD' }]),
      );
      // Accounts (with mask field)
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          {
            id: 'acc-1',
            name: 'Checking',
            mask: '1234',
            type: 'checking',
          },
        ]),
      );
      // Transactions
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          {
            id: 'tx-1',
            amount: 50.0,
            name: 'Grocery Store',
            date: '2026-02-10',
          },
        ]),
      );
      // Budgets
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Recurring
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Savings goals
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Notification prefs
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Notifications
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Financial health
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Audit log
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.gatherUserData(mockUserId, 'json');

      expect(result.user.email).toBe('test@example.com');
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].mask).toBe('****1234');
      expect(result.transactions).toHaveLength(1);
      expect(result.format).toBe('json');
    });
  });
});
