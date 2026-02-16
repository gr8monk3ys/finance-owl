import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import request from 'supertest';
import {
  createE2EApp,
  closeE2EApp,
  generateAccessToken,
  TEST_USER,
  type E2ETestContext,
} from './setup';

describe('Budgets E2E - /budgets', () => {
  let ctx: E2ETestContext;
  let server: any;
  let token: string;

  const mockBudget = {
    id: 'budget-001',
    userId: TEST_USER.id,
    categoryId: 'cat-food',
    householdId: null,
    name: null,
    budgetType: 'category',
    amount: 500,
    period: 'monthly',
    rollover: false,
    rolloverCap: null,
    isActive: true,
    alertThresholds: '[50, 75, 90, 100]',
    startDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockBudgetWithSpent = {
    id: 'budget-001',
    name: 'Food & Drink',
    budgetType: 'category',
    categoryId: 'cat-food',
    categoryName: 'Food & Drink',
    categoryColor: '#FF5733',
    categoryIcon: 'food',
    householdId: null,
    amount: 500,
    period: 'monthly',
    rollover: false,
    rolloverCap: null,
    isActive: true,
    alertThresholds: [50, 75, 90, 100],
    spent: 325,
    remaining: 175,
    percentUsed: 65,
    rolloverAmount: 0,
    effectiveBudget: 500,
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    daysRemaining: 13,
    projectedSpend: 445.5,
    onTrack: true,
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
  // GET /budgets - List all budgets
  // =========================================================================
  describe('GET /budgets', () => {
    it('should return all budgets with spending progress', async () => {
      ctx.mockBudgetsService.findAll.mockResolvedValue([mockBudgetWithSpent]);

      const res = await request(server)
        .get('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('spent');
      expect(res.body[0]).toHaveProperty('remaining');
      expect(res.body[0]).toHaveProperty('percentUsed');
      expect(res.body[0]).toHaveProperty('onTrack');
      expect(ctx.mockBudgetsService.findAll).toHaveBeenCalledWith(TEST_USER.id);
    });

    it('should return empty array when no budgets exist', async () => {
      ctx.mockBudgetsService.findAll.mockResolvedValue([]);

      const res = await request(server)
        .get('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      await request(server)
        .get('/budgets')
        .expect(401);
    });
  });

  // =========================================================================
  // GET /budgets/summary
  // =========================================================================
  describe('GET /budgets/summary', () => {
    it('should return budget summary with aggregate statistics', async () => {
      const mockSummary = {
        totalBudgeted: 2000,
        totalSpent: 1350,
        totalRemaining: 650,
        percentUsed: 67.5,
        budgetCount: 4,
        overBudgetCount: 1,
        onTrackCount: 3,
        projectedTotalSpend: 1800,
        projectedSurplusOrDeficit: 200,
      };

      ctx.mockBudgetsService.getSummary.mockResolvedValue(mockSummary);

      const res = await request(server)
        .get('/budgets/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalBudgeted', 2000);
      expect(res.body).toHaveProperty('totalSpent', 1350);
      expect(res.body).toHaveProperty('totalRemaining', 650);
      expect(res.body).toHaveProperty('percentUsed', 67.5);
      expect(res.body).toHaveProperty('budgetCount', 4);
      expect(res.body).toHaveProperty('overBudgetCount', 1);
      expect(res.body).toHaveProperty('onTrackCount', 3);
    });
  });

  // =========================================================================
  // GET /budgets/:id
  // =========================================================================
  describe('GET /budgets/:id', () => {
    it('should return a single budget by id', async () => {
      ctx.mockBudgetsService.findById.mockResolvedValue(mockBudget);

      const res = await request(server)
        .get('/budgets/budget-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe('budget-001');
      expect(res.body.amount).toBe(500);
    });

    it('should return 404 for non-existent budget', async () => {
      ctx.mockBudgetsService.findById.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await request(server)
        .get('/budgets/budget-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should not expose budgets belonging to other users', async () => {
      ctx.mockBudgetsService.findById.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await request(server)
        .get('/budgets/budget-other-user')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(ctx.mockBudgetsService.findById).toHaveBeenCalledWith(
        TEST_USER.id,
        'budget-other-user',
      );
    });
  });

  // =========================================================================
  // POST /budgets - Create
  // =========================================================================
  describe('POST /budgets', () => {
    const validBudget = {
      categoryId: 'cat-food',
      amount: 500,
      period: 'monthly',
    };

    it('should create a new budget', async () => {
      ctx.mockBudgetsService.create.mockResolvedValue({
        id: 'budget-new',
        userId: TEST_USER.id,
        ...validBudget,
        budgetType: 'category',
        rollover: false,
        isActive: true,
      });

      const res = await request(server)
        .post('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send(validBudget)
        .expect(201);

      expect(res.body.id).toBe('budget-new');
      expect(res.body.amount).toBe(500);
      expect(ctx.mockBudgetsService.create).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({
          categoryId: 'cat-food',
          amount: 500,
          period: 'monthly',
        }),
      );
    });

    it('should create a budget with rollover enabled', async () => {
      const budgetWithRollover = {
        ...validBudget,
        rollover: true,
        rolloverCap: 100,
      };

      ctx.mockBudgetsService.create.mockResolvedValue({
        id: 'budget-rollover',
        userId: TEST_USER.id,
        ...budgetWithRollover,
        budgetType: 'category',
        isActive: true,
      });

      const res = await request(server)
        .post('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send(budgetWithRollover)
        .expect(201);

      expect(res.body.rollover).toBe(true);
      expect(res.body.rolloverCap).toBe(100);
    });

    it('should return 400 when required fields are missing', async () => {
      await request(server)
        .post('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500 })
        .expect(400);
    });

    it('should return 400 for invalid period value', async () => {
      await request(server)
        .post('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          categoryId: 'cat-food',
          amount: 500,
          period: 'biannual', // Not in allowed values
        })
        .expect(400);
    });

    it('should return 409 when duplicate budget exists for same category and period', async () => {
      ctx.mockBudgetsService.create.mockRejectedValue(
        new ConflictException(
          'A budget already exists for this category and period.',
        ),
      );

      await request(server)
        .post('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .send(validBudget)
        .expect(409);
    });

    it('should return 401 without authentication', async () => {
      await request(server)
        .post('/budgets')
        .send(validBudget)
        .expect(401);
    });
  });

  // =========================================================================
  // PATCH /budgets/:id - Update
  // =========================================================================
  describe('PATCH /budgets/:id', () => {
    it('should update budget amount', async () => {
      ctx.mockBudgetsService.update.mockResolvedValue({
        ...mockBudget,
        amount: 750,
      });

      const res = await request(server)
        .patch('/budgets/budget-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 750 })
        .expect(200);

      expect(res.body.amount).toBe(750);
      expect(ctx.mockBudgetsService.update).toHaveBeenCalledWith(
        TEST_USER.id,
        'budget-001',
        expect.objectContaining({ amount: 750 }),
      );
    });

    it('should update budget period', async () => {
      ctx.mockBudgetsService.update.mockResolvedValue({
        ...mockBudget,
        period: 'quarterly',
      });

      const res = await request(server)
        .patch('/budgets/budget-001')
        .set('Authorization', `Bearer ${token}`)
        .send({ period: 'quarterly' })
        .expect(200);

      expect(res.body.period).toBe('quarterly');
    });

    it('should return 404 when updating non-existent budget', async () => {
      ctx.mockBudgetsService.update.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await request(server)
        .patch('/budgets/budget-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100 })
        .expect(404);
    });
  });

  // =========================================================================
  // DELETE /budgets/:id
  // =========================================================================
  describe('DELETE /budgets/:id', () => {
    it('should delete a budget and return 204', async () => {
      ctx.mockBudgetsService.remove.mockResolvedValue(undefined);

      await request(server)
        .delete('/budgets/budget-001')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      expect(ctx.mockBudgetsService.remove).toHaveBeenCalledWith(
        TEST_USER.id,
        'budget-001',
      );
    });

    it('should return 404 when deleting non-existent budget', async () => {
      ctx.mockBudgetsService.remove.mockRejectedValue(
        new NotFoundException('Budget not found'),
      );

      await request(server)
        .delete('/budgets/budget-nonexistent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // =========================================================================
  // POST /budgets/process-rollovers
  // =========================================================================
  describe('POST /budgets/process-rollovers', () => {
    it('should process rollovers and return results', async () => {
      const rolloverResults = [
        {
          budgetId: 'budget-001',
          previousPeriodSpent: 400,
          rolloverAmount: 100,
          newEffectiveBudget: 600,
        },
      ];
      ctx.mockBudgetsService.processRollovers.mockResolvedValue(rolloverResults);

      const res = await request(server)
        .post('/budgets/process-rollovers')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('rolloverAmount', 100);
      expect(res.body[0]).toHaveProperty('newEffectiveBudget', 600);
    });
  });

  // =========================================================================
  // Budget alerts (tested via summary/findAll)
  // =========================================================================
  describe('Budget alerts', () => {
    it('should include alert-related fields in budget list', async () => {
      const overBudget = {
        ...mockBudgetWithSpent,
        spent: 600,
        remaining: -100,
        percentUsed: 120,
        onTrack: false,
      };
      ctx.mockBudgetsService.findAll.mockResolvedValue([overBudget]);

      const res = await request(server)
        .get('/budgets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body[0].percentUsed).toBe(120);
      expect(res.body[0].onTrack).toBe(false);
      expect(res.body[0].remaining).toBe(-100);
    });

    it('should reflect over-budget count in summary', async () => {
      const summary = {
        totalBudgeted: 1000,
        totalSpent: 1200,
        totalRemaining: -200,
        percentUsed: 120,
        budgetCount: 2,
        overBudgetCount: 2,
        onTrackCount: 0,
        projectedTotalSpend: 1500,
        projectedSurplusOrDeficit: -500,
      };
      ctx.mockBudgetsService.getSummary.mockResolvedValue(summary);

      const res = await request(server)
        .get('/budgets/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.overBudgetCount).toBe(2);
      expect(res.body.totalRemaining).toBe(-200);
    });
  });
});
