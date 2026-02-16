import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PerformanceService } from './performance.service';

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

describe('PerformanceService', () => {
  let service: PerformanceService;
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

    service = new PerformanceService(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getPerformance
  // ---------------------------------------------------------------------------
  describe('getPerformance', () => {
    it('should return zero return when no holdings exist', async () => {
      // Holdings query returns empty
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getPerformance(mockUserId, '1M');

      expect(result).toEqual({
        totalReturn: 0,
        totalReturnPercent: 0,
        periodData: [],
      });
    });

    it('should calculate total return correctly', async () => {
      const holdings = [
        {
          securityId: 'sec-1',
          quantity: 10,
          costBasis: 1500,
          institutionValue: null,
          closePrice: 175, // value = 1750
        },
      ];

      const priceHistory = [
        { securityId: 'sec-1', price: 165, date: '2026-01-20' },
        { securityId: 'sec-1', price: 170, date: '2026-02-01' },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(holdings))
        .mockReturnValueOnce(mockQuery(priceHistory));

      const result = await service.getPerformance(mockUserId, '1M');

      expect(result.totalReturn).toBe(250); // 1750 - 1500
      expect(result.totalReturnPercent).toBeCloseTo(16.67, 1);
      expect(result.periodData.length).toBeGreaterThanOrEqual(2); // history + today
    });

    it('should handle multiple securities', async () => {
      const holdings = [
        {
          securityId: 'sec-1',
          quantity: 10,
          costBasis: 1500,
          institutionValue: null,
          closePrice: 175, // value = 1750
        },
        {
          securityId: 'sec-2',
          quantity: 5,
          costBasis: 600,
          institutionValue: null,
          closePrice: 140, // value = 700
        },
      ];

      const priceHistory: any[] = [];

      mockDb.select
        .mockReturnValueOnce(mockQuery(holdings))
        .mockReturnValueOnce(mockQuery(priceHistory));

      const result = await service.getPerformance(mockUserId, '1Y');

      // Total return: (1750+700) - (1500+600) = 2450 - 2100 = 350
      expect(result.totalReturn).toBe(350);
      expect(result.totalReturnPercent).toBeCloseTo(16.67, 1);
    });

    it('should use institutionValue when available', async () => {
      const holdings = [
        {
          securityId: 'sec-1',
          quantity: 10,
          costBasis: 1000,
          institutionValue: 1200,
          closePrice: 150, // Would give 1500 but institutionValue wins
        },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(holdings))
        .mockReturnValueOnce(mockQuery([]));

      const result = await service.getPerformance(mockUserId, '3M');

      expect(result.totalReturn).toBe(200); // 1200 - 1000
    });

    it('should handle zero cost basis', async () => {
      const holdings = [
        {
          securityId: 'sec-1',
          quantity: 10,
          costBasis: 0,
          institutionValue: null,
          closePrice: 100,
        },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(holdings))
        .mockReturnValueOnce(mockQuery([]));

      const result = await service.getPerformance(mockUserId, '1M');

      expect(result.totalReturn).toBe(1000);
      expect(result.totalReturnPercent).toBe(0); // Can't compute percent with 0 cost
    });

    it('should filter price history to only held securities', async () => {
      const holdings = [
        {
          securityId: 'sec-1',
          quantity: 10,
          costBasis: 1000,
          institutionValue: null,
          closePrice: 150,
        },
      ];

      // Price history includes securities user doesn't hold
      const priceHistory = [
        { securityId: 'sec-1', price: 140, date: '2026-01-15' },
        { securityId: 'sec-other', price: 50, date: '2026-01-15' }, // Not held
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(holdings))
        .mockReturnValueOnce(mockQuery(priceHistory));

      const result = await service.getPerformance(mockUserId, '3M');

      // Only sec-1 should appear in periodData
      const dates = result.periodData.map((p) => p.date);
      expect(dates).toContain('2026-01-15');
      // The value at 2026-01-15 should only include sec-1 (10 * 140 = 1400)
      const point = result.periodData.find((p) => p.date === '2026-01-15');
      expect(point!.value).toBe(1400);
    });

    it('should round totalReturn and totalReturnPercent to 2 decimal places', async () => {
      const holdings = [
        {
          securityId: 'sec-1',
          quantity: 3,
          costBasis: 100,
          institutionValue: null,
          closePrice: 33.333333,
        },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(holdings))
        .mockReturnValueOnce(mockQuery([]));

      const result = await service.getPerformance(mockUserId, '1M');

      // Check rounding: 3 * 33.333333 = ~99.999999, totalReturn = ~-0.000001
      expect(Number.isFinite(result.totalReturn)).toBe(true);
      expect(String(result.totalReturn).split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getHoldingPerformance
  // ---------------------------------------------------------------------------
  describe('getHoldingPerformance', () => {
    it('should return zero when holding not found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getHoldingPerformance(
        mockUserId,
        'non-existent',
      );

      expect(result).toEqual({
        totalReturn: 0,
        totalReturnPercent: 0,
        periodData: [],
      });
    });

    it('should calculate holding performance correctly', async () => {
      const holding = {
        securityId: 'sec-1',
        quantity: 10,
        costBasis: 1500,
        institutionValue: null,
        closePrice: 175, // value = 1750
      };

      const priceHistory = [
        { price: 150, date: '2025-12-01' },
        { price: 160, date: '2026-01-01' },
        { price: 170, date: '2026-02-01' },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery([holding]))
        .mockReturnValueOnce(mockQuery(priceHistory));

      const result = await service.getHoldingPerformance(
        mockUserId,
        'h-1',
      );

      expect(result.totalReturn).toBe(250); // 1750 - 1500
      expect(result.totalReturnPercent).toBeCloseTo(16.67, 1);
      expect(result.periodData).toHaveLength(3);
      // Each data point should be quantity * price
      expect(result.periodData[0]).toEqual({ date: '2025-12-01', value: 1500 });
      expect(result.periodData[1]).toEqual({ date: '2026-01-01', value: 1600 });
      expect(result.periodData[2]).toEqual({ date: '2026-02-01', value: 1700 });
    });

    it('should handle null costBasis for holding', async () => {
      const holding = {
        securityId: 'sec-1',
        quantity: 10,
        costBasis: null,
        institutionValue: null,
        closePrice: 100,
      };

      mockDb.select
        .mockReturnValueOnce(mockQuery([holding]))
        .mockReturnValueOnce(mockQuery([]));

      const result = await service.getHoldingPerformance(
        mockUserId,
        'h-1',
      );

      expect(result.totalReturn).toBe(1000); // 1000 - 0
      expect(result.totalReturnPercent).toBe(0); // 0 cost => 0%
    });

    it('should round totalReturn to 2 decimal places', async () => {
      const holding = {
        securityId: 'sec-1',
        quantity: 3,
        costBasis: 100,
        institutionValue: null,
        closePrice: 33.33,
      };

      mockDb.select
        .mockReturnValueOnce(mockQuery([holding]))
        .mockReturnValueOnce(mockQuery([]));

      const result = await service.getHoldingPerformance(
        mockUserId,
        'h-1',
      );

      // 3 * 33.33 = 99.99, return = -0.01
      expect(result.totalReturn).toBe(-0.01);
    });
  });
});
