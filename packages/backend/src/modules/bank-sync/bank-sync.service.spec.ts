import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BankSyncService } from './bank-sync.service';

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
// Factory: create service with all mocks injected
// ---------------------------------------------------------------------------

function createService() {
  const mockDb: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockPlaidProvider = {
    name: 'plaid',
    createLinkToken: vi.fn(),
    createUpdateLinkToken: vi.fn(),
    exchangeToken: vi.fn(),
    getAccounts: vi.fn(),
    syncTransactions: vi.fn(),
    removeConnection: vi.fn(),
  };

  const mockAggregatorFactory = {
    getDefaultProvider: vi.fn().mockReturnValue(mockPlaidProvider),
    getProvider: vi.fn().mockReturnValue(mockPlaidProvider),
    getDefaultProviderName: vi.fn().mockReturnValue('plaid'),
    getAvailableProviders: vi.fn().mockReturnValue([mockPlaidProvider]),
  };

  const mockCryptoService = {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
    decrypt: vi.fn((value: string) => value.replace('encrypted:', '')),
  };

  const service = new BankSyncService(
    mockDb as any,
    mockAggregatorFactory as any,
    mockPlaidProvider as any,
    mockCryptoService as any,
  );

  return {
    service,
    mockDb,
    mockPlaidProvider,
    mockAggregatorFactory,
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
  consentExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockExchangeResult = {
  accessToken: MOCK_ACCESS_TOKEN,
  itemId: MOCK_PLAID_ITEM_ID,
  institutionId: 'ins_1',
  institutionName: 'Test Bank',
  provider: 'plaid' as const,
  accounts: [
    {
      externalId: 'plaid-acct-1',
      name: 'Checking',
      officialName: 'Premium Checking',
      type: 'checking',
      subtype: 'checking',
      mask: '1234',
      currentBalance: 5000,
      availableBalance: 4800,
      creditLimit: null,
      currency: 'USD',
    },
    {
      externalId: 'plaid-acct-2',
      name: 'Savings',
      officialName: 'High Yield Savings',
      type: 'savings',
      subtype: 'savings',
      mask: '5678',
      currentBalance: 25000,
      availableBalance: 25000,
      creditLimit: null,
      currency: 'USD',
    },
  ],
};

const mockBankAccounts = [
  {
    externalId: 'plaid-acct-1',
    name: 'Checking',
    officialName: 'Premium Checking',
    type: 'checking',
    subtype: 'checking',
    mask: '1234',
    currentBalance: 5200,
    availableBalance: 5000,
    creditLimit: null,
    currency: 'USD',
  },
  {
    externalId: 'plaid-acct-2',
    name: 'Savings',
    officialName: 'High Yield Savings',
    type: 'savings',
    subtype: 'savings',
    mask: '5678',
    currentBalance: 25100,
    availableBalance: 25100,
    creditLimit: null,
    currency: 'USD',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BankSyncService', () => {
  let service: BankSyncService;
  let mockDb: any;
  let mockPlaidProvider: any;
  let mockAggregatorFactory: any;
  let mockCryptoService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const created = createService();
    service = created.service;
    mockDb = created.mockDb;
    mockPlaidProvider = created.mockPlaidProvider;
    mockAggregatorFactory = created.mockAggregatorFactory;
    mockCryptoService = created.mockCryptoService;
  });

  // =========================================================================
  // createLinkToken
  // =========================================================================
  describe('createLinkToken', () => {
    it('should create a link token using the default provider', async () => {
      const linkTokenResult = {
        linkToken: 'link-sandbox-token-123',
        expiration: '2026-03-15T12:00:00Z',
        provider: 'plaid',
      };
      mockPlaidProvider.createLinkToken.mockResolvedValue(linkTokenResult);

      const result = await service.createLinkToken(MOCK_USER_ID);

      expect(result).toEqual(linkTokenResult);
      expect(mockAggregatorFactory.getDefaultProvider).toHaveBeenCalled();
      expect(mockPlaidProvider.createLinkToken).toHaveBeenCalledWith(MOCK_USER_ID);
    });

    it('should create a link token using a specified provider', async () => {
      const linkTokenResult = {
        linkToken: 'link-mx-token-456',
        expiration: '2026-03-15T12:00:00Z',
        provider: 'mx',
      };
      const mockMxProvider = {
        name: 'mx',
        createLinkToken: vi.fn().mockResolvedValue(linkTokenResult),
      };
      mockAggregatorFactory.getProvider.mockReturnValue(mockMxProvider);

      const result = await service.createLinkToken(MOCK_USER_ID, 'mx');

      expect(result).toEqual(linkTokenResult);
      expect(mockAggregatorFactory.getProvider).toHaveBeenCalledWith('mx');
      expect(mockMxProvider.createLinkToken).toHaveBeenCalledWith(MOCK_USER_ID);
    });

    it('should propagate provider errors', async () => {
      mockPlaidProvider.createLinkToken.mockRejectedValue(new Error('Plaid API failure'));

      await expect(service.createLinkToken(MOCK_USER_ID)).rejects.toThrow('Plaid API failure');
    });

    it('should throw when specified provider is not found', async () => {
      mockAggregatorFactory.getProvider.mockImplementation(() => {
        throw new NotFoundException('Aggregator "invalid" is not available.');
      });

      await expect(service.createLinkToken(MOCK_USER_ID, 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // createUpdateLinkToken
  // =========================================================================
  describe('createUpdateLinkToken', () => {
    it('should create an update link token for an existing item', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.createUpdateLinkToken.mockResolvedValue({
        linkToken: 'link-update-token',
        expiration: '2026-03-15T12:00:00Z',
      });

      const result = await service.createUpdateLinkToken(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(result).toEqual({
        linkToken: 'link-update-token',
        expiration: '2026-03-15T12:00:00Z',
      });
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith(MOCK_ENCRYPTED_TOKEN);
      expect(mockPlaidProvider.createUpdateLinkToken).toHaveBeenCalledWith(MOCK_ACCESS_TOKEN);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.createUpdateLinkToken(MOCK_USER_ID, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item belongs to another user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.createUpdateLinkToken('other-user', MOCK_ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // exchangeAndStore
  // =========================================================================
  describe('exchangeAndStore', () => {
    it('should exchange token, encrypt access token, and store item + accounts', async () => {
      mockPlaidProvider.exchangeToken.mockResolvedValue(mockExchangeResult);

      // insert plaid item
      const plaidItemInsertChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(plaidItemInsertChain);

      // insert first account
      const acct1 = { id: 'acct-1', name: 'Premium Checking' };
      mockDb.insert.mockReturnValueOnce(mockQuery([acct1]));

      // insert second account
      const acct2 = { id: 'acct-2', name: 'High Yield Savings' };
      mockDb.insert.mockReturnValueOnce(mockQuery([acct2]));

      const result = await service.exchangeAndStore(MOCK_USER_ID, 'public-sandbox-token');

      expect(result.plaidItem).toEqual(mockPlaidItem);
      expect(result.accounts).toHaveLength(2);
      expect(result.provider).toBe('plaid');
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(MOCK_ACCESS_TOKEN);
      // 1 for plaid item + 2 for accounts
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it('should use a specified provider for token exchange', async () => {
      const mxResult = { ...mockExchangeResult, provider: 'mx' as const, accounts: [] };
      const mockMxProvider = {
        name: 'mx',
        exchangeToken: vi.fn().mockResolvedValue(mxResult),
      };
      mockAggregatorFactory.getProvider.mockReturnValue(mockMxProvider);

      const plaidItemChain = mockQuery([{ ...mockPlaidItem, id: 'item-new' }]);
      mockDb.insert.mockReturnValueOnce(plaidItemChain);

      const result = await service.exchangeAndStore(MOCK_USER_ID, 'public-token', 'mx');

      expect(result.provider).toBe('mx');
      expect(mockAggregatorFactory.getProvider).toHaveBeenCalledWith('mx');
      expect(mockMxProvider.exchangeToken).toHaveBeenCalledWith('public-token');
    });

    it('should store the encrypted access token, not the raw one', async () => {
      mockPlaidProvider.exchangeToken.mockResolvedValue({
        ...mockExchangeResult,
        accounts: [],
      });

      const insertChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(insertChain);

      await service.exchangeAndStore(MOCK_USER_ID, 'public-token');

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: `encrypted:${MOCK_ACCESS_TOKEN}`,
        }),
      );
    });

    it('should use officialName as account name when available', async () => {
      mockPlaidProvider.exchangeToken.mockResolvedValue({
        ...mockExchangeResult,
        accounts: [
          {
            ...mockExchangeResult.accounts[0],
            name: 'Checking',
            officialName: 'Premium Checking',
          },
        ],
      });

      const plaidItemChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(plaidItemChain);

      const accountChain = mockQuery([{ id: 'acct-1' }]);
      mockDb.insert.mockReturnValueOnce(accountChain);

      await service.exchangeAndStore(MOCK_USER_ID, 'public-token');

      expect(accountChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Premium Checking',
        }),
      );
    });

    it('should fall back to name when officialName is null', async () => {
      mockPlaidProvider.exchangeToken.mockResolvedValue({
        ...mockExchangeResult,
        accounts: [
          {
            ...mockExchangeResult.accounts[0],
            name: 'My Checking',
            officialName: null,
          },
        ],
      });

      const plaidItemChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(plaidItemChain);

      const accountChain = mockQuery([{ id: 'acct-1' }]);
      mockDb.insert.mockReturnValueOnce(accountChain);

      await service.exchangeAndStore(MOCK_USER_ID, 'public-token');

      expect(accountChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Checking',
        }),
      );
    });

    it('should store accounts with isManual set to false', async () => {
      mockPlaidProvider.exchangeToken.mockResolvedValue({
        ...mockExchangeResult,
        accounts: [mockExchangeResult.accounts[0]],
      });

      const plaidItemChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(plaidItemChain);

      const accountChain = mockQuery([{ id: 'acct-1' }]);
      mockDb.insert.mockReturnValueOnce(accountChain);

      await service.exchangeAndStore(MOCK_USER_ID, 'public-token');

      expect(accountChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ isManual: false }),
      );
    });

    it('should handle exchange with zero accounts', async () => {
      mockPlaidProvider.exchangeToken.mockResolvedValue({
        ...mockExchangeResult,
        accounts: [],
      });

      const plaidItemChain = mockQuery([mockPlaidItem]);
      mockDb.insert.mockReturnValueOnce(plaidItemChain);

      const result = await service.exchangeAndStore(MOCK_USER_ID, 'public-token');

      expect(result.accounts).toHaveLength(0);
      // Only one insert for the plaid item, none for accounts
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from the exchange step', async () => {
      mockPlaidProvider.exchangeToken.mockRejectedValue(new Error('Invalid public token'));

      await expect(service.exchangeAndStore(MOCK_USER_ID, 'bad-token')).rejects.toThrow(
        'Invalid public token',
      );
    });
  });

  // =========================================================================
  // refreshBalances
  // =========================================================================
  describe('refreshBalances', () => {
    it('should fetch and update balances for all accounts', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.getAccounts.mockResolvedValue(mockBankAccounts);

      mockDb.update
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));

      const count = await service.refreshBalances(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(count).toBe(2);
      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith(MOCK_ENCRYPTED_TOKEN);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.refreshBalances(MOCK_USER_ID, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when item belongs to another user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.refreshBalances('other-user', MOCK_ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle zero accounts returned from provider', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.getAccounts.mockResolvedValue([]);

      const count = await service.refreshBalances(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(count).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should update balances with correct values from provider', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.getAccounts.mockResolvedValue([mockBankAccounts[0]]);

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.refreshBalances(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentBalance: 5200,
          availableBalance: 5000,
          creditLimit: null,
        }),
      );
    });

    it('should propagate provider errors', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.getAccounts.mockRejectedValue(new Error('Plaid API unavailable'));

      await expect(service.refreshBalances(MOCK_USER_ID, MOCK_ITEM_ID)).rejects.toThrow(
        'Plaid API unavailable',
      );
    });
  });

  // =========================================================================
  // unlinkItem
  // =========================================================================
  describe('unlinkItem', () => {
    it('should remove item at provider and delete local records', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.removeConnection.mockResolvedValue(undefined);
      mockDb.delete
        .mockReturnValueOnce(mockQuery(undefined)) // delete accounts
        .mockReturnValueOnce(mockQuery(undefined)); // delete plaid item

      await service.unlinkItem(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(mockPlaidProvider.removeConnection).toHaveBeenCalledWith(MOCK_ACCESS_TOKEN);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.unlinkItem(MOCK_USER_ID, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should still delete local records if remote removal fails', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));
      mockPlaidProvider.removeConnection.mockRejectedValue(new Error('Provider unreachable'));
      mockDb.delete
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));

      // Should not throw despite remote failure
      await service.unlinkItem(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should not delete items belonging to another user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.unlinkItem('other-user', MOCK_ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getPlaidItems
  // =========================================================================
  describe('getPlaidItems', () => {
    it('should return all items for a user with safe projections', async () => {
      const items = [
        {
          id: MOCK_ITEM_ID,
          institutionName: 'Test Bank',
          institutionId: 'ins_1',
          status: 'active',
          errorCode: null,
          createdAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(items));

      const result = await service.getPlaidItems(MOCK_USER_ID);

      expect(result).toEqual(items);
      expect(result[0]).not.toHaveProperty('accessToken');
    });

    it('should return empty array when user has no items', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getPlaidItems(MOCK_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // updateItemStatus
  // =========================================================================
  describe('updateItemStatus', () => {
    it('should update item status and error code', async () => {
      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.updateItemStatus(MOCK_PLAID_ITEM_ID, 'login_required', 'ITEM_LOGIN_REQUIRED');

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'login_required',
          errorCode: 'ITEM_LOGIN_REQUIRED',
        }),
      );
    });

    it('should set errorCode to null when not provided', async () => {
      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.updateItemStatus(MOCK_PLAID_ITEM_ID, 'active');

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          errorCode: null,
        }),
      );
    });
  });

  // =========================================================================
  // getDecryptedAccessToken
  // =========================================================================
  describe('getDecryptedAccessToken', () => {
    it('should decrypt the token using the crypto service', () => {
      const result = service.getDecryptedAccessToken(MOCK_ENCRYPTED_TOKEN);

      expect(result).toBe(MOCK_ACCESS_TOKEN);
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith(MOCK_ENCRYPTED_TOKEN);
    });
  });

  // =========================================================================
  // getPlaidItemRaw
  // =========================================================================
  describe('getPlaidItemRaw', () => {
    it('should return the full item row including encrypted access token', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockPlaidItem]));

      const result = await service.getPlaidItemRaw(MOCK_USER_ID, MOCK_ITEM_ID);

      expect(result).toEqual(mockPlaidItem);
      expect(result.accessToken).toBe(MOCK_ENCRYPTED_TOKEN);
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.getPlaidItemRaw(MOCK_USER_ID, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for wrong user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.getPlaidItemRaw('other-user', MOCK_ITEM_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // getAvailableProviders
  // =========================================================================
  describe('getAvailableProviders', () => {
    it('should return provider list with default flag', () => {
      const result = service.getAvailableProviders();

      expect(result).toEqual([{ name: 'plaid', isDefault: true }]);
    });

    it('should mark the correct provider as default', () => {
      mockAggregatorFactory.getDefaultProviderName.mockReturnValue('mx');
      mockAggregatorFactory.getAvailableProviders.mockReturnValue([
        { name: 'plaid' },
        { name: 'mx' },
      ]);

      const result = service.getAvailableProviders();

      expect(result).toEqual([
        { name: 'plaid', isDefault: false },
        { name: 'mx', isDefault: true },
      ]);
    });

    it('should return empty array when no providers are available', () => {
      mockAggregatorFactory.getAvailableProviders.mockReturnValue([]);

      const result = service.getAvailableProviders();

      expect(result).toEqual([]);
    });
  });
});
