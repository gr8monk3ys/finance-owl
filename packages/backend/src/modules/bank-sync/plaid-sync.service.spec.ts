import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PlaidSyncService } from './plaid-sync.service';

// ---------------------------------------------------------------------------
// Drizzle mock helper (matches project convention)
// ---------------------------------------------------------------------------

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
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

/**
 * Creates a mock transaction-scoped DB (dbTx) that mirrors the outer db
 * interface but tracks its own calls so we can assert on transaction behavior.
 */
function createMockDbTx() {
  const dbTx: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return dbTx;
}

// ---------------------------------------------------------------------------
// Factory: create service with all mocks injected
// ---------------------------------------------------------------------------

function createService() {
  const mockDbTx = createMockDbTx();

  const mockDb: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    // db.transaction calls the callback with a transaction-scoped db
    transaction: vi.fn(async (cb: (tx: any) => Promise<void>) => {
      await cb(mockDbTx);
    }),
  };

  const mockPlaidProvider = {
    name: 'plaid',
    syncTransactions: vi.fn(),
  };

  const mockCryptoService = {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
    decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  };

  const service = new PlaidSyncService(
    mockDb as any,
    mockPlaidProvider as any,
    mockCryptoService as any,
  );

  return {
    service,
    mockDb,
    mockDbTx,
    mockPlaidProvider,
    mockCryptoService,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'user-123';
const MOCK_ITEM_ID = 'item-db-uuid';
const MOCK_PLAID_ITEM_ID = 'plaid-item-abc';
const MOCK_ACCESS_TOKEN = 'access-sandbox-token';
const MOCK_ENCRYPTED_TOKEN = `encrypted:${MOCK_ACCESS_TOKEN}`;

const mockPlaidItem = {
  id: MOCK_ITEM_ID,
  userId: MOCK_USER_ID,
  plaidItemId: MOCK_PLAID_ITEM_ID,
  accessToken: MOCK_ENCRYPTED_TOKEN,
  institutionId: 'ins_1',
  institutionName: 'Test Bank',
  cursor: null,
  status: 'active',
  errorCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTransaction = {
  externalId: 'plaid-tx-1',
  accountExternalId: 'plaid-acct-1',
  amount: 42.5,
  name: 'STARBUCKS',
  merchantName: 'Starbucks',
  description: 'STARBUCKS STORE 12345',
  date: '2026-02-10',
  authorizedDate: '2026-02-09',
  pending: false,
  category: 'Food and Drink, Coffee Shop',
  personalFinanceCategory: 'FOOD_AND_DRINK',
};

const mockTransaction2 = {
  externalId: 'plaid-tx-2',
  accountExternalId: 'plaid-acct-1',
  amount: 15.0,
  name: 'AMAZON',
  merchantName: 'Amazon',
  description: 'AMZN MKTP US',
  date: '2026-02-11',
  authorizedDate: '2026-02-10',
  pending: false,
  category: 'Shopping',
  personalFinanceCategory: 'GENERAL_MERCHANDISE',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlaidSyncService', () => {
  let service: PlaidSyncService;
  let mockDb: any;
  let mockDbTx: any;
  let mockPlaidProvider: any;
  let mockCryptoService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const created = createService();
    service = created.service;
    mockDb = created.mockDb;
    mockDbTx = created.mockDbTx;
    mockPlaidProvider = created.mockPlaidProvider;
    mockCryptoService = created.mockCryptoService;
  });

  // =========================================================================
  // syncTransactionsForItem - basic flow
  // =========================================================================
  describe('syncTransactionsForItem', () => {
    it('should sync added transactions and update cursor', async () => {
      // Get the plaid item
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        // Get accounts for mapping
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'cursor-new',
        hasMore: false,
      });

      // Inside transaction: upsert check (not existing)
      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      // Insert new transaction
      mockDbTx.insert.mockReturnValueOnce(mockQuery(undefined));
      // Update cursor
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(1);
      expect(stats.modified).toBe(0);
      expect(stats.removed).toBe(0);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should sync modified transactions', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [{ ...mockTransaction, amount: 50 }],
        removed: [],
        cursor: 'cursor-mod',
        hasMore: false,
      });

      // Inside transaction: upsert check (existing)
      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }]),
      );
      // Update existing
      mockDbTx.update
        .mockReturnValueOnce(mockQuery(undefined)) // update tx
        .mockReturnValueOnce(mockQuery(undefined)); // update cursor

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(0);
      expect(stats.modified).toBe(1);
    });

    it('should handle removed transactions', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: ['plaid-tx-removed-1', 'plaid-tx-removed-2'],
        cursor: 'cursor-rm',
        hasMore: false,
      });

      // Inside transaction: delete 2 + update cursor
      mockDbTx.delete
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.removed).toBe(2);
      expect(mockDbTx.delete).toHaveBeenCalledTimes(2);
    });

    it('should sync added, modified, and removed in a single call', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [{ ...mockTransaction2, amount: 20 }],
        removed: ['plaid-tx-removed'],
        cursor: 'cursor-all',
        hasMore: false,
      });

      // Inside transaction:
      // upsert check for added (not existing)
      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      // insert added
      mockDbTx.insert.mockReturnValueOnce(mockQuery(undefined));
      // upsert check for modified (existing)
      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }]),
      );
      // update modified
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));
      // delete removed
      mockDbTx.delete.mockReturnValueOnce(mockQuery(undefined));
      // update cursor
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(1);
      expect(stats.modified).toBe(1);
      expect(stats.removed).toBe(1);
    });

    // -----------------------------------------------------------------------
    // Transaction wrapping
    // -----------------------------------------------------------------------
    it('should process all pages inside a single db transaction', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      // Page 1
      mockPlaidProvider.syncTransactions.mockResolvedValueOnce({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'cursor-page1',
        hasMore: true,
      });

      // Page 2
      mockPlaidProvider.syncTransactions.mockResolvedValueOnce({
        added: [mockTransaction2],
        modified: [],
        removed: [],
        cursor: 'cursor-page2',
        hasMore: false,
      });

      // Inside transaction:
      // upsert check for tx1 (not existing)
      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      mockDbTx.insert.mockReturnValueOnce(mockQuery(undefined));
      // upsert check for tx2 (not existing)
      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      mockDbTx.insert.mockReturnValueOnce(mockQuery(undefined));
      // update cursor
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(2);
      expect(mockPlaidProvider.syncTransactions).toHaveBeenCalledTimes(2);
      // Single transaction call wraps all pages
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass existing cursor to the first sync call', async () => {
      const itemWithCursor = { ...mockPlaidItem, cursor: 'existing-cursor' };
      mockDb.select
        .mockReturnValueOnce(mockQuery([itemWithCursor]))
        .mockReturnValueOnce(mockQuery([])); // no accounts

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        cursor: 'new-cursor',
        hasMore: false,
      });

      // update cursor inside transaction
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(mockPlaidProvider.syncTransactions).toHaveBeenCalledWith(
        MOCK_ACCESS_TOKEN,
        'existing-cursor',
      );
    });

    it('should pass null cursor on initial sync', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([{ ...mockPlaidItem, cursor: null }]))
        .mockReturnValueOnce(mockQuery([]));

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        cursor: 'first-cursor',
        hasMore: false,
      });

      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(mockPlaidProvider.syncTransactions).toHaveBeenCalledWith(MOCK_ACCESS_TOKEN, null);
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------
    it('should skip transactions with unknown account IDs', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([])); // empty account map

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'c',
        hasMore: false,
      });

      // update cursor inside transaction
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(0); // skipped
      expect(mockDbTx.insert).not.toHaveBeenCalled();
    });

    it('should handle empty transaction pages', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [],
        removed: [],
        cursor: 'empty-cursor',
        hasMore: false,
      });

      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(0);
      expect(stats.modified).toBe(0);
      expect(stats.removed).toBe(0);
      // Cursor should still be updated
      expect(mockDbTx.update).toHaveBeenCalledTimes(1);
    });

    it('should handle duplicate transactions via upsert', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'dup-cursor',
        hasMore: false,
      });

      // upsert check finds existing transaction (duplicate)
      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }]),
      );
      // update instead of insert
      mockDbTx.update
        .mockReturnValueOnce(mockQuery(undefined)) // update tx
        .mockReturnValueOnce(mockQuery(undefined)); // update cursor

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      // Still counts as "added" by the sync result
      expect(stats.added).toBe(1);
      // Should update, not insert
      expect(mockDbTx.update).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Category preservation
    // -----------------------------------------------------------------------
    it('should preserve user-set categorization on update', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [mockTransaction],
        removed: [],
        cursor: 'cat-cursor',
        hasMore: false,
      });

      // existing transaction with user-set category
      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'user' }]),
      );
      const updateTxChain = mockQuery(undefined);
      mockDbTx.update
        .mockReturnValueOnce(updateTxChain) // update tx
        .mockReturnValueOnce(mockQuery(undefined)); // update cursor

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      // categorizationSource should NOT be set because user categorized it
      const setArg = updateTxChain.set.mock.calls[0][0];
      expect(setArg.categorizationSource).toBeUndefined();
    });

    it('should preserve rule-set categorization on update', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [mockTransaction],
        removed: [],
        cursor: 'rule-cursor',
        hasMore: false,
      });

      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'rule' }]),
      );
      const updateTxChain = mockQuery(undefined);
      mockDbTx.update.mockReturnValueOnce(updateTxChain).mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      const setArg = updateTxChain.set.mock.calls[0][0];
      expect(setArg.categorizationSource).toBeUndefined();
    });

    it('should update categorization source when plaid-set', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [mockTransaction], // has personalFinanceCategory
        removed: [],
        cursor: 'plaid-cat-cursor',
        hasMore: false,
      });

      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }]),
      );
      const updateTxChain = mockQuery(undefined);
      mockDbTx.update.mockReturnValueOnce(updateTxChain).mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      const setArg = updateTxChain.set.mock.calls[0][0];
      expect(setArg.categorizationSource).toBe('plaid');
    });

    it('should not set categorizationSource when tx has no personalFinanceCategory', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      const txWithoutCategory = {
        ...mockTransaction,
        personalFinanceCategory: null,
      };

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [txWithoutCategory],
        removed: [],
        cursor: 'no-cat-cursor',
        hasMore: false,
      });

      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }]),
      );
      const updateTxChain = mockQuery(undefined);
      mockDbTx.update.mockReturnValueOnce(updateTxChain).mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      const setArg = updateTxChain.set.mock.calls[0][0];
      expect(setArg.categorizationSource).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // New transaction insert
    // -----------------------------------------------------------------------
    it('should insert new transaction with correct fields', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'ins-cursor',
        hasMore: false,
      });

      // upsert check: not existing
      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      const insertChain = mockQuery(undefined);
      mockDbTx.insert.mockReturnValueOnce(insertChain);
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: MOCK_USER_ID,
          accountId: 'acct-internal-1',
          plaidTransactionId: 'plaid-tx-1',
          amount: 42.5,
          name: 'STARBUCKS',
          merchantName: 'Starbucks',
          date: '2026-02-10',
          pending: false,
          isManual: false,
        }),
      );
    });

    it('should set categorizationSource to plaid when personalFinanceCategory exists on insert', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'cat-insert-cursor',
        hasMore: false,
      });

      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      const insertChain = mockQuery(undefined);
      mockDbTx.insert.mockReturnValueOnce(insertChain);
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          categorizationSource: 'plaid',
        }),
      );
    });

    it('should set categorizationSource to null when personalFinanceCategory is missing on insert', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      const txWithoutCategory = {
        ...mockTransaction,
        personalFinanceCategory: null,
      };

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [txWithoutCategory],
        modified: [],
        removed: [],
        cursor: 'no-cat-insert-cursor',
        hasMore: false,
      });

      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      const insertChain = mockQuery(undefined);
      mockDbTx.insert.mockReturnValueOnce(insertChain);
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          categorizationSource: null,
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------
    it('should throw NotFoundException when plaid item does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.syncTransactionsForItem('non-existent', MOCK_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item belongs to another user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.syncTransactionsForItem(MOCK_ITEM_ID, 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate Plaid API errors', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([]));

      mockPlaidProvider.syncTransactions.mockRejectedValue(new Error('Plaid API rate limit'));

      await expect(service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID)).rejects.toThrow(
        'Plaid API rate limit',
      );
    });

    it('should propagate database transaction errors', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'err-cursor',
        hasMore: false,
      });

      // Make the transaction callback throw
      mockDb.transaction.mockRejectedValue(new Error('Database write conflict'));

      await expect(service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID)).rejects.toThrow(
        'Database write conflict',
      );
    });

    // -----------------------------------------------------------------------
    // Pagination
    // -----------------------------------------------------------------------
    it('should paginate through all sync pages before processing', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(
          mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]),
        );

      // Page 1
      mockPlaidProvider.syncTransactions.mockResolvedValueOnce({
        added: [mockTransaction],
        modified: [],
        removed: [],
        cursor: 'cursor-1',
        hasMore: true,
      });

      // Page 2
      mockPlaidProvider.syncTransactions.mockResolvedValueOnce({
        added: [],
        modified: [{ ...mockTransaction, amount: 50 }],
        removed: [],
        cursor: 'cursor-2',
        hasMore: true,
      });

      // Page 3 (final)
      mockPlaidProvider.syncTransactions.mockResolvedValueOnce({
        added: [],
        modified: [],
        removed: ['plaid-tx-gone'],
        cursor: 'cursor-3',
        hasMore: false,
      });

      // Inside transaction:
      // page1: upsert check (not existing) + insert
      mockDbTx.select.mockReturnValueOnce(mockQuery([]));
      mockDbTx.insert.mockReturnValueOnce(mockQuery(undefined));
      // page2: upsert check (existing) + update
      mockDbTx.select.mockReturnValueOnce(
        mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }]),
      );
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));
      // page3: delete
      mockDbTx.delete.mockReturnValueOnce(mockQuery(undefined));
      // cursor update
      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.added).toBe(1);
      expect(stats.modified).toBe(1);
      expect(stats.removed).toBe(1);
      expect(mockPlaidProvider.syncTransactions).toHaveBeenCalledTimes(3);

      // Verify cursor progression
      expect(mockPlaidProvider.syncTransactions).toHaveBeenNthCalledWith(
        1,
        MOCK_ACCESS_TOKEN,
        null,
      );
      expect(mockPlaidProvider.syncTransactions).toHaveBeenNthCalledWith(
        2,
        MOCK_ACCESS_TOKEN,
        'cursor-1',
      );
      expect(mockPlaidProvider.syncTransactions).toHaveBeenNthCalledWith(
        3,
        MOCK_ACCESS_TOKEN,
        'cursor-2',
      );
    });

    it('should skip modified transactions with unknown account IDs', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([])); // no accounts

      mockPlaidProvider.syncTransactions.mockResolvedValue({
        added: [],
        modified: [mockTransaction],
        removed: [],
        cursor: 'skip-mod-cursor',
        hasMore: false,
      });

      mockDbTx.update.mockReturnValueOnce(mockQuery(undefined)); // cursor

      const stats = await service.syncTransactionsForItem(MOCK_ITEM_ID, MOCK_USER_ID);

      expect(stats.modified).toBe(0);
      expect(mockDbTx.select).not.toHaveBeenCalled(); // no upsert check
    });
  });
});
