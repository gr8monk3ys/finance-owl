import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface ChallengeTemplate {
  type: string;
  name: string;
  description: string;
  targetAmount: number;
  durationDays: number;
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    type: 'no_spend',
    name: 'No-Spend Week',
    description:
      'Avoid all non-essential spending for 7 days. Only essentials like groceries and bills count.',
    targetAmount: 0,
    durationDays: 7,
  },
  {
    type: 'round_up',
    name: 'Round-Up Savings',
    description:
      'Round up every purchase to the nearest dollar and save the difference for 30 days.',
    targetAmount: 100,
    durationDays: 30,
  },
  {
    type: '52_week',
    name: '52-Week Savings',
    description:
      'Save $1 in week 1, $2 in week 2, and so on. By week 52, you will have saved $1,378.',
    targetAmount: 1378,
    durationDays: 365,
  },
  {
    type: 'penny',
    name: 'Penny Challenge',
    description:
      'Save 1 cent on day 1, 2 cents on day 2, etc. After 365 days you save $667.95.',
    targetAmount: 667.95,
    durationDays: 365,
  },
  {
    type: 'custom',
    name: 'Custom Challenge',
    description: 'Set your own savings target and timeline.',
    targetAmount: 500,
    durationDays: 30,
  },
];

@Injectable()
export class ChallengesService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async findAll(userId: string) {
    return this.db
      .select()
      .from(schema.challenges)
      .where(eq(schema.challenges.userId, userId))
      .orderBy(desc(schema.challenges.createdAt));
  }

  async findById(userId: string, id: string) {
    const [challenge] = await this.db
      .select()
      .from(schema.challenges)
      .where(
        and(
          eq(schema.challenges.id, id),
          eq(schema.challenges.userId, userId),
        ),
      )
      .limit(1);

    if (!challenge) throw new NotFoundException('Challenge not found');

    const entries = await this.db
      .select()
      .from(schema.challengeEntries)
      .where(eq(schema.challengeEntries.challengeId, id))
      .orderBy(desc(schema.challengeEntries.date));

    return { ...challenge, entries };
  }

  async create(
    userId: string,
    data: {
      type: string;
      name?: string;
      description?: string;
      targetAmount?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const template = CHALLENGE_TEMPLATES.find((t) => t.type === data.type);
    const today = new Date().toISOString().split('T')[0];
    const defaultEndDate = new Date(
      Date.now() + (template?.durationDays ?? 30) * 86400000,
    )
      .toISOString()
      .split('T')[0];

    const [challenge] = await this.db
      .insert(schema.challenges)
      .values({
        userId,
        type: data.type,
        name: data.name ?? template?.name ?? 'Custom Challenge',
        description:
          data.description ?? template?.description ?? null,
        targetAmount:
          data.targetAmount ?? template?.targetAmount ?? 500,
        startDate: data.startDate ?? today,
        endDate: data.endDate ?? defaultEndDate,
      })
      .returning();

    return challenge;
  }

  async addEntry(
    userId: string,
    challengeId: string,
    data: { amount: number; date?: string; note?: string },
  ) {
    const challenge = await this.findById(userId, challengeId);

    if (challenge.status !== 'active') {
      throw new NotFoundException('Challenge is not active');
    }

    const today = new Date().toISOString().split('T')[0];

    const [entry] = await this.db
      .insert(schema.challengeEntries)
      .values({
        challengeId,
        amount: data.amount,
        date: data.date ?? today,
        note: data.note,
      })
      .returning();

    // Update the current amount on the challenge
    const newAmount = challenge.currentAmount + data.amount;
    const isCompleted = newAmount >= challenge.targetAmount;

    await this.db
      .update(schema.challenges)
      .set({
        currentAmount: newAmount,
        streakDays: challenge.streakDays + 1,
        status: isCompleted ? 'completed' : 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.challenges.id, challengeId));

    return entry;
  }

  async abandon(userId: string, id: string) {
    await this.findById(userId, id);

    const [updated] = await this.db
      .update(schema.challenges)
      .set({
        status: 'abandoned',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.challenges.id, id),
          eq(schema.challenges.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async complete(userId: string, id: string) {
    await this.findById(userId, id);

    const [updated] = await this.db
      .update(schema.challenges)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.challenges.id, id),
          eq(schema.challenges.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async getLeaderboard(userId: string) {
    const completed = await this.db
      .select({
        totalCompleted:
          sql<number>`COUNT(CASE WHEN ${schema.challenges.status} = 'completed' THEN 1 END)`.as(
            'total_completed',
          ),
        totalSaved:
          sql<number>`COALESCE(SUM(CASE WHEN ${schema.challenges.status} = 'completed' THEN ${schema.challenges.currentAmount} ELSE 0 END), 0)`.as(
            'total_saved',
          ),
        longestStreak:
          sql<number>`COALESCE(MAX(${schema.challenges.streakDays}), 0)`.as(
            'longest_streak',
          ),
        activeChallenges:
          sql<number>`COUNT(CASE WHEN ${schema.challenges.status} = 'active' THEN 1 END)`.as(
            'active_challenges',
          ),
      })
      .from(schema.challenges)
      .where(eq(schema.challenges.userId, userId));

    return completed[0] ?? {
      totalCompleted: 0,
      totalSaved: 0,
      longestStreak: 0,
      activeChallenges: 0,
    };
  }

  async getActiveStreak(userId: string) {
    const [result] = await this.db
      .select({ streakDays: schema.challenges.streakDays })
      .from(schema.challenges)
      .where(
        and(
          eq(schema.challenges.userId, userId),
          eq(schema.challenges.status, 'active'),
        ),
      )
      .orderBy(desc(schema.challenges.streakDays))
      .limit(1);

    return result?.streakDays ?? 0;
  }

  getTemplates(): ChallengeTemplate[] {
    return CHALLENGE_TEMPLATES;
  }
}
