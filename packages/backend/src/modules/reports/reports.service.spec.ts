import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsService } from './reports.service';

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

describe('ReportsService', () => {
  let service: ReportsService;
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

    service = new ReportsService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // getSpendingReport
  // ---------------------------------------------------------------------------
  describe('getSpendingReport', () => {
    it('should return spending grouped by category', async () => {
      const rows = [
        { group: 'Groceries', total: 500, count: 20, color: '#FF0000' },
        { group: 'Transport', total: 200, count: 10, color: '#00FF00' },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'category',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        group: 'Groceries',
        total: 500,
        count: 20,
        color: '#FF0000',
      });
    });

    it('should return spending grouped by merchant', async () => {
      const rows = [
        { group: 'Amazon', total: 300, count: 5 },
        { group: 'Walmart', total: 200, count: 8 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'merchant',
      });

      expect(result).toHaveLength(2);
      expect(result[0].group).toBe('Amazon');
    });

    it('should return spending grouped by account', async () => {
      const rows = [
        { group: 'Checking', total: 1000, count: 30 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'account',
      });

      expect(result).toHaveLength(1);
      expect(result[0].group).toBe('Checking');
    });

    it('should return spending grouped by day', async () => {
      const rows = [
        { group: '2026-01-15', total: 150, count: 3 },
        { group: '2026-01-16', total: 200, count: 5 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-15',
        endDate: '2026-01-16',
        groupBy: 'day',
      });

      expect(result).toHaveLength(2);
    });

    it('should return spending grouped by week', async () => {
      const rows = [
        { group: '2026-W03', total: 500, count: 10 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'week',
      });

      expect(result).toHaveLength(1);
    });

    it('should return spending grouped by month', async () => {
      const rows = [
        { group: '2026-01', total: 3000, count: 50 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'month',
      });

      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(3000);
    });

    it('should return empty array when no spending data', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getSpendingReport(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'category',
      });

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getIncomeVsExpense
  // ---------------------------------------------------------------------------
  describe('getIncomeVsExpense', () => {
    it('should return income vs expense with net calculation', async () => {
      const rows = [
        { period: '2026-01', income: 5000, expenses: 3000 },
        { period: '2026-02', income: 5500, expenses: 3200 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getIncomeVsExpense(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-02-28',
        groupBy: 'month',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        period: '2026-01',
        income: 5000,
        expenses: 3000,
        net: 2000, // income - expenses
      });
      expect(result[1].net).toBe(2300);
    });

    it('should handle negative net (expenses exceed income)', async () => {
      const rows = [
        { period: '2026-01', income: 2000, expenses: 3500 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getIncomeVsExpense(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'month',
      });

      expect(result[0].net).toBe(-1500);
    });

    it('should support weekly grouping', async () => {
      const rows = [
        { period: '2026-W05', income: 1200, expenses: 800 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getIncomeVsExpense(mockUserId, {
        startDate: '2026-01-26',
        endDate: '2026-02-01',
        groupBy: 'week',
      });

      expect(result[0].period).toBe('2026-W05');
    });

    it('should return empty array when no data', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getIncomeVsExpense(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        groupBy: 'month',
      });

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getNetWorthReport
  // ---------------------------------------------------------------------------
  describe('getNetWorthReport', () => {
    it('should calculate net worth from asset and liability accounts', async () => {
      const accountRows = [
        { id: 'a-1', name: 'Checking', type: 'checking', institutionName: 'Bank', balance: 5000 },
        { id: 'a-2', name: 'Savings', type: 'savings', institutionName: 'Bank', balance: 10000 },
        { id: 'a-3', name: 'Credit Card', type: 'credit_card', institutionName: 'Chase', balance: -2000 },
        { id: 'a-4', name: 'Mortgage', type: 'mortgage', institutionName: 'Wells Fargo', balance: -200000 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accountRows));

      const result = await service.getNetWorthReport(mockUserId);

      expect(result.totalAssets).toBe(15000); // checking + savings
      expect(result.totalLiabilities).toBe(202000); // abs(credit_card) + abs(mortgage)
      expect(result.netWorth).toBe(-187000);
      expect(result.accounts).toHaveLength(4);
    });

    it('should handle null balances as zero', async () => {
      const accountRows = [
        { id: 'a-1', name: 'Checking', type: 'checking', institutionName: null, balance: null },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accountRows));

      const result = await service.getNetWorthReport(mockUserId);

      expect(result.accounts[0].balance).toBe(0);
      expect(result.totalAssets).toBe(0);
    });

    it('should return zero net worth when no accounts', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getNetWorthReport(mockUserId);

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(0);
      expect(result.netWorth).toBe(0);
      expect(result.accounts).toEqual([]);
    });

    it('should classify investment accounts as assets', async () => {
      const accountRows = [
        { id: 'a-1', name: '401(k)', type: 'investment', institutionName: 'Vanguard', balance: 50000 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accountRows));

      const result = await service.getNetWorthReport(mockUserId);

      expect(result.totalAssets).toBe(50000);
      expect(result.totalLiabilities).toBe(0);
    });

    it('should classify loan accounts as liabilities', async () => {
      const accountRows = [
        { id: 'a-1', name: 'Auto Loan', type: 'loan', institutionName: 'CU', balance: -15000 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accountRows));

      const result = await service.getNetWorthReport(mockUserId);

      expect(result.totalAssets).toBe(0);
      expect(result.totalLiabilities).toBe(15000);
    });
  });

  // ---------------------------------------------------------------------------
  // getTrendReport
  // ---------------------------------------------------------------------------
  describe('getTrendReport', () => {
    it('should return monthly spending trend', async () => {
      const rows = [
        { month: '2025-09', total: 2500 },
        { month: '2025-10', total: 3000 },
        { month: '2025-11', total: 2800 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.getTrendReport(mockUserId, { months: 3 });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ month: '2025-09', total: 2500 });
    });

    it('should return empty array when no data', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getTrendReport(mockUserId, { months: 6 });

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // generateCSV
  // ---------------------------------------------------------------------------
  describe('generateCSV', () => {
    it('should generate transactions CSV with header and data rows', async () => {
      const rows = [
        {
          date: '2026-01-15',
          merchant: 'Starbucks',
          category: 'Food & Drink',
          amount: 5.5,
          account: 'Checking',
        },
        {
          date: '2026-01-16',
          merchant: 'Amazon',
          category: 'Shopping',
          amount: 42.99,
          account: 'Credit Card',
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.generateCSV(mockUserId, 'transactions', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      const lines = result.split('\n');
      expect(lines[0]).toBe('Date,Merchant,Category,Amount,Account');
      expect(lines).toHaveLength(3); // header + 2 data rows
      expect(lines[1]).toContain('Starbucks');
      expect(lines[2]).toContain('Amazon');
    });

    it('should escape double quotes in CSV values', async () => {
      const rows = [
        {
          date: '2026-01-15',
          merchant: 'Bob\'s "Best" Burgers',
          category: 'Food',
          amount: 15,
          account: 'Checking',
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(rows));

      const result = await service.generateCSV(mockUserId, 'transactions', {});

      expect(result).toContain('Bob\'s ""Best"" Burgers');
    });

    it('should generate transactions CSV without date filters', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.generateCSV(mockUserId, 'transactions', {});

      expect(result).toBe('Date,Merchant,Category,Amount,Account');
    });

    it('should generate budgets CSV', async () => {
      const budgets = [
        { categoryName: 'Groceries', amount: 500, period: 'monthly' },
      ];

      // Budgets query
      mockDb.select.mockReturnValueOnce(mockQuery(budgets));
      // Spent query for each budget
      mockDb.select.mockReturnValueOnce(mockQuery([{ spent: 350 }]));

      const result = await service.generateCSV(mockUserId, 'budgets', {});

      const lines = result.split('\n');
      expect(lines[0]).toBe('Category,Budgeted,Spent,Remaining,Period');
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain('Groceries');
      expect(lines[1]).toContain('500');
      expect(lines[1]).toContain('350');
      expect(lines[1]).toContain('150'); // 500 - 350
    });

    it('should generate net worth CSV', async () => {
      const accountRows = [
        { id: 'a-1', name: 'Checking', type: 'checking', institutionName: 'Bank', balance: 5000 },
      ];

      // getNetWorthReport -> accounts query
      mockDb.select.mockReturnValueOnce(mockQuery(accountRows));

      const result = await service.generateCSV(mockUserId, 'networth', {});

      const lines = result.split('\n');
      expect(lines[0]).toBe('Account,Type,Balance,Date');
      expect(lines[1]).toContain('Checking');
      expect(lines[1]).toContain('5000');
    });

    it('should handle empty budgets CSV', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.generateCSV(mockUserId, 'budgets', {});

      expect(result).toBe('Category,Budgeted,Spent,Remaining,Period');
    });
  });
});
