import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { envelopes, envelopeTransactions } from './envelopes.schema';

export interface EnvelopeWithBalance {
  id: string;
  name: string;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentUsed: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  color: string | null;
  icon: string | null;
  rollover: boolean;
  isGoal: boolean;
  targetAmount: number | null;
  goalProgress: number | null;
  period: string;
  periodStart: Date;
}

export interface EnvelopeSummary {
  totalIncome: number;
  totalAllocated: number;
  unallocatedAmount: number;
  totalSpent: number;
  totalRemaining: number;
  envelopeCount: number;
  overBudgetCount: number;
}

@Injectable()
export class EnvelopesService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  // ── CRUD ───────────────────────────────────────────────────────────

  async createEnvelope(
    userId: string,
    data: {
      name: string;
      budgetedAmount?: number;
      categoryId?: string;
      color?: string;
      icon?: string;
      rollover?: boolean;
      isGoal?: boolean;
      targetAmount?: number;
      period?: string;
    },
  ) {
    const [envelope] = await this.db
      .insert(envelopes)
      .values({
        userId,
        name: data.name,
        budgetedAmount: data.budgetedAmount ?? 0,
        categoryId: data.categoryId,
        color: data.color,
        icon: data.icon,
        rollover: data.rollover ?? false,
        isGoal: data.isGoal ?? false,
        targetAmount: data.targetAmount,
        period: data.period ?? 'monthly',
      })
      .returning();

    return envelope;
  }

  async updateEnvelope(
    userId: string,
    id: string,
    data: {
      name?: string;
      budgetedAmount?: number;
      categoryId?: string;
      color?: string;
      icon?: string;
      rollover?: boolean;
      isGoal?: boolean;
      targetAmount?: number;
      period?: string;
    },
  ) {
    await this.findEnvelopeById(userId, id);

    const [updated] = await this.db
      .update(envelopes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
      .returning();

    return updated;
  }

  async deleteEnvelope(userId: string, id: string) {
    await this.findEnvelopeById(userId, id);
    await this.db
      .delete(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)));
  }

  async findEnvelopeById(userId: string, id: string) {
    const [envelope] = await this.db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
      .limit(1);

    if (!envelope) throw new NotFoundException('Envelope not found');
    return envelope;
  }

  // ── List with balances ─────────────────────────────────────────────

  async getEnvelopes(userId: string): Promise<EnvelopeWithBalance[]> {
    const rows = await this.db
      .select({
        id: envelopes.id,
        name: envelopes.name,
        budgetedAmount: envelopes.budgetedAmount,
        spentAmount: envelopes.spentAmount,
        categoryId: envelopes.categoryId,
        color: envelopes.color,
        icon: envelopes.icon,
        rollover: envelopes.rollover,
        isGoal: envelopes.isGoal,
        targetAmount: envelopes.targetAmount,
        period: envelopes.period,
        periodStart: envelopes.periodStart,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
      })
      .from(envelopes)
      .leftJoin(
        schema.categories,
        eq(envelopes.categoryId, schema.categories.id),
      )
      .where(eq(envelopes.userId, userId))
      .orderBy(envelopes.name);

    return rows.map((row) => {
      const spent = row.spentAmount ?? 0;
      const budgeted = row.budgetedAmount ?? 0;
      const remaining = budgeted - spent;
      const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;

      // For goal envelopes, show how far toward the target we are
      let goalProgress: number | null = null;
      if (row.isGoal && row.targetAmount && row.targetAmount > 0) {
        goalProgress = (remaining / row.targetAmount) * 100;
      }

      return {
        id: row.id,
        name: row.name,
        budgetedAmount: budgeted,
        spentAmount: spent,
        remainingAmount: remaining,
        percentUsed,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        categoryColor: row.categoryColor,
        categoryIcon: row.categoryIcon,
        color: row.color,
        icon: row.icon,
        rollover: row.rollover,
        isGoal: row.isGoal,
        targetAmount: row.targetAmount,
        goalProgress,
        period: row.period,
        periodStart: row.periodStart,
      };
    });
  }

  // ── Allocate funds – "give every dollar a job" ─────────────────────

  async allocateFunds(
    userId: string,
    allocations: { envelopeId: string; amount: number }[],
  ) {
    const results = [];

    for (const alloc of allocations) {
      if (alloc.amount <= 0) {
        throw new BadRequestException(
          'Allocation amount must be greater than zero',
        );
      }

      const envelope = await this.findEnvelopeById(userId, alloc.envelopeId);

      // Record the allocation transaction
      await this.db.insert(envelopeTransactions).values({
        envelopeId: alloc.envelopeId,
        amount: alloc.amount,
        type: 'allocation',
        note: 'Funds allocated',
      });

      // Update the envelope budgeted amount
      const [updated] = await this.db
        .update(envelopes)
        .set({
          budgetedAmount: envelope.budgetedAmount + alloc.amount,
          updatedAt: new Date(),
        })
        .where(
          and(eq(envelopes.id, alloc.envelopeId), eq(envelopes.userId, userId)),
        )
        .returning();

      results.push(updated);
    }

    return results;
  }

  // ── Unallocated amount (income minus what's been allocated) ────────

  async getUnallocatedAmount(userId: string): Promise<number> {
    const totalIncome = await this.getTotalIncome(userId);
    const totalAllocated = await this.getTotalAllocated(userId);
    return totalIncome - totalAllocated;
  }

  // ── Transfer between envelopes ────────────────────────────────────

  async transferBetweenEnvelopes(
    userId: string,
    fromEnvelopeId: string,
    toEnvelopeId: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Transfer amount must be positive');
    }

    if (fromEnvelopeId === toEnvelopeId) {
      throw new BadRequestException('Cannot transfer to the same envelope');
    }

    const fromEnvelope = await this.findEnvelopeById(userId, fromEnvelopeId);
    const toEnvelope = await this.findEnvelopeById(userId, toEnvelopeId);

    const fromRemaining = fromEnvelope.budgetedAmount - fromEnvelope.spentAmount;
    if (fromRemaining < amount) {
      throw new BadRequestException(
        `Insufficient funds. Available: ${fromRemaining.toFixed(2)}`,
      );
    }

    // Record transfer-out
    await this.db.insert(envelopeTransactions).values({
      envelopeId: fromEnvelopeId,
      amount: -amount,
      type: 'transfer',
      note: `Transfer to ${toEnvelope.name}`,
    });

    // Record transfer-in
    await this.db.insert(envelopeTransactions).values({
      envelopeId: toEnvelopeId,
      amount,
      type: 'transfer',
      note: `Transfer from ${fromEnvelope.name}`,
    });

    // Update budgeted amounts
    await this.db
      .update(envelopes)
      .set({
        budgetedAmount: fromEnvelope.budgetedAmount - amount,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(envelopes.id, fromEnvelopeId),
          eq(envelopes.userId, userId),
        ),
      );

    await this.db
      .update(envelopes)
      .set({
        budgetedAmount: toEnvelope.budgetedAmount + amount,
        updatedAt: new Date(),
      })
      .where(
        and(eq(envelopes.id, toEnvelopeId), eq(envelopes.userId, userId)),
      );

    return { fromEnvelopeId, toEnvelopeId, amount };
  }

  // ── Rollover envelopes (carry unspent to next period) ──────────────

  async rolloverEnvelopes(userId: string) {
    const userEnvelopes = await this.db
      .select()
      .from(envelopes)
      .where(
        and(eq(envelopes.userId, userId), eq(envelopes.rollover, true)),
      );

    const results = [];

    for (const envelope of userEnvelopes) {
      const remaining = envelope.budgetedAmount - envelope.spentAmount;

      if (remaining === 0) continue;

      // Record rollover transaction
      await this.db.insert(envelopeTransactions).values({
        envelopeId: envelope.id,
        amount: remaining,
        type: 'allocation',
        note: `Rollover from previous period (${remaining >= 0 ? 'surplus' : 'deficit'})`,
      });

      // Reset for new period: carry remaining into new budgeted amount,
      // reset spent to zero
      const [updated] = await this.db
        .update(envelopes)
        .set({
          budgetedAmount: remaining > 0 ? remaining : 0,
          spentAmount: 0,
          periodStart: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(envelopes.id, envelope.id), eq(envelopes.userId, userId)),
        )
        .returning();

      results.push(updated);
    }

    // Also reset non-rollover envelopes
    await this.db
      .update(envelopes)
      .set({
        budgetedAmount: 0,
        spentAmount: 0,
        periodStart: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(envelopes.userId, userId), eq(envelopes.rollover, false)),
      );

    return results;
  }

  // ── Auto-assign transaction to envelope by category ────────────────

  async autoAssignTransaction(
    userId: string,
    transactionId: string,
    amount: number,
    categoryId: string | null,
  ) {
    if (!categoryId) return null;

    // Find an envelope that matches this category
    const [matchingEnvelope] = await this.db
      .select()
      .from(envelopes)
      .where(
        and(
          eq(envelopes.userId, userId),
          eq(envelopes.categoryId, categoryId),
        ),
      )
      .limit(1);

    if (!matchingEnvelope) return null;

    // Record the spend
    await this.db.insert(envelopeTransactions).values({
      envelopeId: matchingEnvelope.id,
      transactionId,
      amount: Math.abs(amount),
      type: 'spend',
    });

    // Update spent amount
    const [updated] = await this.db
      .update(envelopes)
      .set({
        spentAmount: matchingEnvelope.spentAmount + Math.abs(amount),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(envelopes.id, matchingEnvelope.id),
          eq(envelopes.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  // ── Summary – envelope overview with unallocated ──────────────────

  async getSummary(userId: string): Promise<EnvelopeSummary> {
    const envelopeList = await this.getEnvelopes(userId);
    const totalIncome = await this.getTotalIncome(userId);

    const totalAllocated = envelopeList.reduce(
      (sum, e) => sum + e.budgetedAmount,
      0,
    );
    const totalSpent = envelopeList.reduce((sum, e) => sum + e.spentAmount, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const overBudgetCount = envelopeList.filter(
      (e) => e.spentAmount > e.budgetedAmount,
    ).length;

    return {
      totalIncome,
      totalAllocated,
      unallocatedAmount: totalIncome - totalAllocated,
      totalSpent,
      totalRemaining,
      envelopeCount: envelopeList.length,
      overBudgetCount,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async getTotalIncome(userId: string): Promise<number> {
    const { start, end } = this.getCurrentMonthDates();

    const [result] = await this.db
      .select({
        total:
          sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} < 0 THEN ABS(${schema.transactions.amount}) ELSE 0 END), 0)`.as(
            'total',
          ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, start),
          lte(schema.transactions.date, end),
          eq(schema.transactions.pending, false),
        ),
      );

    return result?.total ?? 0;
  }

  private async getTotalAllocated(userId: string): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${envelopes.budgetedAmount}), 0)`.as(
          'total',
        ),
      })
      .from(envelopes)
      .where(eq(envelopes.userId, userId));

    return result?.total ?? 0;
  }

  private getCurrentMonthDates(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }
}
