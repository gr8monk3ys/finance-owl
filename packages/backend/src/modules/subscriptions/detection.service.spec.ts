import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetectionService, type TransactionRecord } from './detection.service';
import type { DrizzleDB } from '../../database/database.module';

describe('DetectionService', () => {
  let service: DetectionService;
  let mockDb: DrizzleDB;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    } as any;

    service = new DetectionService(mockDb);
  });

  // ─── Fixtures for the pure recurrence pipeline ──────────────────────

  /**
   * A fixed "now". The recurrence tests drive `analyzeTransactions`, the
   * documented pure entry point, so they need neither a Drizzle builder mock
   * nor the wall clock -- dates anchored to `Date.now()` quietly change which
   * side of the cancellation window a charge falls on as the suite ages.
   */
  const NOW = new Date('2026-03-15T12:00:00Z');

  /** The date-only string for `days` days before NOW. */
  const daysBefore = (days: number): string =>
    new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  /** One charge from `merchantName`, `days` before NOW. */
  function charge(
    merchantName: string | null,
    amount: number,
    days: number,
    overrides: Partial<TransactionRecord> = {},
  ): TransactionRecord {
    return {
      name: merchantName ?? 'Recurring Service',
      merchantName,
      amount,
      date: daysBefore(days),
      accountId: 'acc_1',
      categoryId: 'cat_1',
      ...overrides,
    };
  }

  /** The active subscriptions the pure pipeline finds in `transactions`. */
  const detect = (transactions: TransactionRecord[]) =>
    service.analyzeTransactions(transactions, NOW).active;

  // ─── Recurring Pattern Matching ─────────────────────────────────────

  describe('analyzeTransactions - recurring pattern matching', () => {
    it('should detect monthly subscription (e.g., Netflix)', () => {
      const result = detect([5, 35, 65].map((days) => charge('Netflix', 15.99, days)));

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        merchantName: 'Netflix',
        estimatedAmount: 15.99,
        frequency: 'monthly',
      });
    });

    it('should detect weekly subscription', () => {
      const result = detect(
        [3, 10, 17].map((days) => charge('HelloFresh', 69.99, days, { name: 'Meal Kit' })),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        merchantName: 'HelloFresh',
        estimatedAmount: 69.99,
        frequency: 'weekly',
      });
      // Next expected date = last charge + one weekly cycle.
      expect(result[0].nextExpectedDate).toBe(daysBefore(-4));
    });

    it('should reject inconsistent amounts (high standard deviation)', () => {
      const result = detect([
        charge('Local Diner', 50.0, 5, { name: 'Restaurant' }),
        charge('Local Diner', 15.0, 35, { name: 'Restaurant' }),
        charge('Local Diner', 85.0, 65, { name: 'Restaurant' }),
      ]);

      expect(result).toHaveLength(0);
    });

    it('should handle empty transaction list', () => {
      expect(service.analyzeTransactions([], NOW)).toEqual({
        active: [],
        cancelled: [],
        totalMonthlyEstimate: 0,
        totalAnnualEstimate: 0,
      });
    });

    it('should detect quarterly subscription', () => {
      const result = detect(
        [10, 100, 190].map((days) => charge('State Farm', 450.0, days, { name: 'Insurance' })),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        merchantName: 'State Farm',
        frequency: 'quarterly',
      });
    });

    it('should group transactions by merchant name correctly', () => {
      const result = detect([
        ...[5, 36].map((days) => charge('Spotify', 9.99, days, { name: 'Spotify Premium' })),
        ...[3, 17].map((days) =>
          charge('Planet Fitness', 10.0, days, { name: 'Gym', categoryId: 'cat_2' }),
        ),
      ]);

      expect(result).toHaveLength(2);
      const spotify = result.find((r) => r.merchantName === 'Spotify');
      const gym = result.find((r) => r.merchantName === 'Planet Fitness');

      expect(spotify).toBeDefined();
      expect(spotify?.frequency).toBe('monthly');
      expect(gym).toBeDefined();
      expect(gym?.frequency).toBe('biweekly');
    });

    it('should skip merchants with only 1 transaction', () => {
      expect(detect([charge('Amazon', 29.99, 30, { name: 'One-time Purchase' })])).toEqual([]);
    });

    it('should handle transactions with null merchantName', () => {
      const result = detect([5, 35, 65].map((days) => charge(null, 25.0, days)));

      expect(result).toHaveLength(1);
      expect(result[0].merchantName).toBe('Recurring Service');
    });

    it('should tolerate small amount variations within 10%', () => {
      const result = detect([
        charge('Netflix', 15.99, 10, { name: 'Streaming', categoryId: null }),
        charge('Netflix', 16.49, 40, { name: 'Streaming', categoryId: null }),
        charge('Netflix', 15.99, 70, { name: 'Streaming', categoryId: null }),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('monthly');
    });

    it('should detect biweekly subscription', () => {
      const result = detect(
        [3, 17, 31].map((days) =>
          charge('Maid Service', 120.0, days, { name: 'Cleaning', categoryId: null }),
        ),
      );

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('biweekly');
    });

    it('should report bimonthly and semiannual cadences the DTOs now accept', () => {
      const bimonthly = detect([5, 65, 125].map((days) => charge('Pest Control Co', 89.0, days)));
      const semiannual = detect(
        [20, 202, 384].map((days) => charge('Auto Insurance Co', 640.0, days)),
      );

      expect(bimonthly[0]?.frequency).toBe('bimonthly');
      expect(semiannual[0]?.frequency).toBe('semiannual');
      // 6 charges a year, not the 12 the old `?? 12` fallback assumed.
      expect(bimonthly[0]?.annualCostProjection).toBeCloseTo(89.0 * 6, 2);
      expect(semiannual[0]?.annualCostProjection).toBeCloseTo(640.0 * 2, 2);
    });
  });

  // ─── Confidence Scoring ─────────────────────────────────────────────

  describe('calculateConfidence', () => {
    it('should return high confidence for exact amounts and intervals', () => {
      const sorted = [
        { date: '2025-10-15', amount: 9.99 },
        { date: '2025-11-15', amount: 9.99 },
        { date: '2025-12-15', amount: 9.99 },
        { date: '2026-01-15', amount: 9.99 },
        { date: '2026-02-14', amount: 9.99 },
        { date: '2026-03-15', amount: 9.99 },
      ];
      const intervals = [31, 30, 31, 30, 29];
      const frequency = 'monthly';
      const meanAmount = 9.99;
      const stdDev = 0;

      const result = service.calculateConfidence(
        sorted,
        intervals,
        frequency,
        meanAmount,
        stdDev,
        'Spotify',
      );

      expect(result.confidence).toBe('high');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('should return medium confidence for slightly varying amounts', () => {
      const sorted = [
        { date: '2025-12-15', amount: 9.99 },
        { date: '2026-01-15', amount: 12.49 },
        { date: '2026-02-15', amount: 10.99 },
      ];
      const intervals = [31, 31];
      const frequency = 'monthly';
      const meanAmount = 11.16;
      const stdDev = service.standardDeviation([9.99, 12.49, 10.99]);

      const result = service.calculateConfidence(
        sorted,
        intervals,
        frequency,
        meanAmount,
        stdDev,
        'Unknown Merchant',
      );

      expect(result.confidence).toBe('medium');
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(80);
    });

    it('should return low confidence for few data points and irregular intervals', () => {
      const sorted = [
        { date: '2025-12-01', amount: 20.0 },
        { date: '2026-01-10', amount: 30.0 },
      ];
      const intervals = [40];
      const frequency = 'monthly';
      const meanAmount = 25.0;
      const stdDev = service.standardDeviation([20.0, 30.0]);

      const result = service.calculateConfidence(
        sorted,
        intervals,
        frequency,
        meanAmount,
        stdDev,
        'Unknown Merchant',
      );

      expect(result.confidence).toBe('low');
      expect(result.score).toBeLessThan(50);
    });

    it('should award maximum data point score for 6+ transactions', () => {
      const sorted = Array.from({ length: 7 }, (_, i) => ({
        date: `2025-${String(6 + i).padStart(2, '0')}-15`,
        amount: 9.99,
      }));
      const intervals = Array(6).fill(30);
      const result = service.calculateConfidence(sorted, intervals, 'monthly', 9.99, 0, 'Spotify');
      // 35 (exact amount) + 35 (exact interval) + 17 (7 txns, 6+ bracket) + 10 (known merchant) = 97
      expect(result.score).toBe(97);
      expect(result.confidence).toBe('high');
    });

    it('should award moderate data point score for 3 transactions', () => {
      const sorted = [
        { date: '2025-11-15', amount: 9.99 },
        { date: '2025-12-15', amount: 9.99 },
        { date: '2026-01-15', amount: 9.99 },
      ];
      const intervals = [30, 31];
      const result = service.calculateConfidence(sorted, intervals, 'monthly', 9.99, 0, 'Spotify');
      // 35 + some interval score + 9 + 10
      expect(result.score).toBeGreaterThanOrEqual(50);
    });
  });

  // ─── Category Assignment ────────────────────────────────────────────

  describe('assignCategory', () => {
    it('should assign streaming category for Netflix', () => {
      expect(service.assignCategory('Netflix')).toBe('streaming');
    });

    it('should assign music category for Spotify', () => {
      expect(service.assignCategory('Spotify')).toBe('music');
    });

    it('should assign fitness category for Planet Fitness', () => {
      expect(service.assignCategory('Planet Fitness')).toBe('fitness');
    });

    it('should assign software category for Adobe', () => {
      expect(service.assignCategory('Adobe')).toBe('software');
    });

    it('should assign food_delivery category for DoorDash', () => {
      expect(service.assignCategory('DoorDash')).toBe('food_delivery');
    });

    it('should assign news category for New York Times', () => {
      expect(service.assignCategory('New York Times')).toBe('news');
    });

    it('should assign gaming category for Xbox Game Pass', () => {
      expect(service.assignCategory('Xbox Game Pass')).toBe('gaming');
    });

    it('should assign productivity category for Microsoft 365', () => {
      expect(service.assignCategory('Microsoft 365')).toBe('productivity');
    });

    it('should assign cloud_storage category for Google One', () => {
      expect(service.assignCategory('Google One')).toBe('cloud_storage');
    });

    it('should return other for unknown merchants', () => {
      expect(service.assignCategory('Random Local Business')).toBe('other');
    });

    it('should handle case-insensitive matching', () => {
      expect(service.assignCategory('NETFLIX')).toBe('streaming');
      expect(service.assignCategory('spotify')).toBe('music');
      expect(service.assignCategory('ADOBE CREATIVE CLOUD')).toBe('software');
    });

    it('should do partial match (merchant name contains keyword)', () => {
      expect(service.assignCategory('Netflix Inc.')).toBe('streaming');
      expect(service.assignCategory('Spotify USA LLC')).toBe('music');
    });
  });

  // ─── Trial Detection ────────────────────────────────────────────────

  describe('detectTrial', () => {
    it('should detect trial when only 1 recent charge', () => {
      const now = new Date();
      const recentDate = new Date(now);
      recentDate.setDate(recentDate.getDate() - 10);

      const sorted = [{ date: recentDate.toISOString().split('T')[0], amount: 9.99 }];

      expect(service.detectTrial(sorted)).toBe(true);
    });

    it('should detect trial when 2 recent charges within 45 days', () => {
      const now = new Date();
      const date1 = new Date(now);
      date1.setDate(date1.getDate() - 30);
      const date2 = new Date(now);
      date2.setDate(date2.getDate() - 5);

      const sorted = [
        { date: date1.toISOString().split('T')[0], amount: 9.99 },
        { date: date2.toISOString().split('T')[0], amount: 9.99 },
      ];

      expect(service.detectTrial(sorted)).toBe(true);
    });

    it('should not detect trial with 3+ charges', () => {
      const sorted = [
        { date: '2025-11-15', amount: 9.99 },
        { date: '2025-12-15', amount: 9.99 },
        { date: '2026-01-15', amount: 9.99 },
      ];

      expect(service.detectTrial(sorted)).toBe(false);
    });

    it('should not detect trial when first charge is older than 45 days', () => {
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 60);

      const sorted = [{ date: oldDate.toISOString().split('T')[0], amount: 9.99 }];

      expect(service.detectTrial(sorted)).toBe(false);
    });
  });

  // ─── Price Change Detection ─────────────────────────────────────────

  describe('detectPriceChange', () => {
    it('should detect a price increase over 5%', () => {
      const sorted = [
        { date: '2025-10-15', amount: 10.0 },
        { date: '2025-11-15', amount: 10.0 },
        { date: '2025-12-15', amount: 10.0 },
        { date: '2026-01-15', amount: 11.0 }, // 10% increase
      ];

      const result = service.detectPriceChange(sorted);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe('increase');
      expect(result!.changePercent).toBeGreaterThan(5);
      expect(result!.currentAmount).toBe(11.0);
      expect(result!.previousAmount).toBe(10.0);
    });

    it('should detect a price decrease over 5%', () => {
      const sorted = [
        { date: '2025-10-15', amount: 15.0 },
        { date: '2025-11-15', amount: 15.0 },
        { date: '2025-12-15', amount: 15.0 },
        { date: '2026-01-15', amount: 12.0 }, // 20% decrease
      ];

      const result = service.detectPriceChange(sorted);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe('decrease');
      expect(result!.changePercent).toBeLessThan(-5);
      expect(result!.currentAmount).toBe(12.0);
    });

    it('should not flag small price changes (under 5%)', () => {
      const sorted = [
        { date: '2025-10-15', amount: 10.0 },
        { date: '2025-11-15', amount: 10.0 },
        { date: '2025-12-15', amount: 10.0 },
        { date: '2026-01-15', amount: 10.3 }, // 3% increase
      ];

      const result = service.detectPriceChange(sorted);
      expect(result).toBeNull();
    });

    it('should return null for fewer than 3 transactions', () => {
      const sorted = [
        { date: '2025-12-15', amount: 10.0 },
        { date: '2026-01-15', amount: 12.0 },
      ];

      const result = service.detectPriceChange(sorted);
      expect(result).toBeNull();
    });

    it('should handle negative amounts (debits)', () => {
      const sorted = [
        { date: '2025-10-15', amount: -10.0 },
        { date: '2025-11-15', amount: -10.0 },
        { date: '2025-12-15', amount: -10.0 },
        { date: '2026-01-15', amount: -12.0 }, // 20% increase in magnitude
      ];

      const result = service.detectPriceChange(sorted);
      expect(result).not.toBeNull();
      expect(result!.direction).toBe('increase');
    });
  });

  // ─── Duplicate Detection ────────────────────────────────────────────

  describe('detectDuplicates', () => {
    it('should detect duplicate subscriptions for the same service', async () => {
      const subscriptions = [
        {
          id: 'sub_1',
          name: 'Netflix',
          merchantName: 'Netflix',
          accountId: 'acc_1',
          estimatedAmount: 15.99,
          frequency: 'monthly',
        },
        {
          id: 'sub_2',
          name: 'Netflix',
          merchantName: 'Netflix Inc',
          accountId: 'acc_2',
          estimatedAmount: 15.99,
          frequency: 'monthly',
        },
      ];

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(subscriptions),
      };
      mockDb.select = vi.fn().mockReturnValue(selectChain);

      const result = await service.detectDuplicates('user_1');

      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('netflix');
      expect(result[0].subscriptions).toHaveLength(2);
    });

    it('should not report non-duplicate subscriptions', async () => {
      const subscriptions = [
        {
          id: 'sub_1',
          name: 'Netflix',
          merchantName: 'Netflix',
          accountId: 'acc_1',
          estimatedAmount: 15.99,
          frequency: 'monthly',
        },
        {
          id: 'sub_2',
          name: 'Spotify',
          merchantName: 'Spotify',
          accountId: 'acc_1',
          estimatedAmount: 9.99,
          frequency: 'monthly',
        },
      ];

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(subscriptions),
      };
      mockDb.select = vi.fn().mockReturnValue(selectChain);

      const result = await service.detectDuplicates('user_1');

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no subscriptions exist', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select = vi.fn().mockReturnValue(selectChain);

      const result = await service.detectDuplicates('user_1');
      expect(result).toEqual([]);
    });

    it('should normalize known service name variations', async () => {
      const subscriptions = [
        {
          id: 'sub_1',
          name: 'Spotify Premium',
          merchantName: 'Spotify',
          accountId: 'acc_1',
          estimatedAmount: 9.99,
          frequency: 'monthly',
        },
        {
          id: 'sub_2',
          name: 'Spotify Family',
          merchantName: 'Spotify USA',
          accountId: 'acc_2',
          estimatedAmount: 14.99,
          frequency: 'monthly',
        },
      ];

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(subscriptions),
      };
      mockDb.select = vi.fn().mockReturnValue(selectChain);

      const result = await service.detectDuplicates('user_1');

      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('spotify');
    });
  });

  // ─── Normalize Service Name ─────────────────────────────────────────

  describe('normalizeServiceName', () => {
    it('should normalize known service names', () => {
      expect(service.normalizeServiceName('Netflix')).toBe('netflix');
      expect(service.normalizeServiceName('Netflix Inc')).toBe('netflix');
      expect(service.normalizeServiceName('netflix.com')).toBe('netflix');
    });

    it('should normalize Spotify variations', () => {
      expect(service.normalizeServiceName('Spotify')).toBe('spotify');
      expect(service.normalizeServiceName('Spotify USA')).toBe('spotify');
      expect(service.normalizeServiceName('Spotify AB')).toBe('spotify');
    });

    it('should normalize Disney+ variations', () => {
      expect(service.normalizeServiceName('Disney+')).toBe('disney+');
      expect(service.normalizeServiceName('Disney Plus')).toBe('disney+');
    });

    it('should strip common suffixes for unknown services', () => {
      const result = service.normalizeServiceName('Some Service LLC');
      expect(result).not.toContain('llc');
    });

    it('should handle case insensitivity', () => {
      expect(service.normalizeServiceName('NETFLIX')).toBe('netflix');
      expect(service.normalizeServiceName('SPOTIFY USA')).toBe('spotify');
    });
  });

  // ─── Median and Standard Deviation Helpers ──────────────────────────

  describe('median', () => {
    it('should return median of odd-length array', () => {
      expect(service.median([1, 3, 5])).toBe(3);
    });

    it('should return median of even-length array', () => {
      expect(service.median([1, 2, 3, 4])).toBe(2.5);
    });

    it('should return the single value for single-element array', () => {
      expect(service.median([42])).toBe(42);
    });

    it('should handle unsorted input', () => {
      expect(service.median([5, 1, 3])).toBe(3);
    });
  });

  describe('standardDeviation', () => {
    it('should return 0 for identical values', () => {
      expect(service.standardDeviation([10, 10, 10])).toBe(0);
    });

    it('should compute correct standard deviation', () => {
      // [1, 2, 3, 4, 5] -> mean=3, variance = (4+1+0+1+4)/5 = 2, stddev ~ 1.414
      const result = service.standardDeviation([1, 2, 3, 4, 5]);
      expect(result).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('should handle two values', () => {
      // [10, 20] -> mean=15, variance = (25+25)/2 = 25, stddev = 5
      expect(service.standardDeviation([10, 20])).toBe(5);
    });
  });

  // ─── Integration: Enhanced fields on analyzeTransactions output ──────

  describe('analyzeTransactions - enhanced fields', () => {
    it('should include confidence, category, and trial fields in results', () => {
      const result = detect([10, 40, 70].map((days) => charge('Netflix', 15.99, days)));

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('confidence');
      expect(result[0]).toHaveProperty('confidenceScore');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('isTrial');
      expect(result[0]).toHaveProperty('priceChange');

      expect(result[0].category).toBe('streaming');
      expect(result[0].confidence).toBeDefined();
      expect(typeof result[0].confidenceScore).toBe('number');
      expect(typeof result[0].isTrial).toBe('boolean');
    });

    it('should detect price change via detectPriceChange for amounts that span clusters', () => {
      // Amounts that differ >5% would be in separate clusters in detectForUser,
      // so we test the detectPriceChange method directly.
      const sorted = [
        { date: '2025-10-15', amount: 15.99 },
        { date: '2025-11-15', amount: 15.99 },
        { date: '2025-12-15', amount: 15.99 },
        { date: '2026-01-15', amount: 18.99 },
      ];

      const priceChange = service.detectPriceChange(sorted);

      expect(priceChange).not.toBeNull();
      expect(priceChange!.direction).toBe('increase');
      expect(priceChange!.currentAmount).toBe(18.99);
      expect(priceChange!.previousAmount).toBe(15.99);
    });
  });
});
