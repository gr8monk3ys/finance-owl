import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import request from 'supertest';
import {
  createE2EApp,
  closeE2EApp,
  generateAccessToken,
  TEST_USER,
  OTHER_USER,
  type E2ETestContext,
} from './setup';

describe('Transactions E2E - /transactions', () => {
  let ctx: E2ETestContext;
  let server: any;
  let token: string;

  const mockTransaction = {
    id: 'txn-001',
    accountId: 'acct-001',
    categoryId: 'cat-001',
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
  // GET /transactions - List with pagination
  // =========================================================================
  describe('GET /transactions', () => {
    it('should return paginated transactions with default pagination', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [mockTransaction],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await request(server)
        .get('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(50);
      expect(res.body.meta.total).toBe(1);
      expect(ctx.mockTransactionsService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.any(Object),
      );
    });

    it('should support custom page and limit parameters', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 100, totalPages: 10 },
      });

      const res = await request(server)
        .get('/transactions?page=2&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.totalPages).toBe(10);
    });

    it('should filter by date range', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [mockTransaction],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      await request(server)
        .get('/transactions?startDate=2026-01-01&endDate=2026-02-28')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(ctx.mockTransactionsService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({
          startDate: '2026-01-01',
          endDate: '2026-02-28',
        }),
      );
    });

    it('should filter by category', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await request(server)
        .get('/transactions?categoryId=cat-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(ctx.mockTransactionsService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({ categoryId: 'cat-001' }),
      );
    });

    it('should filter by amount range', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [mockTransaction],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      await request(server)
        .get('/transactions?minAmount=10&maxAmount=100')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(ctx.mockTransactionsService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({
          minAmount: 10,
          maxAmount: 100,
        }),
      );
    });

    it('should search by description/name', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [mockTransaction],
        meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      await request(server)
        .get('/transactions?search=coffee')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(ctx.mockTransactionsService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({ search: 'coffee' }),
      );
    });

    it('should return empty array when no transactions found', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      const res = await request(server)
        .get('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      await request(server).get('/transactions').expect(401);
    });
  });

  // =========================================================================
  // GET /transactions/:id
  // =========================================================================
  describe('GET /transactions/:id', () => {
    it('should return a single transaction by id', async () => {
      ctx.mockTransactionsService.findById.mockResolvedValue(mockTransaction);

      const res = await request(server)
        .get('/transactions/txn-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe('txn-001');
      expect(res.body.amount).toBe(42.5);
      expect(res.body.name).toBe('Coffee Shop');
    });

    it('should return 404 for non-existent transaction', async () => {
      ctx.mockTransactionsService.findById.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await request(server)
        .get('/transactions/txn-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should not expose transactions belonging to other users', async () => {
      ctx.mockTransactionsService.findById.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await request(server)
        .get('/transactions/txn-other-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      // Verify the service was called with the authenticated user's ID
      expect(ctx.mockTransactionsService.findById).toHaveBeenCalledWith(
        TEST_USER.id,
        'txn-other-user',
      );
    });
  });

  // =========================================================================
  // POST /transactions - Create manual transaction
  // =========================================================================
  describe('POST /transactions', () => {
    const validTransaction = {
      accountId: 'acct-001',
      amount: 25.0,
      name: 'Grocery Store',
      date: '2026-02-15',
    };

    it('should create a manual transaction', async () => {
      const created = {
        id: 'txn-new',
        userId: TEST_USER.id,
        ...validTransaction,
        isManual: true,
        pending: false,
      };
      ctx.mockTransactionsService.createManual.mockResolvedValue(created);

      const res = await request(server)
        .post('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(validTransaction)
        .expect(201);

      expect(res.body.id).toBe('txn-new');
      expect(res.body.isManual).toBe(true);
      expect(ctx.mockTransactionsService.createManual).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({
          accountId: 'acct-001',
          amount: 25,
          name: 'Grocery Store',
          date: '2026-02-15',
        }),
      );
    });

    it('should create transaction with optional fields', async () => {
      const fullTransaction = {
        ...validTransaction,
        merchantName: 'Whole Foods',
        description: 'Weekly groceries',
        categoryId: 'cat-food',
        pending: false,
        notes: 'Regular shopping',
      };

      ctx.mockTransactionsService.createManual.mockResolvedValue({
        id: 'txn-full',
        userId: TEST_USER.id,
        ...fullTransaction,
        isManual: true,
      });

      const res = await request(server)
        .post('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send(fullTransaction)
        .expect(201);

      expect(res.body.id).toBe('txn-full');
    });

    it('should return 400 when required fields are missing', async () => {
      await request(server)
        .post('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10 })
        .expect(400);
    });

    it('should return 400 for invalid date format', async () => {
      await request(server)
        .post('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validTransaction,
          date: '02-15-2026', // Wrong format, should be YYYY-MM-DD
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(server).post('/transactions').send(validTransaction).expect(401);
    });
  });

  // =========================================================================
  // PATCH /transactions/:id - Update
  // =========================================================================
  describe('PATCH /transactions/:id', () => {
    it('should update a transaction', async () => {
      ctx.mockTransactionsService.update.mockResolvedValue({
        ...mockTransaction,
        notes: 'Updated note',
      });

      const res = await request(server)
        .patch('/transactions/txn-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated note' })
        .expect(200);

      expect(res.body.notes).toBe('Updated note');
      expect(ctx.mockTransactionsService.update).toHaveBeenCalledWith(
        TEST_USER.id,
        'txn-001',
        expect.objectContaining({ notes: 'Updated note' }),
      );
    });

    it('should update transaction category', async () => {
      ctx.mockTransactionsService.update.mockResolvedValue({
        ...mockTransaction,
        categoryId: 'cat-new',
      });

      const res = await request(server)
        .patch('/transactions/txn-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId: 'cat-new' })
        .expect(200);

      expect(res.body.categoryId).toBe('cat-new');
    });

    it('should return 404 when updating non-existent transaction', async () => {
      ctx.mockTransactionsService.update.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await request(server)
        .patch('/transactions/txn-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'test' })
        .expect(404);
    });
  });

  // =========================================================================
  // DELETE /transactions/:id
  // =========================================================================
  describe('DELETE /transactions/:id', () => {
    it('should delete a manual transaction', async () => {
      ctx.mockTransactionsService.remove.mockResolvedValue(undefined);

      await request(server)
        .delete('/transactions/txn-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(ctx.mockTransactionsService.remove).toHaveBeenCalledWith(TEST_USER.id, 'txn-001');
    });

    it('should return 404 when deleting non-existent transaction', async () => {
      ctx.mockTransactionsService.remove.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await request(server)
        .delete('/transactions/txn-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 when trying to delete non-manual transaction', async () => {
      ctx.mockTransactionsService.remove.mockRejectedValue(
        new NotFoundException('Can only delete manual transactions'),
      );

      await request(server)
        .delete('/transactions/txn-linked')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // =========================================================================
  // Authorization: Cross-user access
  // =========================================================================
  describe('Authorization', () => {
    it('should prevent access to other users transactions via findAll', async () => {
      ctx.mockTransactionsService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await request(server)
        .get('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // The controller always passes the authenticated user's ID
      expect(ctx.mockTransactionsService.findAll).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.any(Object),
      );
    });

    it('should prevent access to other users transactions via findById', async () => {
      ctx.mockTransactionsService.findById.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      // Attempt to access another user's transaction ID
      await request(server)
        .get('/transactions/txn-belonging-to-other-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      // The service enforces user scoping
      expect(ctx.mockTransactionsService.findById).toHaveBeenCalledWith(
        TEST_USER.id,
        'txn-belonging-to-other-user',
      );
    });

    it('should scope deletion to the authenticated user', async () => {
      ctx.mockTransactionsService.remove.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await request(server)
        .delete('/transactions/txn-other')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(ctx.mockTransactionsService.remove).toHaveBeenCalledWith(TEST_USER.id, 'txn-other');
    });

    it('should scope updates to the authenticated user', async () => {
      ctx.mockTransactionsService.update.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await request(server)
        .patch('/transactions/txn-other')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'hacked' })
        .expect(404);

      expect(ctx.mockTransactionsService.update).toHaveBeenCalledWith(
        TEST_USER.id,
        'txn-other',
        expect.any(Object),
      );
    });
  });
});
