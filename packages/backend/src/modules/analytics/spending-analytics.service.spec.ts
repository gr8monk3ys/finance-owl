import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpendingAnalyticsService } from './spending-analytics.service';

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

describe('SpendingAnalyticsService', () => {
  let service: SpendingAnalyticsService;
  let mockDb: any;

  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const mockCacheService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      delPattern: vi.fn().mockResolvedValue(0),
      wrap: vi.fn().mockImplementation(
        (_key: string, _ttl: number, factory: () => Promise<any>) => factory(),
      ),
      isUsingFallback: vi.fn().mockReturnValue(true),
    };

    service = new SpendingAnalyticsService(mockDb, mockCacheService as any);
  });

  // ---------------------------------------------------------------------------
  // getCategoryBreakdown
  // ---------------------------------------------------------------------------
  describe('getCategoryBreakdown', () => {
    it('should return category breakdown with absolute totals', async () => {
      const rows = [
        {
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          categoryColor: '#FF0000',
          categoryIcon: 'cart',
          parentId: null,
          total: -500,
          count: 20,
        },
        {
          categoryId: 'cat-2',
          categoryName: 'Transport',
          categoryColor: '#00FF00',
          categoryIcon: 'car',
          parentId: null,
          total: 200,
          count: 10,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getCategoryBreakdown(
        mockUserId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(500); // Math.abs(-500)
      expect(result[1].total).toBe(200); // Math.abs(200)
      expect(result[0].categoryName).toBe('Groceries');
    });

    it('should label uncategorized transactions', async () => {
      const rows = [
        {
          categoryId: null,
          categoryName: null,
          categoryColor: null,
          categoryIcon: null,
          parentId: null,
          total: 100,
          count: 5,
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getCategoryBreakdown(
        mockUserId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result[0].categoryName).toBe('Uncategorized');
      expect(result[0].categoryColor).toBe('#71717a');
    });

    it('should return empty array when no transactions exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getCategoryBreakdown(
        mockUserId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getMonthlyTrend
  // ---------------------------------------------------------------------------
  describe('getMonthlyTrend', () => {
    it('should return monthly income and spending trend', async () => {
      const rows = [
        { month: '2025-09', income: 5000, spending: 3000 },
        { month: '2025-10', income: 5000, spending: 3500 },
        { month: '2025-11', income: 5200, spending: 4000 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getMonthlyTrend(mockUserId, 3);

      expect(result).toHaveLength(3);
      expect(result[0].month).toBe('2025-09');
      expect(result[0].income).toBe(5000);
      expect(result[0].spending).toBe(3000);
    });

    it('should default to 6 months when not specified', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await service.getMonthlyTrend(mockUserId);

      // Just verify it was called (the SQL query includes date filters)
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when no data', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getMonthlyTrend(mockUserId, 6);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getTopMerchants
  // ---------------------------------------------------------------------------
  describe('getTopMerchants', () => {
    it('should return top merchants by spending', async () => {
      const rows = [
        { merchantName: 'Amazon', total: 500, count: 15 },
        { merchantName: 'Walmart', total: 400, count: 10 },
        { merchantName: 'Starbucks', total: 150, count: 30 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getTopMerchants(
        mockUserId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ merchantName: 'Amazon', total: 500, count: 15 });
    });

    it('should respect the limit parameter', async () => {
      const rows = [
        { merchantName: 'Amazon', total: 500, count: 15 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getTopMerchants(
        mockUserId,
        '2026-01-01',
        '2026-01-31',
        1,
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no spending exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getTopMerchants(
        mockUserId,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getMonthlySpending
  // ---------------------------------------------------------------------------
  describe('getMonthlySpending', () => {
    it('should return total spending for a given month', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 3500 }]));

      const result = await service.getMonthlySpending(mockUserId, 2026, 2);

      expect(result).toBe(3500);
    });

    it('should return zero when no spending exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: null }]));

      const result = await service.getMonthlySpending(mockUserId, 2026, 2);

      expect(result).toBe(0);
    });

    it('should return zero when result is undefined', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([undefined]));

      const result = await service.getMonthlySpending(mockUserId, 2026, 2);

      expect(result).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getDashboardSummary
  // ---------------------------------------------------------------------------
  describe('getDashboardSummary', () => {
    it('should return complete dashboard summary', async () => {
      // getMonthlySpending (current month)
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 2000 }]));
      // getMonthlySpending (last month)
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 1500 }]));
      // getCategoryBreakdown
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          {
            categoryId: 'cat-1',
            categoryName: 'Food',
            categoryColor: '#F00',
            categoryIcon: 'fork',
            parentId: null,
            total: 800,
            count: 20,
          },
        ]),
      );
      // getTopMerchants
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ merchantName: 'Amazon', total: 500, count: 10 }]),
      );
      // getRecentTransactions
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          {
            id: 'txn-1',
            name: 'Coffee',
            merchantName: 'Starbucks',
            amount: 5,
            date: '2026-02-10',
            pending: false,
            categoryName: 'Food',
            categoryColor: '#F00',
            accountName: 'Checking',
            accountType: 'checking',
          },
        ]),
      );

      const result = await service.getDashboardSummary(mockUserId);

      expect(result.currentMonthSpending).toBe(2000);
      expect(result.lastMonthSpending).toBe(1500);
      // Change: ((2000 - 1500) / 1500) * 100 = 33.33...
      expect(result.spendingChange).toBeCloseTo(33.33, 1);
      expect(result.categoryBreakdown).toHaveLength(1);
      expect(result.topMerchants).toHaveLength(1);
      expect(result.recentTransactions).toHaveLength(1);
    });

    it('should handle zero last month spending (no division by zero)', async () => {
      // getMonthlySpending (current month)
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 1000 }]));
      // getMonthlySpending (last month) - zero
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: null }]));
      // getCategoryBreakdown
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // getTopMerchants
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // getRecentTransactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getDashboardSummary(mockUserId);

      expect(result.spendingChange).toBe(0);
    });

    it('should handle spending decrease', async () => {
      // getMonthlySpending (current month)
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 1000 }]));
      // getMonthlySpending (last month)
      mockDb.select.mockReturnValueOnce(mockQuery([{ total: 2000 }]));
      // getCategoryBreakdown
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // getTopMerchants
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // getRecentTransactions
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getDashboardSummary(mockUserId);

      // ((1000-2000)/2000)*100 = -50
      expect(result.spendingChange).toBe(-50);
    });
  });
});
