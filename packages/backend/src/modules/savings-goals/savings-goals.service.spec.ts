import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SavingsGoalsService } from './savings-goals.service';

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
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('SavingsGoalsService', () => {
  let service: SavingsGoalsService;
  let mockDb: any;

  const mockUserId = 'user-123';
  const mockGoalId = 'goal-123';

  const mockGoal = {
    id: mockGoalId,
    userId: mockUserId,
    name: 'Vacation Fund',
    targetAmount: 5000,
    currentAmount: 2500,
    deadline: '2026-06-01',
    icon: 'plane',
    color: '#3B82F6',
    isCompleted: 0,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockContribution = {
    id: 'contrib-1',
    goalId: mockGoalId,
    amount: 500,
    note: 'Monthly savings',
    date: '2026-02-01',
    createdAt: '2026-02-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    service = new SavingsGoalsService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return goals with progress percentage', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([mockGoal]));

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].progress).toBe(50); // 2500/5000 * 100
    });

    it('should cap progress at 100% when currentAmount exceeds target', async () => {
      const overFundedGoal = { ...mockGoal, currentAmount: 6000 };
      mockDb.select.mockReturnValueOnce(mockQuery([overFundedGoal]));

      const result = await service.findAll(mockUserId);

      expect(result[0].progress).toBe(100);
    });

    it('should handle zero targetAmount without division by zero', async () => {
      const zeroTargetGoal = { ...mockGoal, targetAmount: 0, currentAmount: 0 };
      mockDb.select.mockReturnValueOnce(mockQuery([zeroTargetGoal]));

      const result = await service.findAll(mockUserId);

      expect(result[0].progress).toBe(0);
    });

    it('should return empty array when no goals exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([]);
    });

    it('should calculate progress correctly for multiple goals', async () => {
      const goals = [
        { ...mockGoal, id: 'g-1', currentAmount: 1000, targetAmount: 4000 }, // 25%
        { ...mockGoal, id: 'g-2', currentAmount: 3000, targetAmount: 3000 }, // 100%
        { ...mockGoal, id: 'g-3', currentAmount: 0, targetAmount: 1000 }, // 0%
      ];
      mockDb.select.mockReturnValueOnce(mockQuery(goals));

      const result = await service.findAll(mockUserId);

      expect(result[0].progress).toBe(25);
      expect(result[1].progress).toBe(100);
      expect(result[2].progress).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  describe('findById', () => {
    it('should return goal with contributions and progress', async () => {
      // Goal query
      mockDb.select.mockReturnValueOnce(mockQuery([mockGoal]));
      // Contributions query
      mockDb.select.mockReturnValueOnce(mockQuery([mockContribution]));

      const result = await service.findById(mockUserId, mockGoalId);

      expect(result.id).toBe(mockGoalId);
      expect(result.progress).toBe(50);
      expect(result.contributions).toHaveLength(1);
      expect(result.contributions[0].amount).toBe(500);
    });

    it('should throw NotFoundException when goal not found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.findById(mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('should create a new savings goal', async () => {
      const createData = {
        name: 'Emergency Fund',
        targetAmount: 10000,
        deadline: '2027-01-01',
        icon: 'shield',
        color: '#10B981',
      };

      const createdGoal = {
        id: 'goal-new',
        userId: mockUserId,
        ...createData,
        currentAmount: 0,
        isCompleted: 0,
      };

      mockDb.insert.mockReturnValueOnce(mockQuery([createdGoal]));

      const result = await service.create(mockUserId, createData);

      expect(result).toEqual(createdGoal);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should create goal without optional fields', async () => {
      const createData = {
        name: 'Simple Goal',
        targetAmount: 1000,
      };

      const createdGoal = {
        id: 'goal-new',
        userId: mockUserId,
        ...createData,
        currentAmount: 0,
        deadline: undefined,
        icon: undefined,
        color: undefined,
      };

      mockDb.insert.mockReturnValueOnce(mockQuery([createdGoal]));

      const result = await service.create(mockUserId, createData);

      expect(result.name).toBe('Simple Goal');
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update a goal after ownership verification', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      const updatedGoal = { ...mockGoal, targetAmount: 8000 };
      mockDb.update.mockReturnValueOnce(mockQuery([updatedGoal]));

      const result = await service.update(mockUserId, mockGoalId, {
        targetAmount: 8000,
      });

      expect(result.targetAmount).toBe(8000);
    });

    it('should throw NotFoundException for non-existent goal', async () => {
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
    it('should delete a goal after ownership verification', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.remove(mockUserId, mockGoalId);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent goal', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.remove(mockUserId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // addContribution
  // ---------------------------------------------------------------------------
  describe('addContribution', () => {
    it('should add contribution and update currentAmount', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      // Insert contribution
      mockDb.insert.mockReturnValueOnce(mockQuery([mockContribution]));
      // Update goal
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.addContribution(
        mockUserId,
        mockGoalId,
        500,
        'Monthly savings',
      );

      expect(result.amount).toBe(500);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should mark goal as completed when contribution meets target', async () => {
      const almostDoneGoal = { ...mockGoal, currentAmount: 4500 };

      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([almostDoneGoal]))
        .mockReturnValueOnce(mockQuery([]));

      const contribution = { ...mockContribution, amount: 500 };
      mockDb.insert.mockReturnValueOnce(mockQuery([contribution]));

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.addContribution(mockUserId, mockGoalId, 500);

      // newCurrentAmount = 4500 + 500 = 5000 >= 5000 => completed
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAmount: 5000,
          isCompleted: true,
        }),
      );
    });

    it('should not mark goal as completed when contribution is insufficient', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      const contribution = { ...mockContribution, amount: 100 };
      mockDb.insert.mockReturnValueOnce(mockQuery([contribution]));

      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.addContribution(mockUserId, mockGoalId, 100);

      // newCurrentAmount = 2500 + 100 = 2600 < 5000 => not completed
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAmount: 2600,
          isCompleted: false,
        }),
      );
    });

    it('should use current date when no date is provided', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      const insertChain = mockQuery([mockContribution]);
      mockDb.insert.mockReturnValueOnce(insertChain);
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      await service.addContribution(mockUserId, mockGoalId, 200);

      // Verify insert was called with a date
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          goalId: mockGoalId,
          amount: 200,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // removeContribution
  // ---------------------------------------------------------------------------
  describe('removeContribution', () => {
    it('should remove contribution and decrease currentAmount', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      // Find contribution
      mockDb.select.mockReturnValueOnce(mockQuery([mockContribution]));
      // Delete contribution
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // Update goal
      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.removeContribution(mockUserId, mockGoalId, 'contrib-1');

      // newCurrentAmount = max(0, 2500 - 500) = 2000
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAmount: 2000,
        }),
      );
    });

    it('should not allow currentAmount to go below zero', async () => {
      const lowBalanceGoal = { ...mockGoal, currentAmount: 100 };
      const bigContribution = { ...mockContribution, amount: 500 };

      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([lowBalanceGoal]))
        .mockReturnValueOnce(mockQuery([]));

      // Find contribution
      mockDb.select.mockReturnValueOnce(mockQuery([bigContribution]));
      // Delete contribution
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));
      // Update goal
      const updateChain = mockQuery(undefined);
      mockDb.update.mockReturnValueOnce(updateChain);

      await service.removeContribution(mockUserId, mockGoalId, 'contrib-1');

      // Math.max(0, 100 - 500) = 0
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAmount: 0,
        }),
      );
    });

    it('should throw NotFoundException when contribution not found', async () => {
      // findById: goal + contributions
      mockDb.select
        .mockReturnValueOnce(mockQuery([mockGoal]))
        .mockReturnValueOnce(mockQuery([]));

      // Find contribution - not found
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.removeContribution(mockUserId, mockGoalId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getSummary
  // ---------------------------------------------------------------------------
  describe('getSummary', () => {
    it('should calculate summary statistics across all goals', async () => {
      const goals = [
        { ...mockGoal, id: 'g-1', currentAmount: 2000, targetAmount: 5000, isCompleted: 0 },
        { ...mockGoal, id: 'g-2', currentAmount: 3000, targetAmount: 3000, isCompleted: 1 },
        { ...mockGoal, id: 'g-3', currentAmount: 500, targetAmount: 2000, isCompleted: 0 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(goals));

      const result = await service.getSummary(mockUserId);

      expect(result.totalSaved).toBe(5500); // 2000 + 3000 + 500
      expect(result.totalTarget).toBe(10000); // 5000 + 3000 + 2000
      expect(result.activeGoals).toBe(2);
      expect(result.completedGoals).toBe(1);
      expect(result.savingsRate).toBeCloseTo(55, 1); // (5500/10000) * 100
    });

    it('should handle no goals', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getSummary(mockUserId);

      expect(result.totalSaved).toBe(0);
      expect(result.totalTarget).toBe(0);
      expect(result.activeGoals).toBe(0);
      expect(result.completedGoals).toBe(0);
      expect(result.savingsRate).toBe(0);
    });

    it('should handle zero totalTarget without division error', async () => {
      const goals = [
        { ...mockGoal, currentAmount: 0, targetAmount: 0, isCompleted: 0 },
      ];

      mockDb.select.mockReturnValueOnce(mockQuery(goals));

      const result = await service.getSummary(mockUserId);

      expect(result.savingsRate).toBe(0);
    });
  });
});
