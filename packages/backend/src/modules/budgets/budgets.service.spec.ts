import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BudgetsService } from './budgets.service';

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Every method returns the chain itself, and awaiting resolves to `data`.
 */
function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
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

describe('BudgetsService', () => {
  let service: BudgetsService;
  let mockDb: any;

  const mockUserId = 'user-123';
  const mockBudgetId = 'budget-123';
  const mockCategoryId = 'category-123';

  beforeEach(() => {
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
    };

    service = new BudgetsService(mockDb, mockCacheService as any);
  });

  describe('findAll', () => {
    it('should return budgets with spent calculations', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          categoryId: 'cat-1',
          amount: 1000,
          period: 'monthly',
          rollover: false,
          rolloverCap: null,
          categoryName: 'Groceries',
          categoryColor: '#FF0000',
          categoryIcon: 'cart',
        },
        {
          id: 'budget-2',
          categoryId: 'cat-2',
          amount: 500,
          period: 'monthly',
          rollover: true,
          rolloverCap: 200,
          categoryName: 'Entertainment',
          categoryColor: '#00FF00',
          categoryIcon: 'movie',
        },
      ];

      // Call sequence for findAll with 2 budgets (budget 2 has rollover=true):
      // 1. Main budgets query (with leftJoin)
      // 2. Child categories for budget 1
      // 3. Spent amount for budget 1
      // 4. Child categories for budget 2
      // 5. Spent amount for budget 2
      // 6. Rollover amount for budget 2 (rollover=true)
      mockDb.select
        .mockReturnValueOnce(mockQuery(mockBudgets))
        .mockReturnValueOnce(mockQuery([]))           // child categories budget-1
        .mockReturnValueOnce(mockQuery([{ total: 750 }])) // spent budget-1
        .mockReturnValueOnce(mockQuery([]))           // child categories budget-2
        .mockReturnValueOnce(mockQuery([{ total: 750 }])) // spent budget-2
        .mockReturnValueOnce(mockQuery([{ rolloverAmount: 0 }])); // rollover budget-2

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'budget-1',
        categoryId: 'cat-1',
        amount: 1000,
        spent: 750,
        remaining: 250,
        percentUsed: 75,
        rolloverAmount: 0,
      });
      expect(result[1]).toMatchObject({
        id: 'budget-2',
        categoryId: 'cat-2',
        amount: 500,
        spent: 750,
        remaining: -250,
        rolloverAmount: 0,
      });
    });

    it('should include rollover amounts for budgets with rollover enabled', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          categoryId: 'cat-1',
          amount: 1000,
          period: 'monthly',
          rollover: true,
          rolloverCap: null,
          categoryName: 'Savings',
          categoryColor: '#0000FF',
          categoryIcon: 'piggy',
        },
      ];

      // 1. Main budgets query
      // 2. Child categories
      // 3. Spent amount
      // 4. Rollover amount (rollover=true)
      mockDb.select
        .mockReturnValueOnce(mockQuery(mockBudgets))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 600 }]))
        .mockReturnValueOnce(mockQuery([{ rolloverAmount: 200 }]));

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].rolloverAmount).toBe(200);
      expect(result[0].remaining).toBe(600); // (1000 + 200) - 600
    });
  });

  describe('findById', () => {
    it('should return a budget by id', async () => {
      const mockBudget = {
        id: mockBudgetId,
        userId: mockUserId,
        categoryId: mockCategoryId,
        amount: 1000,
        period: 'monthly',
        rollover: false,
        rolloverCap: null,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([mockBudget]));

      const result = await service.findById(mockUserId, mockBudgetId);

      expect(result).toEqual(mockBudget);
    });

    it('should throw NotFoundException when budget not found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.findById(mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should insert budget correctly', async () => {
      const createData = {
        categoryId: mockCategoryId,
        amount: 1500,
        period: 'monthly',
        rollover: true,
        rolloverCap: 300,
      };

      const mockCreatedBudget = {
        id: 'new-budget-123',
        userId: mockUserId,
        ...createData,
        createdAt: '2026-02-15T00:00:00.000Z',
        updatedAt: '2026-02-15T00:00:00.000Z',
      };

      // Duplicate check query (no existing budget found)
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery([mockCreatedBudget]));

      const result = await service.create(mockUserId, createData);

      expect(result).toEqual(mockCreatedBudget);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create budget with default rollover false when not provided', async () => {
      const createData = {
        categoryId: mockCategoryId,
        amount: 800,
        period: 'quarterly',
      };

      const mockCreatedBudget = {
        id: 'new-budget-456',
        userId: mockUserId,
        categoryId: mockCategoryId,
        amount: 800,
        period: 'quarterly',
        rollover: false,
        rolloverCap: null,
      };

      // Duplicate check query (no existing budget found)
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery([mockCreatedBudget]));

      const result = await service.create(mockUserId, createData);

      expect(result.rollover).toBe(false);
    });
  });

  describe('update', () => {
    it('should modify budget', async () => {
      const mockExistingBudget = {
        id: mockBudgetId,
        userId: mockUserId,
        categoryId: mockCategoryId,
        amount: 1000,
        period: 'monthly',
      };

      const updateData = {
        amount: 1200,
        rollover: true,
        rolloverCap: 250,
      };

      const mockUpdatedBudget = {
        ...mockExistingBudget,
        ...updateData,
        updatedAt: '2026-02-15T00:00:00.000Z',
      };

      // findById select, then update
      mockDb.select.mockReturnValueOnce(mockQuery([mockExistingBudget]));
      mockDb.update.mockReturnValueOnce(mockQuery([mockUpdatedBudget]));

      const result = await service.update(mockUserId, mockBudgetId, updateData);

      expect(result).toEqual(mockUpdatedBudget);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent budget', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.update(mockUserId, 'non-existent', { amount: 500 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete budget', async () => {
      const mockExistingBudget = {
        id: mockBudgetId,
        userId: mockUserId,
        categoryId: mockCategoryId,
        amount: 1000,
      };

      // findById select, then delete
      mockDb.select.mockReturnValueOnce(mockQuery([mockExistingBudget]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.remove(mockUserId, mockBudgetId);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when deleting non-existent budget', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.remove(mockUserId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSummary', () => {
    it('should return totals', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          categoryId: 'cat-1',
          amount: 1000,
          period: 'monthly',
          rollover: false,
          rolloverCap: null,
          categoryName: 'Groceries',
          categoryColor: '#FF0000',
          categoryIcon: 'cart',
        },
        {
          id: 'budget-2',
          categoryId: 'cat-2',
          amount: 500,
          period: 'monthly',
          rollover: false,
          rolloverCap: null,
          categoryName: 'Entertainment',
          categoryColor: '#00FF00',
          categoryIcon: 'movie',
        },
      ];

      // getSummary calls findAll internally
      // 1. Main budgets query
      // 2. Child categories for budget 1
      // 3. Spent for budget 1
      // 4. Child categories for budget 2
      // 5. Spent for budget 2
      mockDb.select
        .mockReturnValueOnce(mockQuery(mockBudgets))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 400 }]))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 400 }]));

      const result = await service.getSummary(mockUserId);

      expect(result).toMatchObject({
        totalBudgeted: 1500,
        totalSpent: 800,
        totalRemaining: 700,
        percentUsed: expect.closeTo(53.33, 1),
        budgetCount: 2,
        overBudgetCount: 0,
      });
      // The new service also returns projection fields
      expect(result).toHaveProperty('onTrackCount');
      expect(result).toHaveProperty('projectedTotalSpend');
      expect(result).toHaveProperty('projectedSurplusOrDeficit');
    });

    it('should count over-budget budgets correctly', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          categoryId: 'cat-1',
          amount: 500,
          period: 'monthly',
          rollover: false,
          rolloverCap: null,
          categoryName: 'Groceries',
          categoryColor: '#FF0000',
          categoryIcon: 'cart',
        },
      ];

      // 1. Main budgets query
      // 2. Child categories
      // 3. Spent (over budget)
      mockDb.select
        .mockReturnValueOnce(mockQuery(mockBudgets))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 750 }]));

      const result = await service.getSummary(mockUserId);

      expect(result.overBudgetCount).toBe(1);
    });
  });

  describe('processRollovers', () => {
    it('should handle rollover without cap', async () => {
      const mockBudget = {
        id: 'budget-1',
        userId: mockUserId,
        categoryId: 'cat-1',
        amount: 1000,
        period: 'monthly',
        rollover: true,
        rolloverCap: null,
      };

      // 1. Budgets with rollover=true
      // 2. Child categories for getSpentForCategory
      // 3. Spent amount
      // 4. Existing period check (none found)
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockBudget]))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 600 }]))
        .mockReturnValueOnce(mockQuery([]));

      const insertChain = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(insertChain);

      await service.processRollovers(mockUserId);

      expect(mockDb.insert).toHaveBeenCalled();
      // Surplus = 1000 - 600 = 400 (no cap)
      expect(insertChain.values.mock.calls[0][0]).toMatchObject({
        rolloverAmount: 400,
      });
    });

    it('should apply rollover cap when set', async () => {
      const mockBudget = {
        id: 'budget-1',
        userId: mockUserId,
        categoryId: 'cat-1',
        amount: 1000,
        period: 'monthly',
        rollover: true,
        rolloverCap: 200,
      };

      // 1. Budgets with rollover=true
      // 2. Child categories
      // 3. Spent amount (surplus = 1000-400 = 600, capped at 200)
      // 4. Existing period check (none found)
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockBudget]))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 400 }]))
        .mockReturnValueOnce(mockQuery([]));

      const insertChain = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(insertChain);

      await service.processRollovers(mockUserId);

      expect(insertChain.values.mock.calls[0][0].rolloverAmount).toBe(200);
    });

    it('should update existing period record if found', async () => {
      const mockBudget = {
        id: 'budget-1',
        userId: mockUserId,
        categoryId: 'cat-1',
        amount: 1000,
        period: 'monthly',
        rollover: true,
        rolloverCap: null,
      };

      // 1. Budgets with rollover=true
      // 2. Child categories
      // 3. Spent amount
      // 4. Existing period check (found!)
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockBudget]))
        .mockReturnValueOnce(mockQuery([]))
        .mockReturnValueOnce(mockQuery([{ total: 700 }]))
        .mockReturnValueOnce(mockQuery([{ id: 'period-123' }]));

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      await service.processRollovers(mockUserId);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
