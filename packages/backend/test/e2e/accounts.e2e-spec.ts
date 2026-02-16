import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import request from 'supertest';
import {
  createE2EApp,
  closeE2EApp,
  generateAccessToken,
  TEST_USER,
  type E2ETestContext,
} from './setup';

describe('Accounts E2E - /accounts', () => {
  let ctx: E2ETestContext;
  let server: any;
  let token: string;

  const mockAccount = {
    id: 'acct-001',
    userId: TEST_USER.id,
    name: 'My Checking',
    type: 'checking',
    institutionName: 'Bank of Test',
    currentBalance: 5000,
    currency: 'USD',
    isManual: true,
    isHidden: false,
    plaidAccountId: null,
    plaidItemId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeAll(async () => {
    ctx = await createE2EApp();
    server = ctx.app.getHttpServer();
    token = generateAccessToken(ctx.jwtService);
  });

  afterAll(async () => {
    await closeE2EApp(ctx);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /accounts - List all accounts
  // =========================================================================
  describe('GET /accounts', () => {
    it('should return all accounts for the authenticated user', async () => {
      ctx.mockAccountsService.findAll.mockResolvedValue([mockAccount]);

      const res = await request(server)
        .get('/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('acct-001');
      expect(res.body[0].name).toBe('My Checking');
      expect(ctx.mockAccountsService.findAll).toHaveBeenCalledWith(TEST_USER.id);
    });

    it('should return empty array when user has no accounts', async () => {
      ctx.mockAccountsService.findAll.mockResolvedValue([]);

      const res = await request(server)
        .get('/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      await request(server)
        .get('/accounts')
        .expect(401);
    });
  });

  // =========================================================================
  // GET /accounts/net-worth
  // =========================================================================
  describe('GET /accounts/net-worth', () => {
    it('should return net worth calculation', async () => {
      ctx.mockAccountsService.getNetWorth.mockResolvedValue({
        assets: 15000,
        liabilities: 5000,
        netWorth: 10000,
        accountCount: 3,
      });

      const res = await request(server)
        .get('/accounts/net-worth')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        assets: 15000,
        liabilities: 5000,
        netWorth: 10000,
        accountCount: 3,
      });
    });

    it('should return zero values when no accounts', async () => {
      ctx.mockAccountsService.getNetWorth.mockResolvedValue({
        assets: 0,
        liabilities: 0,
        netWorth: 0,
        accountCount: 0,
      });

      const res = await request(server)
        .get('/accounts/net-worth')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.netWorth).toBe(0);
      expect(res.body.accountCount).toBe(0);
    });

    it('should return negative net worth when liabilities exceed assets', async () => {
      ctx.mockAccountsService.getNetWorth.mockResolvedValue({
        assets: 5000,
        liabilities: 20000,
        netWorth: -15000,
        accountCount: 2,
      });

      const res = await request(server)
        .get('/accounts/net-worth')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.netWorth).toBe(-15000);
    });
  });

  // =========================================================================
  // GET /accounts/:id
  // =========================================================================
  describe('GET /accounts/:id', () => {
    it('should return a single account by id', async () => {
      ctx.mockAccountsService.findById.mockResolvedValue(mockAccount);

      const res = await request(server)
        .get('/accounts/acct-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe('acct-001');
      expect(res.body.name).toBe('My Checking');
      expect(res.body.currentBalance).toBe(5000);
    });

    it('should return 404 for non-existent account', async () => {
      ctx.mockAccountsService.findById.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      await request(server)
        .get('/accounts/acct-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should not expose accounts belonging to other users', async () => {
      ctx.mockAccountsService.findById.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      await request(server)
        .get('/accounts/acct-other-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      // The controller passes the authenticated user's ID
      expect(ctx.mockAccountsService.findById).toHaveBeenCalledWith(
        TEST_USER.id,
        'acct-other-user',
      );
    });
  });

  // =========================================================================
  // POST /accounts/manual - Create manual account
  // =========================================================================
  describe('POST /accounts/manual', () => {
    const validAccount = {
      name: 'Savings Account',
      type: 'savings',
    };

    it('should create a manual account with minimal fields', async () => {
      ctx.mockAccountsService.createManual.mockResolvedValue({
        id: 'acct-new',
        userId: TEST_USER.id,
        name: 'Savings Account',
        type: 'savings',
        institutionName: null,
        currentBalance: 0,
        currency: 'USD',
        isManual: true,
      });

      const res = await request(server)
        .post('/accounts/manual')
        .set('Authorization', `Bearer ${token}`)
        .send(validAccount)
        .expect(201);

      expect(res.body.id).toBe('acct-new');
      expect(res.body.name).toBe('Savings Account');
      expect(res.body.type).toBe('savings');
      expect(res.body.isManual).toBe(true);
    });

    it('should create a manual account with all optional fields', async () => {
      const fullAccount = {
        name: 'Credit Card',
        type: 'credit_card',
        institutionName: 'Chase',
        balance: -2500,
        currency: 'EUR',
      };

      ctx.mockAccountsService.createManual.mockResolvedValue({
        id: 'acct-full',
        userId: TEST_USER.id,
        name: 'Credit Card',
        type: 'credit_card',
        institutionName: 'Chase',
        currentBalance: -2500,
        currency: 'EUR',
        isManual: true,
      });

      const res = await request(server)
        .post('/accounts/manual')
        .set('Authorization', `Bearer ${token}`)
        .send(fullAccount)
        .expect(201);

      expect(res.body.institutionName).toBe('Chase');
      expect(res.body.currentBalance).toBe(-2500);
      expect(res.body.currency).toBe('EUR');
    });

    it('should return 400 when name is missing', async () => {
      await request(server)
        .post('/accounts/manual')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'savings' })
        .expect(400);
    });

    it('should return 400 when type is missing', async () => {
      await request(server)
        .post('/accounts/manual')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Account' })
        .expect(400);
    });

    it('should return 400 for invalid account type', async () => {
      await request(server)
        .post('/accounts/manual')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test', type: 'bitcoin_wallet' })
        .expect(400);
    });

    it('should accept all valid account types', async () => {
      const validTypes = [
        'checking',
        'savings',
        'credit_card',
        'investment',
        'loan',
        'mortgage',
        'other',
      ];

      for (const type of validTypes) {
        ctx.mockAccountsService.createManual.mockResolvedValue({
          id: `acct-${type}`,
          userId: TEST_USER.id,
          name: `${type} account`,
          type,
          isManual: true,
        });

        await request(server)
          .post('/accounts/manual')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: `${type} account`, type })
          .expect(201);
      }
    });

    it('should return 401 without authentication', async () => {
      await request(server)
        .post('/accounts/manual')
        .send(validAccount)
        .expect(401);
    });
  });

  // =========================================================================
  // PATCH /accounts/:id - Update
  // =========================================================================
  describe('PATCH /accounts/:id', () => {
    it('should update account name', async () => {
      ctx.mockAccountsService.update.mockResolvedValue({
        ...mockAccount,
        name: 'Renamed Account',
      });

      const res = await request(server)
        .patch('/accounts/acct-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed Account' })
        .expect(200);

      expect(res.body.name).toBe('Renamed Account');
      expect(ctx.mockAccountsService.update).toHaveBeenCalledWith(
        TEST_USER.id,
        'acct-001',
        expect.objectContaining({ name: 'Renamed Account' }),
      );
    });

    it('should update account balance', async () => {
      ctx.mockAccountsService.update.mockResolvedValue({
        ...mockAccount,
        currentBalance: 7500,
      });

      const res = await request(server)
        .patch('/accounts/acct-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentBalance: 7500 })
        .expect(200);

      expect(res.body.currentBalance).toBe(7500);
    });

    it('should hide an account', async () => {
      ctx.mockAccountsService.update.mockResolvedValue({
        ...mockAccount,
        isHidden: true,
      });

      const res = await request(server)
        .patch('/accounts/acct-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ isHidden: true })
        .expect(200);

      expect(res.body.isHidden).toBe(true);
    });

    it('should return 404 when updating non-existent account', async () => {
      ctx.mockAccountsService.update.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      await request(server)
        .patch('/accounts/acct-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  // =========================================================================
  // DELETE /accounts/:id
  // =========================================================================
  describe('DELETE /accounts/:id', () => {
    it('should delete a manual account and return 204', async () => {
      ctx.mockAccountsService.remove.mockResolvedValue(undefined);

      await request(server)
        .delete('/accounts/acct-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(ctx.mockAccountsService.remove).toHaveBeenCalledWith(
        TEST_USER.id,
        'acct-001',
      );
    });

    it('should return 404 when deleting non-existent account', async () => {
      ctx.mockAccountsService.remove.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      await request(server)
        .delete('/accounts/acct-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 500 when trying to delete a linked (non-manual) account', async () => {
      // The service throws a plain Error, not an HttpException
      ctx.mockAccountsService.remove.mockRejectedValue(
        new Error('Cannot delete a linked account. Unlink the institution instead.'),
      );

      await request(server)
        .delete('/accounts/acct-linked')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);
    });
  });

  // =========================================================================
  // Authorization
  // =========================================================================
  describe('Authorization', () => {
    it('should scope findAll to the authenticated user', async () => {
      ctx.mockAccountsService.findAll.mockResolvedValue([]);

      await request(server)
        .get('/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(ctx.mockAccountsService.findAll).toHaveBeenCalledWith(TEST_USER.id);
    });

    it('should scope create to the authenticated user', async () => {
      ctx.mockAccountsService.createManual.mockResolvedValue({
        id: 'acct-auth-test',
        userId: TEST_USER.id,
        name: 'Auth Test',
        type: 'checking',
        isManual: true,
      });

      await request(server)
        .post('/accounts/manual')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Auth Test', type: 'checking' })
        .expect(201);

      expect(ctx.mockAccountsService.createManual).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.any(Object),
      );
    });

    it('should scope update to the authenticated user', async () => {
      ctx.mockAccountsService.update.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      await request(server)
        .patch('/accounts/acct-other')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked' })
        .expect(404);

      expect(ctx.mockAccountsService.update).toHaveBeenCalledWith(
        TEST_USER.id,
        'acct-other',
        expect.any(Object),
      );
    });

    it('should scope deletion to the authenticated user', async () => {
      ctx.mockAccountsService.remove.mockRejectedValue(
        new NotFoundException('Account not found'),
      );

      await request(server)
        .delete('/accounts/acct-other')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(ctx.mockAccountsService.remove).toHaveBeenCalledWith(
        TEST_USER.id,
        'acct-other',
      );
    });
  });
});
