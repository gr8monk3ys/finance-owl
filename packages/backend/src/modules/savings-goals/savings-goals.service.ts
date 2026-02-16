import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { savingsGoals, savingsContributions } from './savings-goals.schema';

@Injectable()
export class SavingsGoalsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async findAll(userId: string) {
    const goals = await this.db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(desc(savingsGoals.createdAt));

    return goals.map((goal) => ({
      ...goal,
      progress:
        goal.targetAmount > 0
          ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
          : 0,
    }));
  }

  async findById(userId: string, id: string) {
    const [goal] = await this.db
      .select()
      .from(savingsGoals)
      .where(
        and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)),
      )
      .limit(1);

    if (!goal) throw new NotFoundException('Savings goal not found');

    const contributions = await this.db
      .select()
      .from(savingsContributions)
      .where(eq(savingsContributions.goalId, id))
      .orderBy(desc(savingsContributions.date));

    return {
      ...goal,
      progress:
        goal.targetAmount > 0
          ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
          : 0,
      contributions,
    };
  }

  async create(
    userId: string,
    data: {
      name: string;
      targetAmount: number;
      deadline?: string;
      icon?: string;
      color?: string;
    },
  ) {
    const [goal] = await this.db
      .insert(savingsGoals)
      .values({
        userId,
        name: data.name,
        targetAmount: data.targetAmount,
        deadline: data.deadline,
        icon: data.icon,
        color: data.color,
      })
      .returning();

    return goal;
  }

  async update(
    userId: string,
    id: string,
    data: {
      name?: string;
      targetAmount?: number;
      deadline?: string;
      icon?: string;
      color?: string;
    },
  ) {
    await this.findById(userId, id);

    const [updated] = await this.db
      .update(savingsGoals)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)),
      )
      .returning();

    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findById(userId, id);
    await this.db
      .delete(savingsGoals)
      .where(
        and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)),
      );
  }

  async addContribution(
    userId: string,
    goalId: string,
    amount: number,
    note?: string,
    date?: string,
  ) {
    const goal = await this.findById(userId, goalId);

    const contributionDate = date || new Date().toISOString().split('T')[0];

    const [contribution] = await this.db
      .insert(savingsContributions)
      .values({
        goalId,
        amount,
        note,
        date: contributionDate,
      })
      .returning();

    const newCurrentAmount = goal.currentAmount + amount;
    const isCompleted = newCurrentAmount >= goal.targetAmount;

    await this.db
      .update(savingsGoals)
      .set({
        currentAmount: newCurrentAmount,
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : goal.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(savingsGoals.id, goalId));

    return contribution;
  }

  async removeContribution(
    userId: string,
    goalId: string,
    contributionId: string,
  ) {
    // Verify goal ownership
    const goal = await this.findById(userId, goalId);

    const [contribution] = await this.db
      .select()
      .from(savingsContributions)
      .where(
        and(
          eq(savingsContributions.id, contributionId),
          eq(savingsContributions.goalId, goalId),
        ),
      )
      .limit(1);

    if (!contribution) throw new NotFoundException('Contribution not found');

    await this.db
      .delete(savingsContributions)
      .where(eq(savingsContributions.id, contributionId));

    const newCurrentAmount = Math.max(0, goal.currentAmount - contribution.amount);
    const isCompleted = newCurrentAmount >= goal.targetAmount;

    await this.db
      .update(savingsGoals)
      .set({
        currentAmount: newCurrentAmount,
        isCompleted,
        completedAt: isCompleted ? goal.completedAt : null,
        updatedAt: new Date(),
      })
      .where(eq(savingsGoals.id, goalId));
  }

  async getSummary(userId: string) {
    const goals = await this.db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId));

    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const activeGoals = goals.filter((g) => !g.isCompleted).length;
    const completedGoals = goals.filter((g) => g.isCompleted).length;
    const savingsRate =
      totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return {
      totalSaved,
      totalTarget,
      activeGoals,
      completedGoals,
      savingsRate,
    };
  }
}
