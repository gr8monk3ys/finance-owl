import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForecastingService } from './forecasting.service';
import type { DrizzleDB } from '../../database/database.module';

describe('ForecastingService', () => {
  let service: ForecastingService;
  let mockDb: DrizzleDB;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
    } as any;

    service = new ForecastingService(mockDb);
  });

  describe('getForecast', () => {
    it('should calculate monthly cash flow correctly', async () => {
      // Mock current balance
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 5000.0 }]),
      };

      // Mock recurring transactions
      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Salary',
            estimatedAmount: -3000.0, // Income (negative)
            frequency: 'monthly',
          },
          {
            name: 'Netflix',
            estimatedAmount: 15.99, // Expense (positive)
            frequency: 'monthly',
          },
          {
            name: 'Rent',
            estimatedAmount: 1200.0, // Expense
            frequency: 'monthly',
          },
        ]),
      };

      // Mock budgets (empty for this test)
      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      // Mock recurring category IDs check
      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain) // Get balance
        .mockReturnValueOnce(recurringChain) // Get recurring transactions
        .mockReturnValueOnce(budgetsChain) // Get budgets
        .mockReturnValueOnce(recurringCategoryChain); // Get recurring categories

      const result = await service.getForecast('user_1', { months: 3 });

      expect(result.currentBalance).toBe(5000.0);
      expect(result.months).toHaveLength(3);

      // Monthly income = 3000, expenses = 1215.99
      // Net cash flow = 3000 - 1215.99 = 1784.01 per month
      expect(result.months[0].projectedIncome).toBe(3000.0);
      expect(result.months[0].projectedExpenses).toBe(1215.99);
      expect(result.months[0].projectedBalance).toBe(6784.01); // 5000 + 1784.01

      expect(result.months[1].projectedBalance).toBe(8568.02); // 6784.01 + 1784.01
      expect(result.months[2].projectedBalance).toBe(10352.03); // 8568.02 + 1784.01
    });

    it('should apply frequency multipliers correctly', async () => {
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1000.0 }]),
      };

      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Weekly Coffee',
            estimatedAmount: 20.0, // $20/week
            frequency: 'weekly', // multiplier: 4.33
          },
          {
            name: 'Biweekly Gym',
            estimatedAmount: 30.0, // $30/biweekly
            frequency: 'biweekly', // multiplier: 2.17
          },
          {
            name: 'Quarterly Insurance',
            estimatedAmount: 300.0, // $300/quarter
            frequency: 'quarterly', // multiplier: 1/3
          },
          {
            name: 'Annual Subscription',
            estimatedAmount: 120.0, // $120/year
            frequency: 'annual', // multiplier: 1/12
          },
        ]),
      };

      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(recurringChain)
        .mockReturnValueOnce(budgetsChain)
        .mockReturnValueOnce(recurringCategoryChain);

      const result = await service.getForecast('user_1', { months: 1 });

      // Expected monthly expenses:
      // Weekly: 20 * 4.33 = 86.6
      // Biweekly: 30 * 2.17 = 65.1
      // Quarterly: 300 * (1/3) = 100
      // Annual: 120 * (1/12) = 10
      // Total: 86.6 + 65.1 + 100 + 10 = 261.7
      expect(result.months[0].projectedExpenses).toBeCloseTo(261.7, 1);
      expect(result.months[0].projectedBalance).toBeCloseTo(738.3, 1); // 1000 - 261.7
    });

    it('should project balance forward correctly', async () => {
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 10000.0 }]),
      };

      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Income',
            estimatedAmount: -2000.0,
            frequency: 'monthly',
          },
          {
            name: 'Expenses',
            estimatedAmount: 1500.0,
            frequency: 'monthly',
          },
        ]),
      };

      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(recurringChain)
        .mockReturnValueOnce(budgetsChain)
        .mockReturnValueOnce(recurringCategoryChain);

      const result = await service.getForecast('user_1', { months: 6 });

      expect(result.currentBalance).toBe(10000.0);
      expect(result.months).toHaveLength(6);

      // Net monthly: +2000 - 1500 = +500
      expect(result.months[0].projectedBalance).toBe(10500.0);
      expect(result.months[1].projectedBalance).toBe(11000.0);
      expect(result.months[2].projectedBalance).toBe(11500.0);
      expect(result.months[3].projectedBalance).toBe(12000.0);
      expect(result.months[4].projectedBalance).toBe(12500.0);
      expect(result.months[5].projectedBalance).toBe(13000.0);
    });

    it('should handle empty recurring transactions', async () => {
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 2500.0 }]),
      };

      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]), // No recurring transactions
      };

      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(recurringChain)
        .mockReturnValueOnce(budgetsChain)
        .mockReturnValueOnce(recurringCategoryChain);

      const result = await service.getForecast('user_1', { months: 3 });

      expect(result.currentBalance).toBe(2500.0);
      expect(result.months).toHaveLength(3);

      // With no recurring transactions, balance should stay the same
      expect(result.months[0].projectedIncome).toBe(0);
      expect(result.months[0].projectedExpenses).toBe(0);
      expect(result.months[0].projectedBalance).toBe(2500.0);
      expect(result.months[1].projectedBalance).toBe(2500.0);
      expect(result.months[2].projectedBalance).toBe(2500.0);
    });

    it('should include budget amounts for non-recurring categories', async () => {
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 5000.0 }]),
      };

      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Netflix',
            estimatedAmount: 15.0,
            frequency: 'monthly',
          },
        ]),
      };

      // Budget for a different category (not covered by recurring)
      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            amount: 200.0,
            period: 'monthly',
            categoryId: 'cat_food',
          },
          {
            amount: 600.0,
            period: 'quarterly',
            categoryId: 'cat_travel',
          },
        ]),
      };

      // Recurring transaction category IDs
      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(recurringChain)
        .mockReturnValueOnce(budgetsChain)
        .mockReturnValueOnce(recurringCategoryChain);

      const result = await service.getForecast('user_1', { months: 1 });

      // Expected expenses:
      // Recurring: 15
      // Budget monthly: 200
      // Budget quarterly: 600 * (1/3) = 200
      // Total: 15 + 200 + 200 = 415
      expect(result.months[0].projectedExpenses).toBe(415.0);
    });

    it('should handle zero current balance', async () => {
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      };

      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Expenses',
            estimatedAmount: 500.0,
            frequency: 'monthly',
          },
        ]),
      };

      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(recurringChain)
        .mockReturnValueOnce(budgetsChain)
        .mockReturnValueOnce(recurringCategoryChain);

      const result = await service.getForecast('user_1', { months: 2 });

      expect(result.currentBalance).toBe(0);
      // Balance goes negative with only expenses
      expect(result.months[0].projectedBalance).toBe(-500.0);
      expect(result.months[1].projectedBalance).toBe(-1000.0);
    });

    it('should format month labels correctly', async () => {
      const balanceChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1000.0 }]),
      };

      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const budgetsChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const recurringCategoryChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi
        .fn()
        .mockReturnValueOnce(balanceChain)
        .mockReturnValueOnce(recurringChain)
        .mockReturnValueOnce(budgetsChain)
        .mockReturnValueOnce(recurringCategoryChain);

      const result = await service.getForecast('user_1', { months: 3 });

      expect(result.months).toHaveLength(3);
      // Month labels should be in YYYY-MM format
      expect(result.months[0].month).toMatch(/^\d{4}-\d{2}$/);
      expect(result.months[1].month).toMatch(/^\d{4}-\d{2}$/);
      expect(result.months[2].month).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('getRecurringCashFlow', () => {
    it('should calculate monthly cash flow summary correctly', async () => {
      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Paycheck',
            estimatedAmount: -5000.0, // Income
            frequency: 'monthly',
          },
          {
            name: 'Rent',
            estimatedAmount: 2000.0, // Expense
            frequency: 'monthly',
          },
          {
            name: 'Groceries',
            estimatedAmount: 500.0, // Expense
            frequency: 'monthly',
          },
        ]),
      };

      mockDb.select = vi.fn().mockReturnValue(recurringChain);

      const result = await service.getRecurringCashFlow('user_1');

      expect(result.monthlyRecurringIncome).toBe(5000.0);
      expect(result.monthlyRecurringExpenses).toBe(2500.0);
      expect(result.netMonthlyCashFlow).toBe(2500.0); // 5000 - 2500

      expect(result.incomeItems).toHaveLength(1);
      expect(result.incomeItems[0]).toMatchObject({
        name: 'Paycheck',
        amount: 5000.0,
        frequency: 'monthly',
        monthlyAmount: 5000.0,
      });

      expect(result.expenseItems).toHaveLength(2);
      expect(result.expenseItems[0]).toMatchObject({
        name: 'Rent',
        amount: 2000.0,
        frequency: 'monthly',
        monthlyAmount: 2000.0,
      });
      expect(result.expenseItems[1]).toMatchObject({
        name: 'Groceries',
        amount: 500.0,
        frequency: 'monthly',
        monthlyAmount: 500.0,
      });
    });

    it('should apply frequency multipliers to cash flow items', async () => {
      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Weekly Freelance Income',
            estimatedAmount: -500.0, // Income
            frequency: 'weekly',
          },
          {
            name: 'Biweekly Gym',
            estimatedAmount: 40.0, // Expense
            frequency: 'biweekly',
          },
          {
            name: 'Annual Insurance',
            estimatedAmount: 1200.0, // Expense
            frequency: 'annual',
          },
        ]),
      };

      mockDb.select = vi.fn().mockReturnValue(recurringChain);

      const result = await service.getRecurringCashFlow('user_1');

      // Income: 500 * 4.33 = 2165
      expect(result.monthlyRecurringIncome).toBeCloseTo(2165.0, 0);

      // Expenses: (40 * 2.17) + (1200 * 1/12) = 86.8 + 100 = 186.8
      expect(result.monthlyRecurringExpenses).toBeCloseTo(186.8, 0);

      expect(result.netMonthlyCashFlow).toBeCloseTo(1978.2, 0); // 2165 - 186.8

      expect(result.incomeItems[0].frequency).toBe('weekly');
      expect(result.incomeItems[0].monthlyAmount).toBeCloseTo(2165.0, 0);

      expect(result.expenseItems[0].frequency).toBe('biweekly');
      expect(result.expenseItems[1].frequency).toBe('annual');
    });

    it('should handle empty recurring transactions', async () => {
      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select = vi.fn().mockReturnValue(recurringChain);

      const result = await service.getRecurringCashFlow('user_1');

      expect(result.monthlyRecurringIncome).toBe(0);
      expect(result.monthlyRecurringExpenses).toBe(0);
      expect(result.netMonthlyCashFlow).toBe(0);
      expect(result.incomeItems).toHaveLength(0);
      expect(result.expenseItems).toHaveLength(0);
    });

    it('should handle only income items', async () => {
      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Salary',
            estimatedAmount: -6000.0,
            frequency: 'monthly',
          },
          {
            name: 'Side Gig',
            estimatedAmount: -200.0,
            frequency: 'weekly',
          },
        ]),
      };

      mockDb.select = vi.fn().mockReturnValue(recurringChain);

      const result = await service.getRecurringCashFlow('user_1');

      // Income: 6000 + (200 * 4.33) = 6000 + 866 = 6866
      expect(result.monthlyRecurringIncome).toBeCloseTo(6866.0, 0);
      expect(result.monthlyRecurringExpenses).toBe(0);
      expect(result.netMonthlyCashFlow).toBeCloseTo(6866.0, 0);
      expect(result.incomeItems).toHaveLength(2);
      expect(result.expenseItems).toHaveLength(0);
    });

    it('should handle only expense items', async () => {
      const recurringChain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            name: 'Rent',
            estimatedAmount: 1500.0,
            frequency: 'monthly',
          },
          {
            name: 'Utilities',
            estimatedAmount: 150.0,
            frequency: 'monthly',
          },
        ]),
      };

      mockDb.select = vi.fn().mockReturnValue(recurringChain);

      const result = await service.getRecurringCashFlow('user_1');

      expect(result.monthlyRecurringIncome).toBe(0);
      expect(result.monthlyRecurringExpenses).toBe(1650.0);
      expect(result.netMonthlyCashFlow).toBe(-1650.0); // Negative cash flow
      expect(result.incomeItems).toHaveLength(0);
      expect(result.expenseItems).toHaveLength(2);
    });
  });
});
