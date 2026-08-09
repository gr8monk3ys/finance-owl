import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdaptiveBudgetService } from './adaptive-budget.service';

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns the chain itself, and awaiting resolves to `data`.
 * (Mirrors the convention used in budgets.service.spec.ts, extended with
 * `groupBy` since AdaptiveBudgetService's history query uses it.)
 */
function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'groupBy',
    'orderBy',
    'limit',
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

describe('AdaptiveBudgetService', () => {
  let service: AdaptiveBudgetService;
  let mockDb: any;

  const mockUserId = 'user-123';

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      update: vi.fn(),
    };
    service = new AdaptiveBudgetService(mockDb);
  });

  describe('suggestBudgets', () => {
    it('returns an empty array when there is no spending history', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.suggestBudgets(mockUserId);

      expect(result).toEqual([]);
    });

    it('classifies confidence tiers correctly and sorts by average spending descending', async () => {
      // cat-1 "Rent": 3 consistent months -> high confidence (CV < 0.2, >=3 months)
      // cat-2 "Entertainment": 2 months, low variation -> medium confidence
      // cat-3 "Misc": 1 month only -> low confidence
      const rows = [
        { categoryId: 'cat-1', categoryName: 'Rent', month: '2026-01', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Rent', month: '2026-02', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Rent', month: '2026-03', total: 100 },
        { categoryId: 'cat-2', categoryName: 'Entertainment', month: '2026-01', total: 100 },
        { categoryId: 'cat-2', categoryName: 'Entertainment', month: '2026-02', total: 120 },
        { categoryId: 'cat-3', categoryName: 'Misc', month: '2026-01', total: 100 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.suggestBudgets(mockUserId);

      expect(result).toHaveLength(3);
      // Sorted descending by averageSpending: Entertainment (110) first,
      // then Rent and Misc tie at 100 (stable sort keeps original order).
      expect(result.map((r) => r.categoryName)).toEqual([
        'Entertainment',
        'Rent',
        'Misc',
      ]);

      const rent = result.find((r) => r.categoryName === 'Rent')!;
      expect(rent.confidence).toBe('high');
      expect(rent.averageSpending).toBe(100);
      expect(rent.medianSpending).toBe(100);
      expect(rent.suggestedAmount).toBe(115); // ceil(median*1.1)=111 -> nearest 5

      const entertainment = result.find((r) => r.categoryName === 'Entertainment')!;
      expect(entertainment.confidence).toBe('medium');
      expect(entertainment.averageSpending).toBe(110);
      expect(entertainment.suggestedAmount).toBe(130); // ceil(avg*1.15)=127 -> nearest 5

      const misc = result.find((r) => r.categoryName === 'Misc')!;
      expect(misc.confidence).toBe('low');
      expect(misc.suggestedAmount).toBe(120); // ceil(max(avg,median)*1.2)
    });
  });

  describe('detectSeasonalPatterns', () => {
    it('ignores categories with fewer than 6 months of history', async () => {
      const rows = [
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2026-01', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2026-02', total: 500 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.detectSeasonalPatterns(mockUserId);

      expect(result).toEqual([]);
    });

    it('detects a holiday spike in November/December spending', async () => {
      const rows = [
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2025-01', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2025-02', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2025-03', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2025-04', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2025-11', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Gifts', month: '2025-12', total: 200 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.detectSeasonalPatterns(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        categoryName: 'Gifts',
        pattern: 'holiday_spike',
        affectedMonths: [12],
      });
      expect(result[0].recommendation).toContain('Gifts');
      expect(result[0].averageIncrease).toBeGreaterThan(25);
    });

    it('classifies a Jun-Aug spike as a summer pattern', async () => {
      const rows = [
        { categoryId: 'cat-2', categoryName: 'Travel', month: '2025-01', total: 100 },
        { categoryId: 'cat-2', categoryName: 'Travel', month: '2025-02', total: 100 },
        { categoryId: 'cat-2', categoryName: 'Travel', month: '2025-03', total: 100 },
        { categoryId: 'cat-2', categoryName: 'Travel', month: '2025-04', total: 100 },
        { categoryId: 'cat-2', categoryName: 'Travel', month: '2025-06', total: 200 },
        { categoryId: 'cat-2', categoryName: 'Travel', month: '2025-07', total: 200 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.detectSeasonalPatterns(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe('summer_increase');
      expect(result[0].affectedMonths.sort()).toEqual([6, 7]);
    });
  });

  describe('autoAdjustBudgets', () => {
    it('returns an empty array when the user has no budgets', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.autoAdjustBudgets(mockUserId, 'moderate');

      expect(result).toEqual([]);
    });

    it('increases a budget that is consistently over spent', async () => {
      const budgets = [
        {
          id: 'budget-1',
          categoryId: 'cat-1',
          amount: 500,
          period: 'monthly',
          categoryName: 'Dining',
        },
      ];
      const historyRows = [
        { categoryId: 'cat-1', categoryName: 'Dining', month: '2026-01', total: 600 },
        { categoryId: 'cat-1', categoryName: 'Dining', month: '2026-02', total: 600 },
        { categoryId: 'cat-1', categoryName: 'Dining', month: '2026-03', total: 600 },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(budgets))
        .mockReturnValueOnce(mockQuery(historyRows));
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.autoAdjustBudgets(mockUserId, 'moderate');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        budgetId: 'budget-1',
        categoryName: 'Dining',
        previousAmount: 500,
      });
      // avg=600, overage=100, adjustment=min(100*1.10, 500*0.10*3)=min(110,150)=110
      // newAmount = ceil(610/5)*5 = 610
      expect(result[0].newAmount).toBe(610);
      expect(result[0].reason).toContain('exceeding budget');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('decreases a budget that is consistently under spent', async () => {
      const budgets = [
        {
          id: 'budget-2',
          categoryId: 'cat-2',
          amount: 1000,
          period: 'monthly',
          categoryName: 'Shopping',
        },
      ];
      const historyRows = [
        { categoryId: 'cat-2', categoryName: 'Shopping', month: '2026-01', total: 200 },
        { categoryId: 'cat-2', categoryName: 'Shopping', month: '2026-02', total: 200 },
        { categoryId: 'cat-2', categoryName: 'Shopping', month: '2026-03', total: 200 },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(budgets))
        .mockReturnValueOnce(mockQuery(historyRows));
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.autoAdjustBudgets(mockUserId, 'moderate');

      expect(result).toHaveLength(1);
      // surplus=800, adjustment=800*0.07*3=168, newAmount=ceil(832/5)*5=835
      expect(result[0].newAmount).toBe(835);
      expect(result[0].changePercent).toBeLessThan(0);
      expect(result[0].reason).toContain('below');
    });

    it('preemptively increases a budget with an upward trend nearing its limit', async () => {
      const budgets = [
        {
          id: 'budget-3',
          categoryId: 'cat-3',
          amount: 1000,
          period: 'monthly',
          categoryName: 'Groceries',
        },
      ];
      const historyRows = [
        { categoryId: 'cat-3', categoryName: 'Groceries', month: '2026-01', total: 700 },
        { categoryId: 'cat-3', categoryName: 'Groceries', month: '2026-02', total: 850 },
        { categoryId: 'cat-3', categoryName: 'Groceries', month: '2026-03', total: 1000 },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(budgets))
        .mockReturnValueOnce(mockQuery(historyRows));
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.autoAdjustBudgets(mockUserId, 'moderate');

      expect(result).toHaveLength(1);
      expect(result[0].reason).toContain('Preemptive');
      // adjustment = budget.amount * up(0.10) = 100 -> newAmount = 1100
      expect(result[0].newAmount).toBe(1100);
    });

    it('skips a budget whose spending does not warrant any adjustment', async () => {
      const budgets = [
        {
          id: 'budget-4',
          categoryId: 'cat-4',
          amount: 500,
          period: 'monthly',
          categoryName: 'Utilities',
        },
      ];
      // Flat spending, well within normal range: no increase, no decrease, no trend.
      const historyRows = [
        { categoryId: 'cat-4', categoryName: 'Utilities', month: '2026-01', total: 480 },
        { categoryId: 'cat-4', categoryName: 'Utilities', month: '2026-02', total: 480 },
        { categoryId: 'cat-4', categoryName: 'Utilities', month: '2026-03', total: 480 },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(budgets))
        .mockReturnValueOnce(mockQuery(historyRows));

      const result = await service.autoAdjustBudgets(mockUserId, 'moderate');

      expect(result).toEqual([]);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('predictNextMonth', () => {
    it('skips categories with fewer than 2 months of history', async () => {
      const rows = [
        { categoryId: 'cat-1', categoryName: 'Rent', month: '2026-01', total: 100 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.predictNextMonth(mockUserId);

      expect(result).toEqual([]);
    });

    it('uses a weighted average when fewer than 3 months are available', async () => {
      const rows = [
        { categoryId: 'cat-1', categoryName: 'Rent', month: '2026-01', total: 100 },
        { categoryId: 'cat-1', categoryName: 'Rent', month: '2026-02', total: 200 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.predictNextMonth(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].trend).toBe('increasing');
      // weightedAvg = (100*1 + 200*2) / 3 = 166.666... -> 166.67
      expect(result[0].predictedAmount).toBeCloseTo(166.67, 2);
      expect(result[0].monthOverMonthChange).toBeCloseTo(-16.7, 1);
    });

    it('uses linear extrapolation with 3+ months and clamps negative predictions to zero', async () => {
      // Note: rows with a total of exactly 0 are filtered out upstream by
      // getCategorySpendingHistory, so we use a small non-zero value here to
      // keep all 3 months and still land on a negative raw extrapolation.
      const rows = [
        { categoryId: 'cat-1', categoryName: 'Travel', month: '2026-01', total: 300 },
        { categoryId: 'cat-1', categoryName: 'Travel', month: '2026-02', total: 150 },
        { categoryId: 'cat-1', categoryName: 'Travel', month: '2026-03', total: 50 },
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.predictNextMonth(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].trend).toBe('decreasing');
      // Raw linear extrapolation is ~ -83.3; must be clamped to 0.
      expect(result[0].predictedAmount).toBe(0);
    });
  });

  describe('getBudgetInsights', () => {
    it('returns no insights when the user has no budgets or history', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([])) // budgets
        .mockReturnValueOnce(mockQuery([])) // category history (3mo)
        .mockReturnValueOnce(mockQuery([])); // category history (12mo, via detectSeasonalPatterns)

      const result = await service.getBudgetInsights(mockUserId);

      expect(result).toEqual([]);
    });

    it('flags a budget that has been exceeded this period', async () => {
      const budgets = [
        {
          id: 'budget-1',
          categoryId: 'cat-1',
          amount: 500,
          period: 'monthly',
          categoryName: 'Dining',
        },
      ];

      mockDb.select
        .mockReturnValueOnce(mockQuery(budgets)) // budgets
        .mockReturnValueOnce(mockQuery([])) // category history (3mo)
        .mockReturnValueOnce(mockQuery([])) // child categories (getSpentForCategory)
        .mockReturnValueOnce(mockQuery([{ total: 700 }])) // spent sum
        .mockReturnValueOnce(mockQuery([])); // category history (12mo)

      const result = await service.getBudgetInsights(mockUserId);

      const overBudget = result.find((i) => i.type === 'over_budget');
      expect(overBudget).toBeDefined();
      expect(overBudget).toMatchObject({
        categoryName: 'Dining',
        amount: 200,
        severity: 'warning',
      });
    });
  });
});
