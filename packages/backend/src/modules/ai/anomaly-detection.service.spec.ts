import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnomalyDetectionService } from './anomaly-detection.service';
import type { DrizzleDB } from '../../database/database.module';

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  let mockDb: DrizzleDB;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
    } as any;

    service = new AnomalyDetectionService(mockDb);
  });

  describe('detectAnomalies', () => {
    it('should detect anomalous transaction (z-score > 2)', async () => {
      const today = new Date('2026-02-15');
      const sevenDaysAgo = '2026-02-08';

      // Recent transaction with unusual amount
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'Starbucks',
          merchantName: 'Starbucks',
          amount: 45.0, // Anomalously high
          categoryId: 'cat_1',
          categoryName: 'Food & Drink',
        },
      ];

      // Historical stats: mean=$5, stddev=$1 (calculated from variance)
      // For amount=45, z-score = (45 - 5) / 1 = 40 (way above threshold of 2)
      const statsResults = [
        {
          merchantName: 'Starbucks',
          categoryId: 'cat_1',
          mean: 5.0,
          stddev: 1.0, // This is variance in the query, will be sqrt'd
          count: 10,
        },
      ];

      // Mock recent transactions query
      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      // Mock stats query
      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      // Mock existing notification check
      const existingNotificationChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing notification
      };

      // Mock insert notification
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain) // First: get recent transactions
        .mockReturnValueOnce(statsChain) // Second: get stats
        .mockReturnValue(existingNotificationChain); // Subsequent: check existing notifications

      mockDb.insert = vi.fn().mockReturnValue(insertChain);

      const result = await service.detectAnomalies('user_1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        transactionId: 'tx_1',
        merchantName: 'Starbucks',
        amount: 45.0,
        mean: 5.0,
        stddev: 1.0,
      });
      expect(result[0].zScore).toBeGreaterThan(2);
      expect(result[0].reason).toContain('higher');
      expect(result[0].reason).toContain('$45.00');
      expect(result[0].reason).toContain('$5.00');
    });

    it('should not flag normal transactions', async () => {
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'Starbucks',
          merchantName: 'Starbucks',
          amount: 5.5, // Within normal range
          categoryId: 'cat_1',
          categoryName: 'Food & Drink',
        },
      ];

      // Historical stats: mean=$5, stddev=$1
      // For amount=5.5, z-score = (5.5 - 5) / 1 = 0.5 (below threshold)
      const statsResults = [
        {
          merchantName: 'Starbucks',
          categoryId: 'cat_1',
          mean: 5.0,
          stddev: 1.0,
          count: 10,
        },
      ];

      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain)
        .mockReturnValueOnce(statsChain);

      const result = await service.detectAnomalies('user_1');

      // Should not flag this as anomalous
      expect(result).toHaveLength(0);
    });

    it('should skip merchants with fewer than 3 transactions', async () => {
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'New Restaurant',
          merchantName: 'New Restaurant',
          amount: 100.0, // High amount
          categoryId: 'cat_1',
          categoryName: 'Food & Drink',
        },
      ];

      // Stats show only 2 historical transactions (below threshold of 3)
      const statsResults = [
        {
          merchantName: 'New Restaurant',
          categoryId: 'cat_1',
          mean: 25.0,
          stddev: 5.0,
          count: 2, // Too few transactions
        },
      ];

      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain)
        .mockReturnValueOnce(statsChain);

      const result = await service.detectAnomalies('user_1');

      // Should skip this merchant due to insufficient history
      expect(result).toHaveLength(0);
    });

    it('should return results sorted by severity (z-score magnitude)', async () => {
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'Starbucks',
          merchantName: 'Starbucks',
          amount: 15.0, // z-score = (15 - 5) / 2 = 5
          categoryId: 'cat_1',
          categoryName: 'Food & Drink',
        },
        {
          id: 'tx_2',
          date: '2026-02-13',
          name: 'Target',
          merchantName: 'Target',
          amount: 250.0, // z-score = (250 - 100) / 20 = 7.5 (more severe)
          categoryId: 'cat_2',
          categoryName: 'Shopping',
        },
        {
          id: 'tx_3',
          date: '2026-02-12',
          name: 'Gas Station',
          merchantName: 'Shell',
          amount: 85.0, // z-score = (85 - 50) / 10 = 3.5
          categoryId: 'cat_3',
          categoryName: 'Transportation',
        },
      ];

      const statsResults = [
        {
          merchantName: 'Starbucks',
          categoryId: 'cat_1',
          mean: 5.0,
          stddev: 4.0, // variance = 4, stddev = 2
          count: 10,
        },
        {
          merchantName: 'Target',
          categoryId: 'cat_2',
          mean: 100.0,
          stddev: 400.0, // variance = 400, stddev = 20
          count: 15,
        },
        {
          merchantName: 'Shell',
          categoryId: 'cat_3',
          mean: 50.0,
          stddev: 100.0, // variance = 100, stddev = 10
          count: 8,
        },
      ];

      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      const existingNotificationChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain)
        .mockReturnValueOnce(statsChain)
        .mockReturnValue(existingNotificationChain);

      mockDb.insert = vi.fn().mockReturnValue(insertChain);

      const result = await service.detectAnomalies('user_1');

      expect(result).toHaveLength(3);
      // Should be sorted by z-score magnitude (most severe first)
      expect(result[0].merchantName).toBe('Target'); // z=7.5
      expect(result[1].merchantName).toBe('Starbucks'); // z=5
      expect(result[2].merchantName).toBe('Shell'); // z=3.5

      // Verify z-scores
      expect(Math.abs(result[0].zScore)).toBeGreaterThan(
        Math.abs(result[1].zScore),
      );
      expect(Math.abs(result[1].zScore)).toBeGreaterThan(
        Math.abs(result[2].zScore),
      );
    });

    it('should handle empty recent transactions', async () => {
      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi.fn().mockReturnValueOnce(recentTxChain);

      const result = await service.detectAnomalies('user_1');

      expect(result).toEqual([]);
    });

    it('should skip merchants with zero standard deviation', async () => {
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'Fixed Price Service',
          merchantName: 'Fixed Price Service',
          amount: 10.0,
          categoryId: 'cat_1',
          categoryName: 'Services',
        },
      ];

      // Stats with zero variance (all transactions same amount)
      const statsResults = [
        {
          merchantName: 'Fixed Price Service',
          categoryId: 'cat_1',
          mean: 10.0,
          stddev: 0, // No variance
          count: 5,
        },
      ];

      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain)
        .mockReturnValueOnce(statsChain);

      const result = await service.detectAnomalies('user_1');

      // Should skip to avoid division by zero
      expect(result).toHaveLength(0);
    });

    it('should detect negative z-scores (lower than usual)', async () => {
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'Grocery Store',
          merchantName: 'Whole Foods',
          amount: 20.0, // Much lower than usual
          categoryId: 'cat_1',
          categoryName: 'Groceries',
        },
      ];

      // Historical stats: mean=$100, stddev=$20
      // For amount=20, z-score = (20 - 100) / 20 = -4 (below threshold)
      const statsResults = [
        {
          merchantName: 'Whole Foods',
          categoryId: 'cat_1',
          mean: 100.0,
          stddev: 400.0, // variance=400, stddev=20
          count: 12,
        },
      ];

      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      const existingNotificationChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain)
        .mockReturnValueOnce(statsChain)
        .mockReturnValue(existingNotificationChain);

      mockDb.insert = vi.fn().mockReturnValue(insertChain);

      const result = await service.detectAnomalies('user_1');

      expect(result).toHaveLength(1);
      expect(result[0].zScore).toBeLessThan(-2);
      expect(result[0].reason).toContain('lower');
    });

    it('should handle transactions with null merchantName', async () => {
      const recentTransactions = [
        {
          id: 'tx_1',
          date: '2026-02-14',
          name: 'Unknown Merchant Transaction',
          merchantName: null, // No merchant name
          amount: 100.0,
          categoryId: 'cat_1',
          categoryName: 'Miscellaneous',
        },
      ];

      const statsResults = [
        {
          merchantName: null,
          categoryId: 'cat_1',
          mean: 25.0,
          stddev: 100.0, // variance=100, stddev=10
          count: 5,
        },
      ];

      const recentTxChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(recentTransactions),
      };

      const statsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue(statsResults),
      };

      const existingNotificationChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(recentTxChain)
        .mockReturnValueOnce(statsChain)
        .mockReturnValue(existingNotificationChain);

      mockDb.insert = vi.fn().mockReturnValue(insertChain);

      const result = await service.detectAnomalies('user_1');

      expect(result).toHaveLength(1);
      // Should use transaction name when merchantName is null
      expect(result[0].merchantName).toBe('Unknown Merchant Transaction');
    });
  });
});
