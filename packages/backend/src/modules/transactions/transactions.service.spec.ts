import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

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
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('TransactionsService', () => {
  let service: TransactionsService;
  let mockDb: any;
  let mockCategorizationService: any;

  const mockUserId = 'user-123';
  const mockTransactionId = 'txn-123';

  const mockTransaction = {
    id: mockTransactionId,
    accountId: 'account-1',
    categoryId: 'cat-1',
    plaidTransactionId: null,
    amount: 42.5,
    name: 'Coffee Shop',
    merchantName: 'Starbucks',
    description: 'Morning coffee',
    date: '2026-02-10',
    authorizedDate: '2026-02-10',
    pending: false,
    notes: null,
    categorizationSource: 'manual',
    isManual: true,
    createdAt: '2026-02-10T08:00:00.000Z',
    updatedAt: '2026-02-10T08:00:00.000Z',
    accountName: 'Checking',
    accountType: 'checking',
    categoryName: 'Food & Drink',
    categoryColor: '#FF5733',
    categoryIcon: 'coffee',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockCategorizationService = {
      categorize: vi.fn(),
    };

    const mockCacheService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      delPattern: vi.fn().mockResolvedValue(0),
      wrap: vi
        .fn()
        .mockImplementation((_key: string, _ttl: number, factory: () => Promise<any>) => factory()),
    };

    service = new TransactionsService(mockDb, mockCacheService as any);
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return paginated transactions with default pagination', async () => {
      const totalQuery = mockQuery([{ total: 2 }]);
      const dataQuery = mockQuery([mockTransaction]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, {});

      expect(result.meta).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
      });
      expect(result.data).toEqual([mockTransaction]);
    });

    it('should respect custom page and limit', async () => {
      const totalQuery = mockQuery([{ total: 100 }]);
      const dataQuery = mockQuery([]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, { page: 3, limit: 10 });

      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 100,
        totalPages: 10,
      });
    });

    it('should clamp limit to a maximum of 100', async () => {
      const totalQuery = mockQuery([{ total: 0 }]);
      const dataQuery = mockQuery([]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, { limit: 500 });

      expect(result.meta.limit).toBe(100);
    });

    it('should apply date filters when provided', async () => {
      const totalQuery = mockQuery([{ total: 1 }]);
      const dataQuery = mockQuery([mockTransaction]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, {
        startDate: '2026-01-01',
        endDate: '2026-02-28',
      });

      expect(result.data).toHaveLength(1);
    });

    it('should calculate totalPages correctly when total is not evenly divisible', async () => {
      const totalQuery = mockQuery([{ total: 11 }]);
      const dataQuery = mockQuery([]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, { limit: 5 });

      expect(result.meta.totalPages).toBe(3); // ceil(11/5)
    });

    it('should handle search filter using LIKE query path', async () => {
      const totalQuery = mockQuery([{ total: 1 }]);
      const dataQuery = mockQuery([mockTransaction]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, {
        search: 'coffee',
      });

      expect(result.data).toHaveLength(1);
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should handle empty results', async () => {
      const totalQuery = mockQuery([{ total: 0 }]);
      const dataQuery = mockQuery([]);

      mockDb.select.mockReturnValueOnce(totalQuery).mockReturnValueOnce(dataQuery);

      const result = await service.findAll(mockUserId, {});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  describe('findById', () => {
    it('should return a transaction when found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      const result = await service.findById(mockUserId, mockTransactionId);

      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.findById(mockUserId, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // createManual
  // ---------------------------------------------------------------------------
  describe('createManual', () => {
    it('should create a manual transaction with a given category', async () => {
      const createData = {
        accountId: 'account-1',
        amount: 25.0,
        name: 'Lunch',
        categoryId: 'cat-1',
        date: '2026-02-10',
      };

      const insertedTx = {
        id: 'txn-new',
        userId: mockUserId,
        ...createData,
        isManual: true,
        pending: false,
        categorizationSource: 'manual',
      };

      mockDb.insert.mockReturnValueOnce(mockQuery([insertedTx]));

      const result = await service.createManual(mockUserId, createData);

      expect(result).toEqual(insertedTx);
      expect(mockDb.insert).toHaveBeenCalled();
      // Should NOT call auto-categorization because categoryId was provided
      expect(mockCategorizationService.categorize).not.toHaveBeenCalled();
    });

    it('should return transaction without category when auto-categorization fails', async () => {
      const createData = {
        accountId: 'account-1',
        amount: 9.99,
        name: 'Unknown Store',
        date: '2026-02-10',
      };

      const insertedTx = {
        id: 'txn-new',
        userId: mockUserId,
        ...createData,
        categoryId: null,
        isManual: true,
        pending: false,
        categorizationSource: null,
      };

      mockDb.insert.mockReturnValueOnce(mockQuery([insertedTx]));
      mockCategorizationService.categorize.mockResolvedValue({
        categoryId: null,
        source: null,
      });

      const result = await service.createManual(mockUserId, createData);

      expect(result).toEqual(insertedTx);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should default pending to false when not specified', async () => {
      const createData = {
        accountId: 'account-1',
        amount: 5.0,
        name: 'Vending Machine',
        categoryId: 'cat-1',
        date: '2026-02-10',
      };

      const insertedTx = {
        id: 'txn-new',
        userId: mockUserId,
        ...createData,
        pending: false,
        isManual: true,
        categorizationSource: 'manual',
      };

      const chain = mockQuery([insertedTx]);
      mockDb.insert.mockReturnValueOnce(chain);

      await service.createManual(mockUserId, createData);

      expect(chain.values).toHaveBeenCalledWith(expect.objectContaining({ pending: false }));
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update transaction fields', async () => {
      // findById call
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      const updatedTx = { ...mockTransaction, notes: 'Updated note' };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedTx]));

      const result = await service.update(mockUserId, mockTransactionId, {
        notes: 'Updated note',
      });

      expect(result.notes).toBe('Updated note');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should track category correction when changing category', async () => {
      // findById call
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      // Insert correction
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      // Update transaction
      const updatedTx = { ...mockTransaction, categoryId: 'cat-2' };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedTx]));

      const result = await service.update(mockUserId, mockTransactionId, {
        categoryId: 'cat-2',
      });

      expect(result.categoryId).toBe('cat-2');
      // Should have inserted a categorization correction
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent transaction', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.update(mockUserId, 'non-existent', { notes: 'test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when update returns nothing', async () => {
      // findById succeeds
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // update returns empty (race condition)
      mockDb.update.mockReturnValueOnce(mockQuery([undefined]));

      await expect(
        service.update(mockUserId, mockTransactionId, { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete a manual transaction', async () => {
      const manualTx = { ...mockTransaction, isManual: true };
      mockDb.select.mockReturnValueOnce(mockQuery([manualTx]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.remove(mockUserId, mockTransactionId);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when deleting non-manual transaction', async () => {
      const linkedTx = { ...mockTransaction, isManual: false };
      mockDb.select.mockReturnValueOnce(mockQuery([linkedTx]));

      await expect(service.remove(mockUserId, mockTransactionId)).rejects.toThrow(
        'Can only delete manual transactions',
      );
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.remove(mockUserId, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle zero-amount transaction', async () => {
      const zeroTx = { ...mockTransaction, amount: 0 };
      mockDb.select.mockReturnValueOnce(mockQuery([zeroTx]));

      const result = await service.findById(mockUserId, mockTransactionId);
      expect(result.amount).toBe(0);
    });

    it('should handle negative-amount transaction (income/refund)', async () => {
      const negativeTx = { ...mockTransaction, amount: -150.0 };
      mockDb.select.mockReturnValueOnce(mockQuery([negativeTx]));

      const result = await service.findById(mockUserId, mockTransactionId);
      expect(result.amount).toBe(-150.0);
    });
  });
});
