import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';

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
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('AccountsService', () => {
  let service: AccountsService;
  let mockDb: any;

  const mockUserId = 'user-123';
  const mockAccountId = 'acct-123';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    name: 'My Checking',
    type: 'checking',
    institutionName: 'Bank of Test',
    currentBalance: 5000,
    currency: 'USD',
    isManual: true,
    isHidden: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

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

    service = new AccountsService(mockDb, mockCacheService as any);
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return all accounts for a user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockAccount]));

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([mockAccount]);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when user has no accounts', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  describe('findById', () => {
    it('should return an account when found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockAccount]));

      const result = await service.findById(mockUserId, mockAccountId);

      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.findById(mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return accounts belonging to another user', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.findById('other-user', mockAccountId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // createManual
  // ---------------------------------------------------------------------------
  describe('createManual', () => {
    it('should create a manual account with all fields', async () => {
      const createData = {
        name: 'Savings Account',
        type: 'savings',
        institutionName: 'Credit Union',
        balance: 10000,
        currency: 'EUR',
      };

      const createdAccount = {
        id: 'acct-new',
        userId: mockUserId,
        name: 'Savings Account',
        type: 'savings',
        institutionName: 'Credit Union',
        currentBalance: 10000,
        currency: 'EUR',
        isManual: true,
      };

      const chain = mockQuery([createdAccount]);
      mockDb.insert.mockReturnValueOnce(chain);

      const result = await service.createManual(mockUserId, createData);

      expect(result).toEqual(createdAccount);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          name: 'Savings Account',
          type: 'savings',
          currentBalance: 10000,
          currency: 'EUR',
          isManual: true,
        }),
      );
    });

    it('should default balance to 0 when not provided', async () => {
      const createData = {
        name: 'New Account',
        type: 'checking',
      };

      const createdAccount = {
        id: 'acct-new',
        userId: mockUserId,
        name: 'New Account',
        type: 'checking',
        currentBalance: 0,
        currency: 'USD',
        isManual: true,
      };

      const chain = mockQuery([createdAccount]);
      mockDb.insert.mockReturnValueOnce(chain);

      const result = await service.createManual(mockUserId, createData);

      expect(result.currentBalance).toBe(0);
      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ currentBalance: 0 }),
      );
    });

    it('should default currency to USD when not provided', async () => {
      const createData = {
        name: 'Basic Account',
        type: 'savings',
      };

      const chain = mockQuery([{ id: 'acct-new', currency: 'USD' }]);
      mockDb.insert.mockReturnValueOnce(chain);

      await service.createManual(mockUserId, createData);

      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
      );
    });

    it('should set institutionName to null when not provided', async () => {
      const createData = {
        name: 'Cash',
        type: 'other',
      };

      const chain = mockQuery([{ id: 'acct-new' }]);
      mockDb.insert.mockReturnValueOnce(chain);

      await service.createManual(mockUserId, createData);

      expect(chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ institutionName: null }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update account fields after ownership verification', async () => {
      // findById call for ownership check
      mockDb.select.mockReturnValueOnce(mockQuery([mockAccount]));

      const updatedAccount = { ...mockAccount, name: 'Renamed' };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedAccount]));

      const result = await service.update(mockUserId, mockAccountId, {
        name: 'Renamed',
      });

      expect(result.name).toBe('Renamed');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should allow hiding an account', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockAccount]));

      const updatedAccount = { ...mockAccount, isHidden: true };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedAccount]));

      const result = await service.update(mockUserId, mockAccountId, {
        isHidden: true,
      });

      expect(result.isHidden).toBe(true);
    });

    it('should throw NotFoundException when updating non-existent account', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.update(mockUserId, 'non-existent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete a manual account', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockAccount]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.remove(mockUserId, mockAccountId);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw Error when deleting a linked (non-manual) account', async () => {
      const linkedAccount = { ...mockAccount, isManual: false };
      mockDb.select.mockReturnValueOnce(mockQuery([linkedAccount]));

      await expect(
        service.remove(mockUserId, mockAccountId),
      ).rejects.toThrow(
        'Cannot delete a linked account. Unlink the institution instead.',
      );
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.remove(mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getNetWorth
  // ---------------------------------------------------------------------------
  describe('getNetWorth', () => {
    it('should calculate net worth with assets and liabilities', async () => {
      const accounts = [
        { ...mockAccount, type: 'checking', currentBalance: 5000, isHidden: false },
        { ...mockAccount, id: 'acct-2', type: 'savings', currentBalance: 10000, isHidden: false },
        { ...mockAccount, id: 'acct-3', type: 'credit_card', currentBalance: -2000, isHidden: false },
        { ...mockAccount, id: 'acct-4', type: 'loan', currentBalance: -15000, isHidden: false },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accounts));

      const result = await service.getNetWorth(mockUserId);

      expect(result.assets).toBe(15000); // 5000 + 10000
      expect(result.liabilities).toBe(17000); // abs(-2000) + abs(-15000)
      expect(result.netWorth).toBe(-2000); // 15000 - 17000
      expect(result.accountCount).toBe(4);
    });

    it('should exclude hidden accounts from net worth calculation', async () => {
      const accounts = [
        { ...mockAccount, type: 'checking', currentBalance: 5000, isHidden: false },
        { ...mockAccount, id: 'acct-2', type: 'savings', currentBalance: 10000, isHidden: true },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accounts));

      const result = await service.getNetWorth(mockUserId);

      expect(result.assets).toBe(5000); // Only non-hidden account
      expect(result.accountCount).toBe(1);
    });

    it('should handle zero balance accounts', async () => {
      const accounts = [
        { ...mockAccount, type: 'checking', currentBalance: 0, isHidden: false },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accounts));

      const result = await service.getNetWorth(mockUserId);

      expect(result.assets).toBe(0);
      expect(result.liabilities).toBe(0);
      expect(result.netWorth).toBe(0);
    });

    it('should handle null balance as zero', async () => {
      const accounts = [
        { ...mockAccount, type: 'checking', currentBalance: null, isHidden: false },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accounts));

      const result = await service.getNetWorth(mockUserId);

      expect(result.assets).toBe(0);
    });

    it('should handle user with no accounts', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getNetWorth(mockUserId);

      expect(result.assets).toBe(0);
      expect(result.liabilities).toBe(0);
      expect(result.netWorth).toBe(0);
      expect(result.accountCount).toBe(0);
    });

    it('should classify mortgage as liability', async () => {
      const accounts = [
        { ...mockAccount, type: 'mortgage', currentBalance: -250000, isHidden: false },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(accounts));

      const result = await service.getNetWorth(mockUserId);

      expect(result.assets).toBe(0);
      expect(result.liabilities).toBe(250000);
      expect(result.netWorth).toBe(-250000);
    });
  });
});
