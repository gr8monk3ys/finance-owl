import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { PlaidService } from './plaid.service';

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

// ---------------------------------------------------------------------------
// Plaid client mock
// ---------------------------------------------------------------------------

function createMockPlaidClient() {
  return {
    linkTokenCreate: vi.fn(),
    itemPublicTokenExchange: vi.fn(),
    accountsGet: vi.fn(),
    institutionsGetById: vi.fn(),
    transactionsSync: vi.fn(),
    itemRemove: vi.fn(),
    webhookVerificationKeyGet: vi.fn(),
    itemGet: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Factory: create service with all mocks injected
// ---------------------------------------------------------------------------

function createService() {
  const mockDb: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        PLAID_ENV: 'sandbox',
        PLAID_CLIENT_ID: 'test-client-id',
        PLAID_SECRET: 'test-secret',
        PLAID_WEBHOOK_URL: 'https://example.com/plaid/webhook',
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockCryptoService = {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
    decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  };

  const service = new PlaidService(
    mockDb as any,
    mockConfigService as any,
    mockCryptoService as any,
  );

  // Replace the private Plaid client with our mock
  const mockClient = createMockPlaidClient();
  (service as any).client = mockClient;

  return { service, mockDb, mockConfigService, mockCryptoService, mockClient };
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
  consentExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPlaidAccount = {
  account_id: 'plaid-acct-1',
  name: 'Checking',
  official_name: 'Premium Checking',
  type: 'depository',
  subtype: 'checking',
  mask: '1234',
  balances: {
    current: 5000,
    available: 4800,
    limit: null,
    iso_currency_code: 'USD',
  },
};

const mockPlaidTransaction = {
  transaction_id: 'plaid-tx-1',
  account_id: 'plaid-acct-1',
  amount: 42.5,
  name: 'STARBUCKS',
  merchant_name: 'Starbucks',
  original_description: 'STARBUCKS STORE 12345',
  date: '2026-02-10',
  authorized_date: '2026-02-09',
  pending: false,
  personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'COFFEE' },
  category: ['Food and Drink', 'Coffee Shop'],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlaidService', () => {
  let service: PlaidService;
  let mockDb: any;
  let mockClient: ReturnType<typeof createMockPlaidClient>;
  let mockCryptoService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const created = createService();
    service = created.service;
    mockDb = created.mockDb;
    mockClient = created.mockClient;
    mockCryptoService = created.mockCryptoService;
  });

  // =========================================================================
  // createLinkToken
  // =========================================================================
  describe('createLinkToken', () => {
    it('should create a link token for the given user', async () => {
      mockClient.linkTokenCreate.mockResolvedValue({
        data: {
          link_token: 'link-sandbox-token-123',
          expiration: '2026-02-15T12:00:00Z',
        },
      });

      const result = await service.createLinkToken(MOCK_USER_ID);

      expect(result).toEqual({
        linkToken: 'link-sandbox-token-123',
        expiration: '2026-02-15T12:00:00Z',
      });
      expect(mockClient.linkTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { client_user_id: MOCK_USER_ID },
          client_name: 'FinanceOwl',
        }),
      );
    });

    it('should include webhook URL in link token request', async () => {
      mockClient.linkTokenCreate.mockResolvedValue({
        data: { link_token: 'link-token', expiration: '2026-02-15T12:00:00Z' },
      });

      await service.createLinkToken(MOCK_USER_ID);

      expect(mockClient.linkTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          webhook: 'https://example.com/plaid/webhook',
        }),
      );
    });

    it('should throw InternalServerErrorException on Plaid API failure', async () => {
      const axiosError = new AxiosError('Request failed', '500', undefined, undefined, {
        data: {
          error_type: 'API_ERROR',
          error_code: 'INTERNAL_SERVER_ERROR',
          error_message: 'An unexpected error occurred',
        },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockClient.linkTokenCreate.mockRejectedValue(axiosError);

      await expect(service.createLinkToken(MOCK_USER_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // =========================================================================
  // exchangePublicToken
  // =========================================================================
  describe('exchangePublicToken', () => {
    it('should exchange public token, encrypt access token, and store item + accounts', async () => {
      mockClient.itemPublicTokenExchange.mockResolvedValue({
        data: {
          access_token: MOCK_ACCESS_TOKEN,
          item_id: MOCK_PLAID_ITEM_ID,
        },
      });

      mockClient.accountsGet.mockResolvedValue({
        data: {
          accounts: [mockPlaidAccount],
          item: { institution_id: 'ins_1' },
        },
      });

      mockClient.institutionsGetById.mockResolvedValue({
        data: { institution: { name: 'Test Bank' } },
      });

      // insert plaid item
      const plaidItemChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(plaidItemChain);

      // insert account
      const accountChain = mockQuery([{ id: 'acct-1', name: 'Premium Checking' }]);
      mockDb.insert.mockReturnValueOnce(accountChain);

      const result = await service.exchangePublicToken(MOCK_USER_ID, 'public-sandbox-token');

      expect(result.plaidItem).toEqual(mockPlaidItem);
      expect(result.accounts).toHaveLength(1);
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(MOCK_ACCESS_TOKEN);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should use metadata institution name if provided', async () => {
      mockClient.itemPublicTokenExchange.mockResolvedValue({
        data: { access_token: 'at', item_id: 'it' },
      });
      mockClient.accountsGet.mockResolvedValue({
        data: {
          accounts: [mockPlaidAccount],
          item: { institution_id: null },
        },
      });

      const insertChain = mockQuery([mockPlaidItem]);
      mockDb.insert
        .mockReturnValueOnce(insertChain) // plaid item
        .mockReturnValueOnce(mockQuery([{ id: 'acct-1' }])); // account

      await service.exchangePublicToken(MOCK_USER_ID, 'public-token', {
        institution: { institution_id: 'ins_meta', name: 'Metadata Bank' },
      });

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ institutionName: 'Metadata Bank' }),
      );
    });

    it('should handle institution lookup failure gracefully', async () => {
      mockClient.itemPublicTokenExchange.mockResolvedValue({
        data: { access_token: 'at', item_id: 'it' },
      });
      mockClient.accountsGet.mockResolvedValue({
        data: {
          accounts: [mockPlaidAccount],
          item: { institution_id: 'ins_fail' },
        },
      });
      mockClient.institutionsGetById.mockRejectedValue(new Error('Institution not found'));

      mockDb.insert
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([{ id: 'acct-1' }]));

      // Should not throw despite institution lookup failure
      const result = await service.exchangePublicToken(MOCK_USER_ID, 'public-token');

      expect(result.plaidItem).toBeDefined();
    });

    it('should throw BadRequestException for INVALID_INPUT error', async () => {
      const axiosError = new AxiosError('Bad request', '400', undefined, undefined, {
        data: {
          error_type: 'INVALID_INPUT',
          error_code: 'INVALID_INPUT',
          error_message: 'public_token is invalid',
          display_message: 'Invalid token',
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockClient.itemPublicTokenExchange.mockRejectedValue(axiosError);

      await expect(service.exchangePublicToken(MOCK_USER_ID, 'bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // syncTransactions
  // =========================================================================
  describe('syncTransactions', () => {
    it('should sync added, modified, and removed transactions', async () => {
      // Get item
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem])) // getItemById
        .mockReturnValueOnce(mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }])) // account map
        .mockReturnValueOnce(mockQuery([])) // upsert check for added (not existing)
        .mockReturnValueOnce(mockQuery([{ id: 'existing-tx', categorizationSource: 'plaid' }])); // upsert check for modified (existing)

      mockClient.transactionsSync.mockResolvedValue({
        data: {
          added: [mockPlaidTransaction],
          modified: [{ ...mockPlaidTransaction, transaction_id: 'plaid-tx-2', amount: 50 }],
          removed: [{ transaction_id: 'plaid-tx-removed' }],
          next_cursor: 'cursor-abc',
          has_more: false,
        },
      });

      // insert new transaction
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));
      // update existing transaction
      mockDb.update
        .mockReturnValueOnce(mockQuery(undefined)) // update modified tx
        .mockReturnValueOnce(mockQuery(undefined)); // update cursor
      // delete removed transaction
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactions(MOCK_ITEM_ID);

      expect(stats.added).toBe(1);
      expect(stats.modified).toBe(1);
      expect(stats.removed).toBe(1);
    });

    it('should paginate through all sync results when has_more is true', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]))
        .mockReturnValueOnce(mockQuery([])) // first tx upsert check
        .mockReturnValueOnce(mockQuery([])); // second tx upsert check

      // Page 1
      mockClient.transactionsSync.mockResolvedValueOnce({
        data: {
          added: [mockPlaidTransaction],
          modified: [],
          removed: [],
          next_cursor: 'cursor-1',
          has_more: true,
        },
      });

      // Page 2
      mockClient.transactionsSync.mockResolvedValueOnce({
        data: {
          added: [{ ...mockPlaidTransaction, transaction_id: 'plaid-tx-page2' }],
          modified: [],
          removed: [],
          next_cursor: 'cursor-2',
          has_more: false,
        },
      });

      mockDb.insert
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactions(MOCK_ITEM_ID);

      expect(stats.added).toBe(2);
      expect(mockClient.transactionsSync).toHaveBeenCalledTimes(2);
    });

    it('should persist cursor after successful sync', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([])); // no accounts

      mockClient.transactionsSync.mockResolvedValue({
        data: {
          added: [],
          modified: [],
          removed: [],
          next_cursor: 'final-cursor',
          has_more: false,
        },
      });

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.syncTransactions(MOCK_ITEM_ID);

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'final-cursor' }),
      );
    });

    it('should skip transactions with unknown account IDs', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([])); // empty account map

      mockClient.transactionsSync.mockResolvedValue({
        data: {
          added: [mockPlaidTransaction],
          modified: [],
          removed: [],
          next_cursor: 'c',
          has_more: false,
        },
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const stats = await service.syncTransactions(MOCK_ITEM_ID);

      expect(stats.added).toBe(0); // skipped because no matching account
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should preserve user categorization when updating transactions', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([{ id: 'acct-internal-1', plaidAccountId: 'plaid-acct-1' }]))
        .mockReturnValueOnce(mockQuery([{ id: 'existing-tx', categorizationSource: 'user' }]));

      mockClient.transactionsSync.mockResolvedValue({
        data: {
          added: [],
          modified: [mockPlaidTransaction],
          removed: [],
          next_cursor: 'c',
          has_more: false,
        },
      });

      const updateTxChain = mockQuery(undefined);
      mockDb.update
        .mockReturnValueOnce(updateTxChain) // update tx
        .mockReturnValueOnce(mockQuery(undefined)); // update cursor

      await service.syncTransactions(MOCK_ITEM_ID);

      // categorizationSource should NOT be included because user set it
      const setArg = updateTxChain.set.mock.calls[0][0];
      expect(setArg.categorizationSource).toBeUndefined();
    });

    it('should throw NotFoundException for non-existent item', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.syncTransactions('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should update item status to login_required on ITEM_LOGIN_REQUIRED error', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([]));

      const axiosError = new AxiosError('Login required', '400', undefined, undefined, {
        data: {
          error_type: 'ITEM_ERROR',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'the login details of this item have changed',
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockClient.transactionsSync.mockRejectedValue(axiosError);

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await expect(service.syncTransactions(MOCK_ITEM_ID)).rejects.toThrow(BadRequestException);

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'login_required',
          errorCode: 'ITEM_LOGIN_REQUIRED',
        }),
      );
    });
  });

  // =========================================================================
  // syncAccounts
  // =========================================================================
  describe('syncAccounts', () => {
    it('should update existing accounts', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem])) // getItemById
        .mockReturnValueOnce(mockQuery([{ id: 'existing-acct' }])); // existing account

      mockClient.accountsGet.mockResolvedValue({
        data: { accounts: [mockPlaidAccount] },
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.syncAccounts(MOCK_ITEM_ID);

      expect(result.synced).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should insert new accounts that do not exist locally', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockPlaidItem]))
        .mockReturnValueOnce(mockQuery([])); // no existing account

      mockClient.accountsGet.mockResolvedValue({
        data: { accounts: [mockPlaidAccount] },
      });

      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.syncAccounts(MOCK_ITEM_ID);

      expect(result.synced).toBe(1);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleWebhook
  // =========================================================================
  describe('handleWebhook', () => {
    it('should process TRANSACTIONS/SYNC_UPDATES_AVAILABLE webhook', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: MOCK_PLAID_ITEM_ID,
      });

      // findItemByPlaidItemId
      mockDb.select.mockReturnValueOnce(mockQuery([{ id: MOCK_ITEM_ID, userId: MOCK_USER_ID }]));

      // syncTransactions internally needs:
      // getItemById
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      // account map
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      mockClient.transactionsSync.mockResolvedValue({
        data: {
          added: [],
          modified: [],
          removed: [],
          next_cursor: 'c',
          has_more: false,
        },
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.received).toBe(true);
      expect(result.action).toBe('synced_sync_updates_available');
    });

    it('should process ITEM/ERROR webhook and update item status', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'ITEM',
        webhook_code: 'ERROR',
        item_id: MOCK_PLAID_ITEM_ID,
        error: {
          error_type: 'ITEM_ERROR',
          error_code: 'ITEM_LOGIN_REQUIRED',
          error_message: 'Login required',
        },
      });

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.received).toBe(true);
      expect(result.action).toBe('item_login_required');
    });

    it('should process ITEM/LOGIN_REPAIRED webhook', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'ITEM',
        webhook_code: 'LOGIN_REPAIRED',
        item_id: MOCK_PLAID_ITEM_ID,
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.action).toBe('login_repaired');
    });

    it('should process ITEM/PENDING_EXPIRATION webhook', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'ITEM',
        webhook_code: 'PENDING_EXPIRATION',
        item_id: MOCK_PLAID_ITEM_ID,
        consent_expiration_time: '2026-03-01T00:00:00Z',
      });

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.action).toBe('pending_expiration');
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending_expiration',
          consentExpiresAt: '2026-03-01T00:00:00Z',
        }),
      );
    });

    it('should process ITEM/USER_PERMISSION_REVOKED webhook', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'ITEM',
        webhook_code: 'USER_PERMISSION_REVOKED',
        item_id: MOCK_PLAID_ITEM_ID,
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.action).toBe('user_permission_revoked');
    });

    it('should return unhandled for unknown webhook types', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'UNKNOWN',
        webhook_code: 'SOMETHING',
        item_id: MOCK_PLAID_ITEM_ID,
      });

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.action).toBe('unhandled');
    });

    it('should return item_not_found when webhook references unknown item', async () => {
      const webhookBody = JSON.stringify({
        webhook_type: 'TRANSACTIONS',
        webhook_code: 'SYNC_UPDATES_AVAILABLE',
        item_id: 'unknown-plaid-item',
      });

      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.handleWebhook(webhookBody, {});

      expect(result.action).toBe('item_not_found');
    });
  });

  // =========================================================================
  // removeItem
  // =========================================================================
  describe('removeItem', () => {
    it('should remove item at Plaid and delete local records', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockClient.itemRemove.mockResolvedValue({ data: {} });
      mockDb.delete
        .mockReturnValueOnce(mockQuery(undefined)) // delete accounts
        .mockReturnValueOnce(mockQuery(undefined)); // delete plaid item

      await service.removeItem(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(mockClient.itemRemove).toHaveBeenCalledWith({
        access_token: MOCK_ACCESS_TOKEN,
      });
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException for non-existent item', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.removeItem(MOCK_USER_ID, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should still delete local records if Plaid API removal fails', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockClient.itemRemove.mockRejectedValue(new Error('Plaid unreachable'));
      mockDb.delete
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));

      // Should not throw
      await service.removeItem(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should not return item belonging to another user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([])); // WHERE userId + id yields nothing

      await expect(service.removeItem('other-user', MOCK_ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // refreshBalances
  // =========================================================================
  describe('refreshBalances', () => {
    it('should fetch and update balances for all accounts', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));

      mockClient.accountsGet.mockResolvedValue({
        data: {
          accounts: [
            mockPlaidAccount,
            {
              ...mockPlaidAccount,
              account_id: 'plaid-acct-2',
              balances: { current: 15000, available: 15000, limit: null, iso_currency_code: 'USD' },
            },
          ],
        },
      });

      mockDb.update
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));

      const result = await service.refreshBalances(MOCK_ITEM_ID);

      expect(result.refreshed).toBe(2);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException for non-existent item', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.refreshBalances('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should map rate limit errors to BadRequestException', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));

      const axiosError = new AxiosError('Rate limited', '429', undefined, undefined, {
        data: {
          error_type: 'RATE_LIMIT',
          error_code: 'RATE_LIMIT_EXCEEDED',
          error_message: 'Too many requests',
          display_message: 'Too many requests',
        },
        status: 429,
        statusText: 'Too Many Requests',
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
      mockClient.accountsGet.mockRejectedValue(axiosError);

      mockDb.update.mockReturnValueOnce(mockQuery(undefined)); // updateItemStatusOnError

      await expect(service.refreshBalances(MOCK_ITEM_ID)).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // getItems
  // =========================================================================
  describe('getItems', () => {
    it('should return all items for a user without access tokens', async () => {
      const items = [
        {
          id: MOCK_ITEM_ID,
          institutionId: 'ins_1',
          institutionName: 'Test Bank',
          status: 'active',
          errorCode: null,
          consentExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(items));

      const result = await service.getItems(MOCK_USER_ID);

      expect(result).toEqual(items);
      // Ensure accessToken is not in the projection
      expect(result[0]).not.toHaveProperty('accessToken');
    });

    it('should return empty array when user has no items', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getItems(MOCK_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Error handling edge cases
  // =========================================================================
  describe('error handling', () => {
    it('should map INSTITUTION_NOT_RESPONDING to user-friendly error', async () => {
      mockClient.linkTokenCreate.mockRejectedValue(
        new AxiosError('timeout', '500', undefined, undefined, {
          data: {
            error_type: 'INSTITUTION_ERROR',
            error_code: 'INSTITUTION_NOT_RESPONDING',
            error_message: 'Institution not responding',
          },
          status: 500,
          statusText: 'Server Error',
          headers: {},
          config: { headers: new AxiosHeaders() },
        }),
      );

      await expect(service.createLinkToken(MOCK_USER_ID)).rejects.toThrow(
        'Your bank is temporarily unavailable. Please try again later.',
      );
    });

    it('should map INSTITUTION_DOWN to user-friendly error', async () => {
      mockClient.linkTokenCreate.mockRejectedValue(
        new AxiosError('down', '500', undefined, undefined, {
          data: {
            error_type: 'INSTITUTION_ERROR',
            error_code: 'INSTITUTION_DOWN',
            error_message: 'Institution is down',
          },
          status: 500,
          statusText: 'Server Error',
          headers: {},
          config: { headers: new AxiosHeaders() },
        }),
      );

      await expect(service.createLinkToken(MOCK_USER_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
