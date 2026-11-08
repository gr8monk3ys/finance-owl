import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BudgetsService, type BudgetWithSpent } from './budgets.service';

/**
 * Covers the parts of BudgetsService that budgets.service.spec.ts does not:
 * previous-period date math, progressive alerts (threshold dedupe + severity),
 * end-of-period forecasts and household budget aggregation.
 *
 * The period helpers format local-midnight Dates with toISOString(), so their
 * exact date strings only hold in UTC (which is what CI runs in). East of UTC
 * every boundary shifts back a day; those assertions are skipped there rather
 * than encoding the shift.
 */
const isUtc = new Date().getTimezoneOffset() === 0;

/** Chainable stand-in for Drizzle's query builder; awaiting it yields `data`. */
function mockQuery(data: any) {
  const chain: any = {};
  for (const m of ['select', 'from', 'where', 'leftJoin', 'orderBy', 'limit', 'values']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

function budget(overrides: Partial<BudgetWithSpent>): BudgetWithSpent {
  return {
    id: 'budget-1',
    name: 'Groceries',
    budgetType: 'category',
    categoryId: 'cat-1',
    categoryName: 'Groceries',
    categoryColor: null,
    categoryIcon: null,
    householdId: null,
    amount: 500,
    period: 'monthly',
    rollover: false,
    rolloverCap: null,
    isActive: true,
    alertThresholds: [50, 75, 90, 100, 110],
    spent: 0,
    remaining: 500,
    percentUsed: 0,
    rolloverAmount: 0,
    effectiveBudget: 500,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysRemaining: 15,
    projectedSpend: 0,
    onTrack: true,
    ...overrides,
  };
}

describe('BudgetsService (periods, alerts, forecasts, households)', () => {
  let service: BudgetsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { select: vi.fn(), insert: vi.fn() };
    service = new BudgetsService(mockDb, { delPattern: vi.fn() } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── getPreviousPeriodDates ──────────────────────────────────────

  describe('getPreviousPeriodDates', () => {
    it('returns the whole previous calendar year for annual budgets', () => {
      expect(service.getPreviousPeriodDates('annual', new Date(2026, 0, 1, 12))).toEqual({
        start: '2025-01-01',
        end: '2025-12-31',
      });
    });

    describe.skipIf(!isUtc)('date boundaries (UTC)', () => {
      it('weekly: returns the Monday–Sunday week before the current one', () => {
        // Wednesday 4 Nov 2026 -> current week starts Mon 2 Nov
        expect(service.getPreviousPeriodDates('weekly', new Date(2026, 10, 4, 12))).toEqual({
          start: '2026-10-26',
          end: '2026-11-01',
        });
      });

      it('weekly: treats Sunday as the last day of the week, not the first', () => {
        // Sunday 8 Nov 2026 still belongs to the week of Mon 2 Nov
        expect(service.getPreviousPeriodDates('weekly', new Date(2026, 10, 8, 12))).toEqual({
          start: '2026-10-26',
          end: '2026-11-01',
        });
      });

      it('biweekly: steps back one 14-day block from the 2024-01-01 epoch', () => {
        // 20 Jan 2024 is in block #1 (15–28 Jan); the previous block is #0
        expect(service.getPreviousPeriodDates('biweekly', new Date(2024, 0, 20, 12))).toEqual({
          start: '2024-01-01',
          end: '2024-01-14',
        });
      });

      it('monthly: crosses the year boundary in January', () => {
        expect(service.getPreviousPeriodDates('monthly', new Date(2026, 0, 15, 12))).toEqual({
          start: '2025-12-01',
          end: '2025-12-31',
        });
      });

      it('monthly: ends February on the 29th in a leap year', () => {
        expect(service.getPreviousPeriodDates('monthly', new Date(2024, 2, 10, 12))).toEqual({
          start: '2024-02-01',
          end: '2024-02-29',
        });
      });

      it('quarterly: Q1 rolls back to Q4 of the previous year', () => {
        expect(service.getPreviousPeriodDates('quarterly', new Date(2026, 1, 10, 12))).toEqual({
          start: '2025-10-01',
          end: '2025-12-31',
        });
      });

      it('quarterly: Q3 rolls back to Q2 of the same year', () => {
        expect(service.getPreviousPeriodDates('quarterly', new Date(2026, 7, 1, 12))).toEqual({
          start: '2026-04-01',
          end: '2026-06-30',
        });
      });

      it('falls back to monthly for an unknown period', () => {
        const now = new Date(2026, 4, 20, 12);
        expect(service.getPreviousPeriodDates('fortnightly', now)).toEqual(
          service.getPreviousPeriodDates('monthly', now),
        );
        expect(service.getPreviousPeriodDates('fortnightly', now)).toEqual({
          start: '2026-04-01',
          end: '2026-04-30',
        });
      });
    });
  });

  // ── getActiveAlerts ─────────────────────────────────────────────

  describe('getActiveAlerts', () => {
    it('records and returns only crossed thresholds not already alerted this period', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue([
        budget({
          id: 'b-1',
          name: null,
          categoryName: null,
          alertThresholds: [50, 75, 90, 100],
          percentUsed: 92,
          spent: 460,
          effectiveBudget: 500,
        }),
      ]);
      // 50% already sent; 75% and 90% not yet. 100% is never queried (not crossed).
      mockDb.select
        .mockReturnValueOnce(mockQuery([{ id: 'existing-alert' }]))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([]));
      const insertChain = mockQuery(undefined);
      mockDb.insert.mockReturnValue(insertChain);

      const alerts = await service.getActiveAlerts('user-1');

      expect(mockDb.select).toHaveBeenCalledTimes(3);
      expect(alerts).toEqual([
        {
          budgetId: 'b-1',
          budgetName: 'Overall Spending',
          thresholdPercent: 75,
          actualPercent: 92,
          spent: 460,
          budgetAmount: 500,
          severity: 'warning',
        },
        {
          budgetId: 'b-1',
          budgetName: 'Overall Spending',
          thresholdPercent: 90,
          actualPercent: 92,
          spent: 460,
          budgetAmount: 500,
          severity: 'danger',
        },
      ]);
      expect(insertChain.values).toHaveBeenCalledTimes(2);
      expect(insertChain.values).toHaveBeenCalledWith({
        budgetId: 'b-1',
        userId: 'user-1',
        thresholdPercent: 75,
        actualPercent: 92,
        periodStart: '2026-11-01',
      });
    });

    it('maps thresholds to info / critical severity and prefers the category name', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue([
        budget({
          id: 'b-2',
          name: null,
          categoryName: 'Dining',
          alertThresholds: [50, 110],
          percentUsed: 120,
        }),
      ]);
      mockDb.select.mockReturnValue(mockQuery([]));
      mockDb.insert.mockReturnValue(mockQuery(undefined));

      const alerts = await service.getActiveAlerts('user-1');

      expect(alerts.map((a) => [a.thresholdPercent, a.severity, a.budgetName])).toEqual([
        [50, 'info', 'Dining'],
        [110, 'critical', 'Dining'],
      ]);
    });

    it('returns nothing and touches no tables when no threshold is crossed', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue([budget({ percentUsed: 49.99 })]);

      await expect(service.getActiveAlerts('user-1')).resolves.toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  // ── forecastEndOfPeriod ─────────────────────────────────────────

  describe('forecastEndOfPeriod', () => {
    it('classifies each budget and computes a daily allowance for the rest of the period', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue([
        budget({
          id: 'on-track',
          name: 'Groceries',
          spent: 200,
          remaining: 300,
          percentUsed: 40,
          projectedSpend: 400,
          effectiveBudget: 500,
          daysRemaining: 7,
        }),
        budget({
          id: 'at-risk',
          name: null,
          categoryName: 'Dining',
          spent: 300,
          remaining: 200,
          percentUsed: 60,
          projectedSpend: 600.444,
          effectiveBudget: 500,
          daysRemaining: 15,
        }),
        budget({
          id: 'over',
          name: null,
          categoryName: null,
          spent: 550,
          remaining: -50,
          percentUsed: 110,
          projectedSpend: 1100,
          effectiveBudget: 500,
          daysRemaining: 10,
        }),
      ]);

      const forecast = await service.forecastEndOfPeriod('user-1');

      expect(forecast).toEqual([
        {
          budgetId: 'on-track',
          budgetName: 'Groceries',
          currentSpent: 200,
          budgetAmount: 500,
          projectedSpend: 400,
          projectedSurplus: 100,
          daysRemaining: 7,
          dailyAllowance: 42.86, // 300 / 7
          status: 'on_track',
        },
        {
          budgetId: 'at-risk',
          budgetName: 'Dining',
          currentSpent: 300,
          budgetAmount: 500,
          projectedSpend: 600.444,
          projectedSurplus: -100.44,
          daysRemaining: 15,
          dailyAllowance: 13.33, // 200 / 15
          status: 'at_risk',
        },
        {
          budgetId: 'over',
          budgetName: 'Overall',
          currentSpent: 550,
          budgetAmount: 500,
          projectedSpend: 1100,
          projectedSurplus: -600,
          daysRemaining: 10,
          dailyAllowance: 0, // negative remaining clamps to zero
          status: 'over_budget',
        },
      ]);
    });

    it('reports a zero allowance on the last day instead of dividing by zero', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue([
        budget({ remaining: 120, daysRemaining: 0, percentUsed: 76, projectedSpend: 380 }),
      ]);

      const [only] = await service.forecastEndOfPeriod('user-1');

      expect(only.dailyAllowance).toBe(0);
      expect(only.status).toBe('on_track');
    });
  });

  // ── findHouseholdBudgets ────────────────────────────────────────

  describe('findHouseholdBudgets', () => {
    it('returns [] without querying budgets when the household has no members', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.findHouseholdBudgets('hh-1')).resolves.toEqual([]);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    describe.skipIf(!isUtc)('aggregation (UTC)', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
      });

      it("sums every member's spending, adds rollover, and projects the period", async () => {
        mockDb.select
          // household members
          .mockReturnValueOnce(mockQuery([{ userId: 'alice' }, { userId: 'bob' }]))
          // household budgets
          .mockReturnValueOnce(
            mockQuery([
              {
                id: 'overall-1',
                name: 'Household',
                budgetType: 'overall',
                categoryId: null,
                householdId: 'hh-1',
                amount: '600', // numeric columns arrive as strings
                period: 'monthly',
                rollover: true,
                rolloverCap: '100',
                isActive: true,
                alertThresholds: null,
                startDate: null,
                userId: 'alice',
                categoryName: null,
                categoryColor: null,
                categoryIcon: null,
              },
              {
                id: 'cat-budget',
                name: null,
                budgetType: 'category',
                categoryId: 'cat-food',
                householdId: 'hh-1',
                amount: 100,
                period: 'yearly',
                rollover: false,
                rolloverCap: null,
                isActive: true,
                alertThresholds: 'not-json',
                startDate: null,
                userId: 'bob',
                categoryName: 'Food',
                categoryColor: '#f00',
                categoryIcon: 'fork',
              },
            ]),
          )
          // overall-1: alice total, bob total, rollover
          .mockReturnValueOnce(mockQuery([{ total: '150' }]))
          .mockReturnValueOnce(mockQuery([{ total: 90 }]))
          .mockReturnValueOnce(mockQuery([{ rolloverAmount: '60' }]))
          // cat-budget: alice child categories + total, bob child categories + total
          .mockReturnValueOnce(mockQuery([]))
          .mockReturnValueOnce(mockQuery([{ total: '70' }]))
          .mockReturnValueOnce(mockQuery([{ id: 'cat-food-child' }]))
          .mockReturnValueOnce(mockQuery([{ total: null }]));

        const [overall, food] = await service.findHouseholdBudgets('hh-1');

        expect(overall).toMatchObject({
          id: 'overall-1',
          name: 'Household',
          amount: 600,
          rolloverCap: 100,
          spent: 240, // 150 + 90
          rolloverAmount: 60,
          effectiveBudget: 660,
          remaining: 420,
          percentUsed: 36.36,
          periodStart: '2026-11-01',
          periodEnd: '2026-11-30',
          daysRemaining: 15,
          projectedSpend: 480, // 240 / 15 days elapsed * 30 days
          onTrack: true,
          alertThresholds: [50, 75, 90, 100, 110],
        });

        expect(food).toMatchObject({
          id: 'cat-budget',
          name: 'Food', // falls back to the category name
          period: 'annual', // legacy 'yearly' is normalised
          rolloverAmount: 0,
          spent: 70, // bob's null total counts as 0
          effectiveBudget: 100,
          remaining: 30,
          percentUsed: 70,
          periodStart: '2026-01-01',
          periodEnd: '2026-12-31',
          alertThresholds: [50, 75, 90, 100, 110], // unparseable JSON -> defaults
        });
        // 70 spent in 319 of 365 days projects to 80.09, inside the 100 limit
        expect(food.projectedSpend).toBe(80.09);
        expect(food.onTrack).toBe(true);
        expect(mockDb.select).toHaveBeenCalledTimes(9);
      });
    });
  });
});
