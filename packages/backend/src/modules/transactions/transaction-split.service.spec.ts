import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TransactionSplitService } from './transaction-split.service';

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

describe('TransactionSplitService', () => {
  let service: TransactionSplitService;
  let mockDb: any;

  const mockUserId = 'user-123';
  const mockOtherUserId = 'user-456';
  const mockTransactionId = 'txn-100';

  const mockTransaction = {
    id: mockTransactionId,
    amount: 100,
  };

  const mockSplitInputs = [
    { categoryId: 'cat-1', amount: 60, note: 'Groceries' },
    { categoryId: 'cat-2', amount: 40, note: 'Snacks' },
  ];

  const mockInsertedSplits = [
    {
      id: 'split-1',
      transactionId: mockTransactionId,
      categoryId: 'cat-1',
      amount: 60,
      note: 'Groceries',
      householdMemberId: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    },
    {
      id: 'split-2',
      transactionId: mockTransactionId,
      categoryId: 'cat-2',
      amount: 40,
      note: 'Snacks',
      householdMemberId: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  ];

  const mockSplitsWithCategories = [
    {
      id: 'split-1',
      transactionId: mockTransactionId,
      categoryId: 'cat-1',
      amount: 60,
      note: 'Groceries',
      householdMemberId: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      categoryName: 'Food & Drink',
      categoryColor: '#FF5733',
      categoryIcon: 'cart',
    },
    {
      id: 'split-2',
      transactionId: mockTransactionId,
      categoryId: 'cat-2',
      amount: 40,
      note: 'Snacks',
      householdMemberId: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      categoryName: 'Entertainment',
      categoryColor: '#00FF00',
      categoryIcon: 'candy',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new TransactionSplitService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // splitTransaction
  // ---------------------------------------------------------------------------
  describe('splitTransaction', () => {
    it('should create splits for a valid transaction', async () => {
      // 1. getTransaction lookup
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }]));
      // 2. delete existing splits
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert new splits
      mockDb.insert.mockReturnValueOnce(mockQuery(mockInsertedSplits));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery(mockSplitsWithCategories));

      const result = await service.splitTransaction(mockUserId, mockTransactionId, mockSplitInputs);

      expect(result).toEqual(mockSplitsWithCategories);
      expect(result).toHaveLength(2);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.splitTransaction(mockUserId, 'non-existent', mockSplitInputs),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when transaction belongs to another user', async () => {
      // DB returns empty because the userId filter does not match
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.splitTransaction(mockOtherUserId, mockTransactionId, mockSplitInputs),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when fewer than 2 splits are provided', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 100 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with message about minimum splits', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 100 },
        ]),
      ).rejects.toThrow('At least 2 splits are required');
    });

    it('should throw BadRequestException when splits do not sum to the transaction amount', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 60 },
          { categoryId: 'cat-2', amount: 30 }, // Total 90 != 100
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include expected and actual amounts in the mismatch error message', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 60 },
          { categoryId: 'cat-2', amount: 30 },
        ]),
      ).rejects.toThrow(/Expected 100\.00, got 90\.00/);
    });

    it('should throw BadRequestException when a split amount is zero', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 0 },
          { categoryId: 'cat-2', amount: 100 },
        ]),
      ).rejects.toThrow('Split amount cannot be zero');
    });

    it('should handle negative transaction amounts (income/refund)', async () => {
      const negativeTransaction = { id: mockTransactionId, amount: -100 };
      const negativeSplits = [
        { categoryId: 'cat-1', amount: -60 },
        { categoryId: 'cat-2', amount: -40 },
      ];

      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([negativeTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }]));
      // 2. delete existing splits
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert new splits
      mockDb.insert.mockReturnValueOnce(mockQuery(mockInsertedSplits));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery(mockSplitsWithCategories));

      const result = await service.splitTransaction(mockUserId, mockTransactionId, negativeSplits);

      expect(result).toHaveLength(2);
    });

    it('should accept splits within floating point tolerance (0.01)', async () => {
      const preciseTransaction = { id: mockTransactionId, amount: 100 };
      const slightlyOffSplits = [
        { categoryId: 'cat-1', amount: 50.005 },
        { categoryId: 'cat-2', amount: 49.999 },
      ];
      // Total = 100.004, original = 100. Diff = 0.004 < 0.01 tolerance.

      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([preciseTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }]));
      // 2. delete existing splits
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert new splits
      mockDb.insert.mockReturnValueOnce(mockQuery([]));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      // Should NOT throw
      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, slightlyOffSplits),
      ).resolves.toBeDefined();
    });

    it('should reject splits that exceed floating point tolerance', async () => {
      const preciseTransaction = { id: mockTransactionId, amount: 100 };
      const offSplits = [
        { categoryId: 'cat-1', amount: 33 },
        { categoryId: 'cat-2', amount: 33 },
        { categoryId: 'cat-3', amount: 33 },
      ];
      // Total = 99, original = 100. Diff = 1.00, exceeds 0.01 tolerance.

      mockDb.select.mockReturnValueOnce(mockQuery([preciseTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, offSplits),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle splits without optional fields', async () => {
      const minimalSplits = [{ amount: 60 }, { amount: 40 }];

      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // 2. delete existing splits
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert new splits
      mockDb.insert.mockReturnValueOnce(mockQuery(mockInsertedSplits));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery(mockSplitsWithCategories));

      const result = await service.splitTransaction(mockUserId, mockTransactionId, minimalSplits);

      expect(result).toBeDefined();
    });

    it('should delete existing splits before inserting new ones', async () => {
      const callOrder: string[] = [];

      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }]));

      const deleteChain = mockQuery(undefined);
      mockDb.delete.mockImplementationOnce((...args: any[]) => {
        callOrder.push('delete');
        return deleteChain;
      });

      const insertChain = mockQuery(mockInsertedSplits);
      mockDb.insert.mockImplementationOnce((...args: any[]) => {
        callOrder.push('insert');
        return insertChain;
      });

      mockDb.select.mockReturnValueOnce(mockQuery(mockSplitsWithCategories));

      await service.splitTransaction(mockUserId, mockTransactionId, mockSplitInputs);

      expect(callOrder).toEqual(['delete', 'insert']);
    });
  });

  // ---------------------------------------------------------------------------
  // getSplits
  // ---------------------------------------------------------------------------
  describe('getSplits', () => {
    it('should return splits with category information', async () => {
      // 1. getTransaction (ownership check)
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // 2. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery(mockSplitsWithCategories));

      const result = await service.getSplits(mockUserId, mockTransactionId);

      expect(result).toEqual(mockSplitsWithCategories);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        categoryName: 'Food & Drink',
        categoryColor: '#FF5733',
        categoryIcon: 'cart',
      });
    });

    it('should enforce userId ownership check', async () => {
      // Another user tries to access - DB returns empty because userId filter doesn't match
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.getSplits(mockOtherUserId, mockTransactionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent transaction', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.getSplits(mockUserId, 'non-existent-txn')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array when transaction has no splits', async () => {
      // 1. getTransaction (exists)
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // 2. getSplitsWithCategories (no splits)
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getSplits(mockUserId, mockTransactionId);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // updateSplits
  // ---------------------------------------------------------------------------
  describe('updateSplits', () => {
    it('should replace all splits (delegates to splitTransaction)', async () => {
      const newSplits = [
        { categoryId: 'cat-3', amount: 70, note: 'Updated A' },
        { categoryId: 'cat-4', amount: 30, note: 'Updated B' },
      ];

      const updatedSplitsWithCategories = [
        {
          id: 'split-3',
          transactionId: mockTransactionId,
          categoryId: 'cat-3',
          amount: 70,
          note: 'Updated A',
          householdMemberId: null,
          createdAt: new Date(),
          categoryName: 'Transport',
          categoryColor: '#0000FF',
          categoryIcon: 'car',
        },
        {
          id: 'split-4',
          transactionId: mockTransactionId,
          categoryId: 'cat-4',
          amount: 30,
          note: 'Updated B',
          householdMemberId: null,
          createdAt: new Date(),
          categoryName: 'Misc',
          categoryColor: '#AAAAAA',
          categoryIcon: 'box',
        },
      ];

      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-3' }, { id: 'cat-4' }]));
      // 2. delete existing splits
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert new splits
      mockDb.insert.mockReturnValueOnce(mockQuery(updatedSplitsWithCategories));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery(updatedSplitsWithCategories));

      const result = await service.updateSplits(mockUserId, mockTransactionId, newSplits);

      expect(result).toEqual(updatedSplitsWithCategories);
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(70);
      expect(result[1].amount).toBe(30);
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.updateSplits(mockUserId, 'non-existent', mockSplitInputs),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate split amounts when updating', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.updateSplits(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 10 },
          { categoryId: 'cat-2', amount: 10 },
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // removeSplits
  // ---------------------------------------------------------------------------
  describe('removeSplits', () => {
    it('should delete all splits for a transaction', async () => {
      // 1. getTransaction (ownership check)
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // 2. delete splits
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.removeSplits(mockUserId, mockTransactionId);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should return void on successful removal', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.removeSplits(mockUserId, mockTransactionId);

      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.removeSplits(mockUserId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when another user tries to remove splits', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.removeSplits(mockOtherUserId, mockTransactionId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should succeed even when there are no existing splits to remove', async () => {
      // getTransaction succeeds
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // delete succeeds (no rows affected is fine)
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await expect(service.removeSplits(mockUserId, mockTransactionId)).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Validation edge cases
  // ---------------------------------------------------------------------------
  describe('validation edge cases', () => {
    it('should reject an empty splits array', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(service.splitTransaction(mockUserId, mockTransactionId, [])).rejects.toThrow(
        'At least 2 splits are required',
      );
    });

    it('should reject a single split even if amount matches', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 100 },
        ]),
      ).rejects.toThrow('At least 2 splits are required');
    });

    it('should accept exactly 2 splits that sum to the transaction amount', async () => {
      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }]));
      // 2. delete
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert
      mockDb.insert.mockReturnValueOnce(mockQuery(mockInsertedSplits));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery(mockSplitsWithCategories));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, [
          { categoryId: 'cat-1', amount: 60 },
          { categoryId: 'cat-2', amount: 40 },
        ]),
      ).resolves.toBeDefined();
    });

    it('should handle many splits that sum correctly', async () => {
      const manySplits = [
        { categoryId: 'cat-1', amount: 25 },
        { categoryId: 'cat-2', amount: 25 },
        { categoryId: 'cat-3', amount: 25 },
        { categoryId: 'cat-4', amount: 25 },
      ];

      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // FK ownership check: categories usable by this user
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }, { id: 'cat-3' }, { id: 'cat-4' }]));
      // 2. delete
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert
      mockDb.insert.mockReturnValueOnce(mockQuery([]));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, manySplits),
      ).resolves.toBeDefined();
    });

    it('should handle splits with householdMemberId', async () => {
      const splitsWithMembers = [
        { categoryId: 'cat-1', amount: 50, householdMemberId: 'member-1' },
        { categoryId: 'cat-2', amount: 50, householdMemberId: 'member-2' },
      ];

      // 1. getTransaction
      mockDb.select.mockReturnValueOnce(mockQuery([mockTransaction]));
      // FK ownership checks: categories, then household members (the
      // member check issues two select() calls: the membership subquery
      // builder and the outer query)
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'cat-1' }, { id: 'cat-2' }]));
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: 'member-1' }, { id: 'member-2' }]));
      // 2. delete
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // 3. insert
      mockDb.insert.mockReturnValueOnce(mockQuery([]));
      // 4. getSplitsWithCategories
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.splitTransaction(mockUserId, mockTransactionId, splitsWithMembers),
      ).resolves.toBeDefined();
    });
  });
});
