import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetWorthService } from './net-worth.service';

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
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('NetWorthService', () => {
  let service: NetWorthService;
  let mockDb: any;
  let mockAccountsService: any;

  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockAccountsService = {
      getNetWorth: vi.fn(),
    };

    service = new NetWorthService(mockDb, mockAccountsService);
  });

  // ---------------------------------------------------------------------------
  // snapshotNetWorth
  // ---------------------------------------------------------------------------
  describe('snapshotNetWorth', () => {
    it('should create a new snapshot when none exists for today', async () => {
      const netWorthResult = {
        assets: 50000,
        liabilities: 20000,
        netWorth: 30000,
        accountCount: 5,
      };

      mockAccountsService.getNetWorth.mockResolvedValue(netWorthResult);
      // Existing snapshot check returns empty
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Insert
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.snapshotNetWorth(mockUserId);

      expect(mockAccountsService.getNetWorth).toHaveBeenCalledWith(mockUserId);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(netWorthResult);
    });

    it('should update existing snapshot when one already exists for today', async () => {
      const netWorthResult = {
        assets: 51000,
        liabilities: 20000,
        netWorth: 31000,
        accountCount: 5,
      };

      mockAccountsService.getNetWorth.mockResolvedValue(netWorthResult);
      // Existing snapshot found
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'snapshot-1' }]));
      // Update
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.snapshotNetWorth(mockUserId);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(result).toEqual(netWorthResult);
    });

    it('should handle zero net worth', async () => {
      const netWorthResult = {
        assets: 0,
        liabilities: 0,
        netWorth: 0,
        accountCount: 0,
      };

      mockAccountsService.getNetWorth.mockResolvedValue(netWorthResult);
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.snapshotNetWorth(mockUserId);

      expect(result.netWorth).toBe(0);
      expect(result.accountCount).toBe(0);
    });

    it('should handle negative net worth', async () => {
      const netWorthResult = {
        assets: 10000,
        liabilities: 50000,
        netWorth: -40000,
        accountCount: 3,
      };

      mockAccountsService.getNetWorth.mockResolvedValue(netWorthResult);
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.snapshotNetWorth(mockUserId);

      expect(result.netWorth).toBe(-40000);
    });
  });

  // ---------------------------------------------------------------------------
  // snapshotAllUsers
  // ---------------------------------------------------------------------------
  describe('snapshotAllUsers', () => {
    it('should snapshot net worth for all users', async () => {
      const users = [{ id: 'user-1' }, { id: 'user-2' }, { id: 'user-3' }];

      // Users query
      mockDb.select.mockReturnValueOnce(mockQuery(users));

      // For each user: getNetWorth + select (existing check) + insert
      for (const _user of users) {
        mockAccountsService.getNetWorth.mockResolvedValueOnce({
          assets: 10000,
          liabilities: 0,
          netWorth: 10000,
          accountCount: 1,
        });
        mockDb.select.mockReturnValueOnce(mockQuery([]));
        mockDb.insert.mockReturnValueOnce(mockQuery(undefined));
      }

      await service.snapshotAllUsers();

      expect(mockAccountsService.getNetWorth).toHaveBeenCalledTimes(3);
    });

    it('should continue processing when one user snapshot fails', async () => {
      const users = [{ id: 'user-1' }, { id: 'user-2' }];

      mockDb.select.mockReturnValueOnce(mockQuery(users));

      // First user fails
      mockAccountsService.getNetWorth.mockRejectedValueOnce(
        new Error('DB error'),
      );

      // Second user succeeds
      mockAccountsService.getNetWorth.mockResolvedValueOnce({
        assets: 5000,
        liabilities: 0,
        netWorth: 5000,
        accountCount: 1,
      });
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      // Should not throw
      await service.snapshotAllUsers();

      expect(mockAccountsService.getNetWorth).toHaveBeenCalledTimes(2);
    });

    it('should handle empty user list', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await service.snapshotAllUsers();

      expect(mockAccountsService.getNetWorth).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getHistory
  // ---------------------------------------------------------------------------
  describe('getHistory', () => {
    it('should return net worth history for the given number of days', async () => {
      const historyData = [
        { date: '2025-11-15', assets: 48000, liabilities: 20000, netWorth: 28000 },
        { date: '2025-12-15', assets: 49000, liabilities: 20000, netWorth: 29000 },
        { date: '2026-01-15', assets: 50000, liabilities: 20000, netWorth: 30000 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(historyData));

      const result = await service.getHistory(mockUserId, 90);

      expect(result).toEqual(historyData);
    });

    it('should use default of 90 days when not specified', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await service.getHistory(mockUserId);

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when no history exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getHistory(mockUserId, 30);

      expect(result).toEqual([]);
    });
  });
});
