import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DetectionService } from './detection.service';
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

  // ─── Helper to set up mock DB chains ────────────────────────────────
  function setupDetectMocks(transactions: any[], existingRecords: any[] = []) {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(transactions),
    };

    const existingCheckChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(existingRecords),
    };

    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };

    const updateChain = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockDb.select = vi
      .fn()
      .mockReturnValueOnce(selectChain) // First call: get transactions
      .mockReturnValue(existingCheckChain); // Subsequent calls: check existing

    mockDb.insert = vi.fn().mockReturnValue(insertChain);
    mockDb.update = vi.fn().mockReturnValue(updateChain);
  }

  // ─── Recurring Pattern Matching ─────────────────────────────────────

  describe('detectForUser - recurring pattern matching', () => {
    it('should detect monthly subscription (e.g., Netflix)', async () => {
      // Dates are relative to today so the subscription stays "active"
      // (a last charge more than 1.5 cycles ago is classified cancelled).
      const iso = (daysAgo: number) =>
        new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const transactions = [5, 35, 65].map((daysAgo) => ({
        name: 'Netflix',
        merchantName: 'Netflix',
        amount: 15.99,
        date: iso(daysAgo),
        accountId: 'acc_1',
        categoryId: 'cat_1',
        pending: false,
      }));

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        merchantName: 'Netflix',
        estimatedAmount: 15.99,
        frequency: 'monthly',
      });
    });

    it('should detect weekly subscription', async () => {
      // Use dates close to today so the subscription is not detected as cancelled.
      // Weekly frequency * 1.5 = 10.5 days; last charge must be within that window.
      const today = new Date();
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 3);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 10);
      const d3 = new Date(today);
      d3.setDate(d3.getDate() - 17);
      const fmt = (d: Date) => d.toISOString().split('T')[0];

      const transactions = [
        {
          name: 'Meal Kit',
          merchantName: 'HelloFresh',
          amount: 69.99,
          date: fmt(d1),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Meal Kit',
          merchantName: 'HelloFresh',
          amount: 69.99,
          date: fmt(d2),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Meal Kit',
          merchantName: 'HelloFresh',
          amount: 69.99,
          date: fmt(d3),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        merchantName: 'HelloFresh',
        estimatedAmount: 69.99,
        frequency: 'weekly',
      });
      // Next expected date = last charge + 7 days
      const expectedNext = new Date(d1);
      expectedNext.setDate(expectedNext.getDate() + 7);
      expect(result[0].nextExpectedDate).toBe(fmt(expectedNext));
    });

    it('should reject inconsistent amounts (high standard deviation)', async () => {
      const transactions = [
        {
          name: 'Restaurant',
          merchantName: 'Local Diner',
          amount: 50.0,
          date: '2026-01-30',
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Restaurant',
          merchantName: 'Local Diner',
          amount: 15.0,
          date: '2025-12-30',
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Restaurant',
          merchantName: 'Local Diner',
          amount: 85.0,
          date: '2025-11-30',
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(0);
    });

    it('should handle empty transaction list', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select = vi.fn().mockReturnValue(selectChain);

      const result = await service.detectForUser('user_1');
      expect(result).toEqual([]);
    });

    it('should detect quarterly subscription', async () => {
      // Relative dates: last charge recent enough to remain active.
      const iso = (daysAgo: number) =>
        new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const transactions = [10, 100, 190].map((daysAgo) => ({
        name: 'Insurance',
        merchantName: 'State Farm',
        amount: 450.0,
        date: iso(daysAgo),
        accountId: 'acc_1',
        categoryId: 'cat_1',
        pending: false,
      }));

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        merchantName: 'State Farm',
        frequency: 'quarterly',
      });
    });

    it('should group transactions by merchant name correctly', async () => {
      // Use dates relative to today so subscriptions are not detected as cancelled.
      // Spotify: monthly (last charge within 45 days)
      // Planet Fitness: biweekly (last charge within 21 days)
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];

      const spotifyD1 = new Date(today);
      spotifyD1.setDate(spotifyD1.getDate() - 5);
      const spotifyD2 = new Date(today);
      spotifyD2.setDate(spotifyD2.getDate() - 36);

      const gymD1 = new Date(today);
      gymD1.setDate(gymD1.getDate() - 3);
      const gymD2 = new Date(today);
      gymD2.setDate(gymD2.getDate() - 17);

      const transactions = [
        {
          name: 'Spotify Premium',
          merchantName: 'Spotify',
          amount: 9.99,
          date: fmt(spotifyD1),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Spotify Premium',
          merchantName: 'Spotify',
          amount: 9.99,
          date: fmt(spotifyD2),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Gym',
          merchantName: 'Planet Fitness',
          amount: 10.0,
          date: fmt(gymD1),
          accountId: 'acc_1',
          categoryId: 'cat_2',
          pending: false,
        },
        {
          name: 'Gym',
          merchantName: 'Planet Fitness',
          amount: 10.0,
          date: fmt(gymD2),
          accountId: 'acc_1',
          categoryId: 'cat_2',
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(2);
      const spotify = result.find((r) => r.merchantName === 'Spotify');
      const gym = result.find((r) => r.merchantName === 'Planet Fitness');

      expect(spotify).toBeDefined();
      expect(spotify?.frequency).toBe('monthly');
      expect(gym).toBeDefined();
      expect(gym?.frequency).toBe('biweekly');
    });

    it('should skip merchants with only 1 transaction', async () => {
      const transactions = [
        {
          name: 'One-time Purchase',
          merchantName: 'Amazon',
          amount: 29.99,
          date: '2026-01-15',
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');
      expect(result).toEqual([]);
    });

    it('should handle transactions with null merchantName', async () => {
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 5);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 35);
      const d3 = new Date(today);
      d3.setDate(d3.getDate() - 65);
      const transactions = [
        {
          name: 'Recurring Service',
          merchantName: null,
          amount: 25.0,
          date: fmt(d1),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Recurring Service',
          merchantName: null,
          amount: 25.0,
          date: fmt(d2),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Recurring Service',
          merchantName: null,
          amount: 25.0,
          date: fmt(d3),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(1);
      expect(result[0].merchantName).toBe('Recurring Service');
    });

    it('should tolerate small amount variations within 10%', async () => {
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 10);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 40);
      const d3 = new Date(today);
      d3.setDate(d3.getDate() - 70);

      const transactions = [
        {
          name: 'Streaming',
          merchantName: 'Netflix',
          amount: 15.99,
          date: fmt(d1),
          accountId: 'acc_1',
          categoryId: null,
          pending: false,
        },
        {
          name: 'Streaming',
          merchantName: 'Netflix',
          amount: 16.49,
          date: fmt(d2),
          accountId: 'acc_1',
          categoryId: null,
          pending: false,
        },
        {
          name: 'Streaming',
          merchantName: 'Netflix',
          amount: 15.99,
          date: fmt(d3),
          accountId: 'acc_1',
          categoryId: null,
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('monthly');
    });

    it('should detect biweekly subscription', async () => {
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 3);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 17);
      const d3 = new Date(today);
      d3.setDate(d3.getDate() - 31);

      const transactions = [
        {
          name: 'Cleaning',
          merchantName: 'Maid Service',
          amount: 120.0,
          date: fmt(d1),
          accountId: 'acc_1',
          categoryId: null,
          pending: false,
        },
        {
          name: 'Cleaning',
          merchantName: 'Maid Service',
          amount: 120.0,
          date: fmt(d2),
          accountId: 'acc_1',
          categoryId: null,
          pending: false,
        },
        {
          name: 'Cleaning',
          merchantName: 'Maid Service',
          amount: 120.0,
          date: fmt(d3),
          accountId: 'acc_1',
          categoryId: null,
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('biweekly');
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

  // ─── Integration: Enhanced fields on detectForUser output ───────────

  describe('detectForUser - enhanced fields', () => {
    it('should include confidence, category, and trial fields in results', async () => {
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().split('T')[0];
      const d1 = new Date(today);
      d1.setDate(d1.getDate() - 10);
      const d2 = new Date(today);
      d2.setDate(d2.getDate() - 40);
      const d3 = new Date(today);
      d3.setDate(d3.getDate() - 70);

      const transactions = [
        {
          name: 'Netflix',
          merchantName: 'Netflix',
          amount: 15.99,
          date: fmt(d1),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Netflix',
          merchantName: 'Netflix',
          amount: 15.99,
          date: fmt(d2),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
        {
          name: 'Netflix',
          merchantName: 'Netflix',
          amount: 15.99,
          date: fmt(d3),
          accountId: 'acc_1',
          categoryId: 'cat_1',
          pending: false,
        },
      ];

      setupDetectMocks(transactions);
      const result = await service.detectForUser('user_1');

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
