import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SmartSavingsService } from './smart-savings.service';

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

describe('SmartSavingsService', () => {
  let service: SmartSavingsService;
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

    service = new SmartSavingsService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // calculateRoundUp (pure function - no DB needed)
  // ---------------------------------------------------------------------------
  describe('calculateRoundUp', () => {
    it('should round up to nearest dollar', () => {
      // $4.25 -> $5.00, round-up = $0.75
      const result = service.calculateRoundUp(4.25, 1);
      expect(result).toBe(0.75);
    });

    it('should round up to nearest $5', () => {
      // $13.50 -> $15.00, round-up = $1.50
      const result = service.calculateRoundUp(13.5, 5);
      expect(result).toBe(1.5);
    });

    it('should round up to nearest $10', () => {
      // $23.00 -> $30.00, round-up = $7.00
      const result = service.calculateRoundUp(23, 10);
      expect(result).toBe(7);
    });

    it('should return 0 when amount is exact multiple', () => {
      // $10.00 -> $10.00, round-up = $0.00
      const result = service.calculateRoundUp(10, 5);
      expect(result).toBe(0);
    });

    it('should handle negative transaction amounts (using absolute value)', () => {
      // -$4.25 -> abs = $4.25, ceil to $5.00, round-up = $0.75
      const result = service.calculateRoundUp(-4.25, 1);
      expect(result).toBe(0.75);
    });

    it('should handle very small amounts', () => {
      // $0.01 -> $1.00, round-up = $0.99
      const result = service.calculateRoundUp(0.01, 1);
      expect(result).toBe(0.99);
    });

    it('should handle zero transaction amount', () => {
      const result = service.calculateRoundUp(0, 1);
      expect(result).toBe(0);
    });

    it('should round result to 2 decimal places', () => {
      // $1.33 -> $2.00, round-up = $0.67
      const result = service.calculateRoundUp(1.33, 1);
      expect(result).toBe(0.67);
      // Ensure precision
      const decimalPlaces = String(result).split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // analyzeSpendingPatterns
  // ---------------------------------------------------------------------------
  describe('analyzeSpendingPatterns', () => {
    it('should calculate spending analysis from 3 months of data', async () => {
      const monthlyData = [
        { month: '2025-11', income: 5000, expenses: 3000 },
        { month: '2025-12', income: 5000, expenses: 3500 },
        { month: '2026-01', income: 5000, expenses: 3200 },
      ];

      const categorySpending = [
        {
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          categoryColor: '#F00',
          categoryIcon: 'cart',
          total: 3000,
          count: 30,
        },
        {
          categoryId: 'cat-2',
          categoryName: 'Dining',
          categoryColor: '#0F0',
          categoryIcon: 'fork',
          total: 1500,
          count: 15,
        },
      ];

      // Monthly data query
      mockDb.select.mockReturnValueOnce(mockQuery(monthlyData));
      // Category spending query
      mockDb.select.mockReturnValueOnce(mockQuery(categorySpending));
      // Insert analysis
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.analyzeSpendingPatterns(mockUserId);

      // Average income: 15000/3 = 5000
      expect(result.averageMonthlyIncome).toBe(5000);
      // Average expenses: 9700/3 = 3233.33
      expect(result.averageMonthlyExpenses).toBeCloseTo(3233.33, 1);
      // Average surplus: 5000 - 3233.33 = 1766.67
      expect(result.averageSurplus).toBeCloseTo(1766.67, 1);
      // Safe savings: floor(1766.67 * 0.5 * 100) / 100 = 883.33
      expect(result.safeSavingsAmount).toBeCloseTo(883.33, 1);
      expect(result.recommendedSavingsRate).toBe(20);
      expect(result.monthlyData).toEqual(monthlyData);
    });

    it('should handle zero income gracefully', async () => {
      const monthlyData = [
        { month: '2026-01', income: 0, expenses: 500 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(monthlyData));
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.analyzeSpendingPatterns(mockUserId);

      expect(result.averageMonthlyIncome).toBe(0);
      expect(result.currentSavingsRate).toBe(0);
      expect(result.safeSavingsAmount).toBe(0);
    });

    it('should handle no transaction data', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.analyzeSpendingPatterns(mockUserId);

      expect(result.averageMonthlyIncome).toBe(0);
      expect(result.averageMonthlyExpenses).toBe(0);
      expect(result.safeSavingsAmount).toBe(0);
      expect(result.spendingReductions).toEqual([]);
    });

    it('should set safeSavingsAmount to 0 when surplus is negative', async () => {
      const monthlyData = [
        { month: '2026-01', income: 3000, expenses: 4000 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(monthlyData));
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.analyzeSpendingPatterns(mockUserId);

      expect(result.averageSurplus).toBe(-1000);
      expect(result.safeSavingsAmount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getLatestAnalysis
  // ---------------------------------------------------------------------------
  describe('getLatestAnalysis', () => {
    it('should return the most recent analysis', async () => {
      const analysis = {
        id: 'analysis-1',
        userId: mockUserId,
        averageMonthlyIncome: 5000,
        averageMonthlyExpenses: 3500,
        averageSurplus: 1500,
        recommendedSavingsRate: 20,
        currentSavingsRate: 30,
        analysisDate: '2026-02-15',
      };

      mockDb.select.mockReturnValueOnce(mockQuery([analysis]));

      const result = await service.getLatestAnalysis(mockUserId);

      expect(result).toEqual(analysis);
    });

    it('should return null when no analysis exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getLatestAnalysis(mockUserId);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // createRule
  // ---------------------------------------------------------------------------
  describe('createRule', () => {
    it('should create a round-up savings rule', async () => {
      const ruleData = {
        name: 'Round-Up Savings',
        ruleType: 'round_up',
        roundUpTo: 1,
        sourceAccountId: 'acct-1',
        targetGoalId: 'goal-1',
      };

      const createdRule = { id: 'rule-1', userId: mockUserId, ...ruleData };
      mockDb.insert.mockReturnValueOnce(mockQuery([createdRule]));

      const result = await service.createRule(mockUserId, ruleData);

      expect(result).toEqual(createdRule);
      expect(result.ruleType).toBe('round_up');
    });

    it('should create a fixed amount savings rule', async () => {
      const ruleData = {
        name: 'Weekly $50',
        ruleType: 'fixed',
        amount: 50,
      };

      const createdRule = { id: 'rule-2', userId: mockUserId, ...ruleData };
      mockDb.insert.mockReturnValueOnce(mockQuery([createdRule]));

      const result = await service.createRule(mockUserId, ruleData);

      expect(result.ruleType).toBe('fixed');
      expect(result.amount).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // getRules
  // ---------------------------------------------------------------------------
  describe('getRules', () => {
    it('should return all rules for a user', async () => {
      const rules = [
        { id: 'rule-1', userId: mockUserId, name: 'Round-Up', ruleType: 'round_up' },
        { id: 'rule-2', userId: mockUserId, name: 'Fixed $100', ruleType: 'fixed' },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rules));

      const result = await service.getRules(mockUserId);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no rules exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getRules(mockUserId);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // updateRule
  // ---------------------------------------------------------------------------
  describe('updateRule', () => {
    it('should update an existing rule', async () => {
      const existingRule = {
        id: 'rule-1',
        userId: mockUserId,
        name: 'Old Name',
        ruleType: 'fixed',
        amount: 50,
      };

      // Find existing
      mockDb.select.mockReturnValueOnce(mockQuery([existingRule]));
      // Update
      const updatedRule = { ...existingRule, name: 'New Name', amount: 100 };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedRule]));

      const result = await service.updateRule(mockUserId, 'rule-1', {
        name: 'New Name',
        amount: 100,
      });

      expect(result.name).toBe('New Name');
      expect(result.amount).toBe(100);
    });

    it('should throw NotFoundException for non-existent rule', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.updateRule(mockUserId, 'non-existent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow deactivating a rule', async () => {
      const existingRule = {
        id: 'rule-1',
        userId: mockUserId,
        isActive: 1,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([existingRule]));

      const updatedRule = { ...existingRule, isActive: 0 };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedRule]));

      const result = await service.updateRule(mockUserId, 'rule-1', {
        isActive: 0,
      });

      expect(result.isActive).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteRule
  // ---------------------------------------------------------------------------
  describe('deleteRule', () => {
    it('should delete a rule after ownership verification', async () => {
      const existingRule = { id: 'rule-1', userId: mockUserId };
      mockDb.select.mockReturnValueOnce(mockQuery([existingRule]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.deleteRule(mockUserId, 'rule-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent rule', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.deleteRule(mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateSurplusSavings
  // ---------------------------------------------------------------------------
  describe('calculateSurplusSavings', () => {
    it('should calculate savings from surplus when rule is active', async () => {
      // Month data
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ income: 5000, expenses: 3000 }]),
      );
      // Surplus rule
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          {
            id: 'rule-1',
            ruleType: 'surplus',
            amount: 50, // 50% of surplus
            isActive: 1,
          },
        ]),
      );

      const result = await service.calculateSurplusSavings(mockUserId);

      expect(result.currentMonthIncome).toBe(5000);
      expect(result.currentMonthExpenses).toBe(3000);
      expect(result.currentMonthSurplus).toBe(2000);
      // floor(2000 * 0.5 * 100) / 100 = 1000
      expect(result.savingsAmount).toBe(1000);
      expect(result.surplusPercentage).toBe(50);
    });

    it('should return zero savings when surplus is negative', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ income: 3000, expenses: 4000 }]),
      );
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          { id: 'rule-1', ruleType: 'surplus', amount: 50, isActive: 1 },
        ]),
      );

      const result = await service.calculateSurplusSavings(mockUserId);

      expect(result.currentMonthSurplus).toBe(-1000);
      expect(result.savingsAmount).toBe(0);
    });

    it('should return zero savings when no surplus rule exists', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ income: 5000, expenses: 3000 }]),
      );
      // No surplus rule
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.calculateSurplusSavings(mockUserId);

      expect(result.savingsAmount).toBe(0);
    });

    it('should handle null income and expenses', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ income: null, expenses: null }]),
      );
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.calculateSurplusSavings(mockUserId);

      expect(result.currentMonthIncome).toBe(0);
      expect(result.currentMonthExpenses).toBe(0);
      expect(result.currentMonthSurplus).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getProjectedSavings
  // ---------------------------------------------------------------------------
  describe('getProjectedSavings', () => {
    it('should project savings for fixed rules over N months', async () => {
      // Active rules
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          { id: 'rule-1', ruleType: 'fixed', amount: 200, isActive: 1 },
        ]),
      );
      // Transaction stats
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          { avgAmount: 50, txCount: 90, income: 15000, expenses: 12000 },
        ]),
      );

      const result = await service.getProjectedSavings(mockUserId, 6);

      expect(result.monthlyEstimate).toBe(200);
      expect(result.activeRuleCount).toBe(1);
      expect(result.projection).toHaveLength(6);
      expect(result.projection[0].savings).toBe(200);
      expect(result.projection[0].cumulative).toBe(200);
      expect(result.projection[5].cumulative).toBe(1200); // 200 * 6
    });

    it('should combine multiple rule types in projection', async () => {
      // Active rules: fixed + percentage
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          { id: 'rule-1', ruleType: 'fixed', amount: 100, isActive: 1 },
          { id: 'rule-2', ruleType: 'percentage', amount: 10, isActive: 1 },
        ]),
      );
      // Transaction stats: avg monthly income = 5000
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          { avgAmount: 50, txCount: 60, income: 15000, expenses: 12000 },
        ]),
      );

      const result = await service.getProjectedSavings(mockUserId, 3);

      // fixed: 100, percentage: 5000 * 10% = 500
      // total: 600
      expect(result.monthlyEstimate).toBe(600);
      expect(result.projection).toHaveLength(3);
    });

    it('should handle no active rules', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.select.mockReturnValueOnce(
        mockQuery([
          { avgAmount: 0, txCount: 0, income: 0, expenses: 0 },
        ]),
      );

      const result = await service.getProjectedSavings(mockUserId, 12);

      expect(result.monthlyEstimate).toBe(0);
      expect(result.activeRuleCount).toBe(0);
      expect(result.projection).toHaveLength(12);
      expect(result.projection[11].cumulative).toBe(0);
    });

    it('should default to 12 months when not specified', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ avgAmount: 0, txCount: 0, income: 0, expenses: 0 }]),
      );

      const result = await service.getProjectedSavings(mockUserId);

      expect(result.projection).toHaveLength(12);
    });
  });

  // ---------------------------------------------------------------------------
  // getSavingsHistory
  // ---------------------------------------------------------------------------
  describe('getSavingsHistory', () => {
    it('should return transfer history with total saved', async () => {
      const transfers = [
        { id: 't-1', ruleId: 'r-1', ruleName: 'Round-Up', ruleType: 'round_up', amount: 50, calculatedFrom: null, status: 'completed', createdAt: '2026-02-01' },
        { id: 't-2', ruleId: 'r-1', ruleName: 'Round-Up', ruleType: 'round_up', amount: 30, calculatedFrom: null, status: 'completed', createdAt: '2026-02-05' },
        { id: 't-3', ruleId: 'r-2', ruleName: 'Fixed', ruleType: 'fixed', amount: 100, calculatedFrom: null, status: 'skipped', createdAt: '2026-02-10' },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(transfers));

      const result = await service.getSavingsHistory(mockUserId, 6);

      expect(result.transfers).toHaveLength(3);
      // Only completed transfers count toward totalSaved
      expect(result.totalSaved).toBe(80); // 50 + 30
    });

    it('should handle no transfers', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getSavingsHistory(mockUserId);

      expect(result.transfers).toEqual([]);
      expect(result.totalSaved).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getDashboard
  // ---------------------------------------------------------------------------
  describe('getDashboard', () => {
    it('should return aggregated dashboard data', async () => {
      // getLatestAnalysis
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: 'a-1', averageMonthlyIncome: 5000 }]),
      );
      // getRules
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ id: 'r-1', ruleType: 'fixed' }]),
      );
      // getProjectedSavings: active rules + tx stats
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ avgAmount: 0, txCount: 0, income: 0, expenses: 0 }]),
      );
      // getSavingsHistory
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getDashboard(mockUserId);

      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('rules');
      expect(result).toHaveProperty('projected');
      expect(result).toHaveProperty('history');
    });
  });
});
