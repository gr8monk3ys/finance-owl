import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and, gte, lte, sql, desc, inArray, isNull, or } from 'drizzle-orm';
import {
  DATABASE_TOKEN,
  type DrizzleDB,
} from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

// ── Constants ───────────────────────────────────────────────────────

const VALID_PERIODS = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'annual',
] as const;
type BudgetPeriod = (typeof VALID_PERIODS)[number];

const VALID_BUDGET_TYPES = ['category', 'overall'] as const;
type BudgetType = (typeof VALID_BUDGET_TYPES)[number];

const DEFAULT_ALERT_THRESHOLDS = [50, 75, 90, 100, 110];

// ── Interfaces ──────────────────────────────────────────────────────

export interface BudgetWithSpent {
  id: string;
  name: string | null;
  budgetType: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  householdId: string | null;
  amount: number;
  period: string;
  rollover: boolean;
  rolloverCap: number | null;
  isActive: boolean;
  alertThresholds: number[];
  spent: number;
  remaining: number;
  percentUsed: number;
  rolloverAmount: number;
  effectiveBudget: number;
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
  projectedSpend: number;
  onTrack: boolean;
}

export interface BudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  percentUsed: number;
  budgetCount: number;
  overBudgetCount: number;
  onTrackCount: number;
  projectedTotalSpend: number;
  projectedSurplusOrDeficit: number;
}

export interface BudgetAlert {
  budgetId: string;
  budgetName: string;
  thresholdPercent: number;
  actualPercent: number;
  spent: number;
  budgetAmount: number;
  severity: 'info' | 'warning' | 'danger' | 'critical';
}

export interface CreateBudgetInput {
  categoryId?: string;
  householdId?: string;
  name?: string;
  budgetType?: string;
  amount: number;
  period: string;
  rollover?: boolean;
  rolloverCap?: number;
  alertThresholds?: number[];
  startDate?: string;
}

export interface UpdateBudgetInput {
  name?: string;
  amount?: number;
  period?: string;
  rollover?: boolean;
  rolloverCap?: number;
  isActive?: boolean;
  alertThresholds?: number[];
}

// ── Service ─────────────────────────────────────────────────────────

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Invalidate budget-related caches for a user after mutations.
   */
  private async invalidateBudgetCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.delPattern(`budgets:${userId}:*`),
      this.cacheService.delPattern(`analytics:${userId}:*`),
    ]);
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  async create(userId: string, data: CreateBudgetInput) {
    const normalizedPeriod = this.validatePeriod(data.period);
    this.validateAmount(data.amount);

    const budgetType = (data.budgetType as BudgetType) || 'category';
    if (!(VALID_BUDGET_TYPES as readonly string[]).includes(budgetType)) {
      throw new BadRequestException(
        `Invalid budget type. Must be one of: ${VALID_BUDGET_TYPES.join(', ')}`,
      );
    }

    if (budgetType === 'category' && !data.categoryId) {
      throw new BadRequestException(
        'categoryId is required for category-type budgets',
      );
    }

    // Prevent duplicate category budgets for the same period
    if (budgetType === 'category' && data.categoryId) {
      const existing = await this.db
        .select({ id: schema.budgets.id })
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.userId, userId),
            eq(schema.budgets.categoryId, data.categoryId),
            eq(schema.budgets.period, normalizedPeriod),
            eq(schema.budgets.isActive, true),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictException(
          'A budget already exists for this category and period. Update the existing budget instead.',
        );
      }
    }

    const thresholds = data.alertThresholds ?? DEFAULT_ALERT_THRESHOLDS;

    const [budget] = await this.db
      .insert(schema.budgets)
      .values({
        userId,
        categoryId: budgetType === 'category' ? data.categoryId : null,
        householdId: data.householdId ?? null,
        name: data.name ?? null,
        budgetType,
        amount: data.amount,
        period: normalizedPeriod,
        rollover: data.rollover ?? false,
        rolloverCap: data.rolloverCap ?? null,
        isActive: true,
        alertThresholds: JSON.stringify(thresholds),
        startDate: data.startDate ?? null,
      })
      .returning();

    await this.invalidateBudgetCaches(userId);
    return budget;
  }

  async findById(userId: string, id: string) {
    const [budget] = await this.db
      .select()
      .from(schema.budgets)
      .where(
        and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)),
      )
      .limit(1);

    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async update(userId: string, id: string, data: UpdateBudgetInput) {
    await this.findById(userId, id);

    const normalizedPeriod = data.period
      ? this.validatePeriod(data.period)
      : undefined;
    if (data.amount !== undefined) this.validateAmount(data.amount);

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.amount !== undefined) updatePayload.amount = data.amount;
    if (normalizedPeriod !== undefined) updatePayload.period = normalizedPeriod;
    if (data.rollover !== undefined) updatePayload.rollover = data.rollover;
    if (data.rolloverCap !== undefined)
      updatePayload.rolloverCap = data.rolloverCap;
    if (data.isActive !== undefined) updatePayload.isActive = data.isActive;
    if (data.alertThresholds !== undefined)
      updatePayload.alertThresholds = JSON.stringify(data.alertThresholds);

    const [updated] = await this.db
      .update(schema.budgets)
      .set(updatePayload)
      .where(
        and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)),
      )
      .returning();

    await this.invalidateBudgetCaches(userId);
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findById(userId, id);
    await this.db
      .delete(schema.budgets)
      .where(
        and(eq(schema.budgets.id, id), eq(schema.budgets.userId, userId)),
      );
    await this.invalidateBudgetCaches(userId);
  }

  // ── List with real-time spent computation ─────────────────────────

  async findAll(
    userId: string,
    options?: { includeInactive?: boolean; householdId?: string },
  ): Promise<BudgetWithSpent[]> {
    const conditions = [eq(schema.budgets.userId, userId)];
    if (!options?.includeInactive) {
      conditions.push(eq(schema.budgets.isActive, true));
    }
    if (options?.householdId) {
      conditions.push(
        eq(schema.budgets.householdId, options.householdId),
      );
    }

    const budgets = await this.db
      .select({
        id: schema.budgets.id,
        name: schema.budgets.name,
        budgetType: schema.budgets.budgetType,
        categoryId: schema.budgets.categoryId,
        householdId: schema.budgets.householdId,
        amount: schema.budgets.amount,
        period: schema.budgets.period,
        rollover: schema.budgets.rollover,
        rolloverCap: schema.budgets.rolloverCap,
        isActive: schema.budgets.isActive,
        alertThresholds: schema.budgets.alertThresholds,
        startDate: schema.budgets.startDate,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
      })
      .from(schema.budgets)
      .leftJoin(
        schema.categories,
        eq(schema.budgets.categoryId, schema.categories.id),
      )
      .where(and(...conditions))
      .orderBy(schema.categories.sortOrder);

    const now = new Date();
    const results: BudgetWithSpent[] = [];

    for (const budget of budgets) {
      const normalizedPeriod = this.normalizePeriod(budget.period);
      const { start, end } = this.getPeriodDates(
        normalizedPeriod,
        now,
        budget.startDate ?? undefined,
      );

      let spent: number;
      if (budget.budgetType === 'overall') {
        spent = await this.getTotalSpent(userId, start, end);
      } else {
        spent = await this.getSpentForCategory(
          userId,
          budget.categoryId!,
          start,
          end,
        );
      }

      const rolloverAmount = budget.rollover
        ? await this.getRolloverAmount(budget.id, start)
        : 0;

      const effectiveBudget = budget.amount + rolloverAmount;
      const remaining = effectiveBudget - spent;
      const percentUsed =
        effectiveBudget > 0 ? (spent / effectiveBudget) * 100 : 0;

      // Calculate days remaining and projection
      const startDate = new Date(start);
      const endDate = new Date(end);
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const totalDays = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );
      const daysElapsed = Math.max(
        1,
        Math.ceil(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      const dailyRate = spent / daysElapsed;
      const projectedSpend = dailyRate * totalDays;
      const onTrack = projectedSpend <= effectiveBudget;

      let thresholds: number[];
      try {
        thresholds = budget.alertThresholds
          ? JSON.parse(budget.alertThresholds)
          : DEFAULT_ALERT_THRESHOLDS;
      } catch {
        thresholds = DEFAULT_ALERT_THRESHOLDS;
      }

      results.push({
        id: budget.id,
        name:
          budget.name ??
          (budget.budgetType === 'overall'
            ? 'Overall Spending'
            : budget.categoryName),
        budgetType: budget.budgetType,
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        categoryColor: budget.categoryColor,
        categoryIcon: budget.categoryIcon,
        householdId: budget.householdId,
        amount: budget.amount,
        period: normalizedPeriod,
        rollover: budget.rollover,
        rolloverCap: budget.rolloverCap,
        isActive: budget.isActive,
        alertThresholds: thresholds,
        spent,
        remaining,
        percentUsed: Math.round(percentUsed * 100) / 100,
        rolloverAmount,
        effectiveBudget,
        periodStart: start,
        periodEnd: end,
        daysRemaining,
        projectedSpend: Math.round(projectedSpend * 100) / 100,
        onTrack,
      });
    }

    return results;
  }

  // ── Summary ───────────────────────────────────────────────────────

  async getSummary(userId: string): Promise<BudgetSummary> {
    const budgets = await this.findAll(userId);

    const totalBudgeted = budgets.reduce((s, b) => s + b.effectiveBudget, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const overBudgetCount = budgets.filter((b) => b.spent > b.effectiveBudget).length;
    const onTrackCount = budgets.filter((b) => b.onTrack).length;
    const projectedTotalSpend = budgets.reduce(
      (s, b) => s + b.projectedSpend,
      0,
    );

    return {
      totalBudgeted,
      totalSpent,
      totalRemaining,
      percentUsed:
        totalBudgeted > 0
          ? Math.round((totalSpent / totalBudgeted) * 10000) / 100
          : 0,
      budgetCount: budgets.length,
      overBudgetCount,
      onTrackCount,
      projectedTotalSpend: Math.round(projectedTotalSpend * 100) / 100,
      projectedSurplusOrDeficit:
        Math.round((totalBudgeted - projectedTotalSpend) * 100) / 100,
    };
  }

  // ── Progressive Alerts ────────────────────────────────────────────

  async getActiveAlerts(userId: string): Promise<BudgetAlert[]> {
    const budgets = await this.findAll(userId);
    const alerts: BudgetAlert[] = [];

    for (const budget of budgets) {
      const thresholds = budget.alertThresholds;
      for (const threshold of thresholds) {
        if (budget.percentUsed >= threshold) {
          // Check if this alert was already sent for this period
          const existing = await this.db
            .select({ id: schema.budgetAlerts.id })
            .from(schema.budgetAlerts)
            .where(
              and(
                eq(schema.budgetAlerts.budgetId, budget.id),
                eq(schema.budgetAlerts.thresholdPercent, threshold),
                eq(schema.budgetAlerts.periodStart, budget.periodStart),
              ),
            )
            .limit(1);

          if (existing.length === 0) {
            // Record the alert
            await this.db.insert(schema.budgetAlerts).values({
              budgetId: budget.id,
              userId,
              thresholdPercent: threshold,
              actualPercent: budget.percentUsed,
              periodStart: budget.periodStart,
            });

            alerts.push({
              budgetId: budget.id,
              budgetName:
                budget.name || budget.categoryName || 'Overall Spending',
              thresholdPercent: threshold,
              actualPercent: budget.percentUsed,
              spent: budget.spent,
              budgetAmount: budget.effectiveBudget,
              severity: this.getAlertSeverity(threshold),
            });
          }
        }
      }
    }

    return alerts;
  }

  // ── Rollover Processing ───────────────────────────────────────────

  async processRollovers(userId: string) {
    const budgets = await this.db
      .select()
      .from(schema.budgets)
      .where(
        and(
          eq(schema.budgets.userId, userId),
          eq(schema.budgets.rollover, true),
          eq(schema.budgets.isActive, true),
        ),
      );

    const results = [];
    const now = new Date();

    for (const budget of budgets) {
      const normalizedPeriod = this.normalizePeriod(budget.period);
      const { start: prevStart, end: prevEnd } =
        this.getPreviousPeriodDates(normalizedPeriod, now);
      const { start: currStart, end: currEnd } = this.getPeriodDates(
        normalizedPeriod,
        now,
      );

      let spent: number;
      if (budget.budgetType === 'overall') {
        spent = await this.getTotalSpent(userId, prevStart, prevEnd);
      } else if (budget.categoryId) {
        spent = await this.getSpentForCategory(
          userId,
          budget.categoryId,
          prevStart,
          prevEnd,
        );
      } else {
        continue;
      }

      let rollover = budget.amount - spent;

      // Apply cap if set
      if (budget.rolloverCap !== null && rollover > budget.rolloverCap) {
        rollover = budget.rolloverCap;
      }

      // Prevent negative rollover from exceeding budget amount
      if (rollover < -budget.amount) {
        rollover = -budget.amount;
      }

      // Upsert budget period record
      const existing = await this.db
        .select({ id: schema.budgetPeriods.id })
        .from(schema.budgetPeriods)
        .where(
          and(
            eq(schema.budgetPeriods.budgetId, budget.id),
            eq(schema.budgetPeriods.startDate, currStart),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(schema.budgetPeriods)
          .set({
            rolloverAmount: rollover,
            spentAmount: spent,
          })
          .where(eq(schema.budgetPeriods.id, existing[0].id));
      } else {
        await this.db.insert(schema.budgetPeriods).values({
          budgetId: budget.id,
          startDate: currStart,
          endDate: currEnd,
          budgetedAmount: budget.amount,
          rolloverAmount: rollover,
          spentAmount: 0,
        });
      }

      results.push({
        budgetId: budget.id,
        previousPeriodSpent: spent,
        rolloverAmount: rollover,
        newEffectiveBudget: budget.amount + rollover,
      });
    }

    return results;
  }

  // ── Household budgets ─────────────────────────────────────────────

  async findHouseholdBudgets(
    householdId: string,
  ): Promise<BudgetWithSpent[]> {
    // Get all members of the household
    const members = await this.db
      .select({ userId: schema.householdMembers.userId })
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.householdId, householdId));

    if (members.length === 0) return [];

    const memberIds = members.map((m) => m.userId);

    // Get budgets shared with this household
    const budgets = await this.db
      .select({
        id: schema.budgets.id,
        name: schema.budgets.name,
        budgetType: schema.budgets.budgetType,
        categoryId: schema.budgets.categoryId,
        householdId: schema.budgets.householdId,
        amount: schema.budgets.amount,
        period: schema.budgets.period,
        rollover: schema.budgets.rollover,
        rolloverCap: schema.budgets.rolloverCap,
        isActive: schema.budgets.isActive,
        alertThresholds: schema.budgets.alertThresholds,
        startDate: schema.budgets.startDate,
        userId: schema.budgets.userId,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
      })
      .from(schema.budgets)
      .leftJoin(
        schema.categories,
        eq(schema.budgets.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.budgets.householdId, householdId),
          eq(schema.budgets.isActive, true),
        ),
      )
      .orderBy(schema.categories.sortOrder);

    const now = new Date();
    const results: BudgetWithSpent[] = [];

    for (const budget of budgets) {
      const normalizedPeriod = this.normalizePeriod(budget.period);
      const { start, end } = this.getPeriodDates(
        normalizedPeriod,
        now,
        budget.startDate ?? undefined,
      );

      // Aggregate spending from all household members
      let totalSpent = 0;
      for (const memberId of memberIds) {
        if (budget.budgetType === 'overall') {
          totalSpent += await this.getTotalSpent(memberId, start, end);
        } else if (budget.categoryId) {
          totalSpent += await this.getSpentForCategory(
            memberId,
            budget.categoryId,
            start,
            end,
          );
        }
      }

      const rolloverAmount = budget.rollover
        ? await this.getRolloverAmount(budget.id, start)
        : 0;

      const effectiveBudget = budget.amount + rolloverAmount;
      const remaining = effectiveBudget - totalSpent;
      const percentUsed =
        effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : 0;

      const startDate = new Date(start);
      const endDate = new Date(end);
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const totalDays = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );
      const daysElapsed = Math.max(
        1,
        Math.ceil(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1,
      );
      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      const projectedSpend = (totalSpent / daysElapsed) * totalDays;

      let thresholds: number[];
      try {
        thresholds = budget.alertThresholds
          ? JSON.parse(budget.alertThresholds)
          : DEFAULT_ALERT_THRESHOLDS;
      } catch {
        thresholds = DEFAULT_ALERT_THRESHOLDS;
      }

      results.push({
        id: budget.id,
        name: budget.name ?? budget.categoryName,
        budgetType: budget.budgetType,
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        categoryColor: budget.categoryColor,
        categoryIcon: budget.categoryIcon,
        householdId: budget.householdId,
        amount: budget.amount,
        period: normalizedPeriod,
        rollover: budget.rollover,
        rolloverCap: budget.rolloverCap,
        isActive: budget.isActive,
        alertThresholds: thresholds,
        spent: totalSpent,
        remaining,
        percentUsed: Math.round(percentUsed * 100) / 100,
        rolloverAmount,
        effectiveBudget,
        periodStart: start,
        periodEnd: end,
        daysRemaining,
        projectedSpend: Math.round(projectedSpend * 100) / 100,
        onTrack: projectedSpend <= effectiveBudget,
      });
    }

    return results;
  }

  // ── Forecast: predict end-of-period spending ──────────────────────

  async forecastEndOfPeriod(
    userId: string,
  ): Promise<
    Array<{
      budgetId: string;
      budgetName: string;
      currentSpent: number;
      budgetAmount: number;
      projectedSpend: number;
      projectedSurplus: number;
      daysRemaining: number;
      dailyAllowance: number;
      status: 'on_track' | 'at_risk' | 'over_budget';
    }>
  > {
    const budgets = await this.findAll(userId);

    return budgets.map((b) => {
      const dailyAllowance =
        b.daysRemaining > 0 ? b.remaining / b.daysRemaining : 0;

      let status: 'on_track' | 'at_risk' | 'over_budget';
      if (b.percentUsed >= 100) {
        status = 'over_budget';
      } else if (b.projectedSpend > b.effectiveBudget) {
        status = 'at_risk';
      } else {
        status = 'on_track';
      }

      return {
        budgetId: b.id,
        budgetName: b.name || b.categoryName || 'Overall',
        currentSpent: b.spent,
        budgetAmount: b.effectiveBudget,
        projectedSpend: b.projectedSpend,
        projectedSurplus:
          Math.round((b.effectiveBudget - b.projectedSpend) * 100) / 100,
        daysRemaining: b.daysRemaining,
        dailyAllowance: Math.round(Math.max(0, dailyAllowance) * 100) / 100,
        status,
      };
    });
  }

  // ── Private: Spending queries ─────────────────────────────────────

  async getSpentForCategory(
    userId: string,
    categoryId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    // Include child categories in the count
    const childCategories = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.parentId, categoryId));

    const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];

    const [result] = await this.db
      .select({
        total:
          sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END), 0)`.as(
            'total',
          ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.categoryId} IN (${sql.join(
            categoryIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      );

    return Number(result?.total) || 0;
  }

  private async getTotalSpent(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const [result] = await this.db
      .select({
        total:
          sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.amount} > 0 THEN ${schema.transactions.amount} ELSE 0 END), 0)`.as(
            'total',
          ),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          eq(schema.transactions.pending, false),
        ),
      );

    return Number(result?.total) || 0;
  }

  private async getRolloverAmount(
    budgetId: string,
    currentPeriodStart: string,
  ): Promise<number> {
    const [period] = await this.db
      .select({ rolloverAmount: schema.budgetPeriods.rolloverAmount })
      .from(schema.budgetPeriods)
      .where(
        and(
          eq(schema.budgetPeriods.budgetId, budgetId),
          sql`${schema.budgetPeriods.startDate} < ${currentPeriodStart}`,
        ),
      )
      .orderBy(desc(schema.budgetPeriods.startDate))
      .limit(1);

    return Number(period?.rolloverAmount) || 0;
  }

  // ── Private: Period date calculations ─────────────────────────────

  getPeriodDates(
    period: string,
    now: Date = new Date(),
    customStart?: string,
  ): { start: string; end: string } {
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    switch (period) {
      case 'weekly': {
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const start = new Date(now);
        start.setDate(now.getDate() + mondayOffset);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'biweekly': {
        // Use a reference epoch (Jan 1 2024 was a Monday) to determine which biweekly period
        const epoch = new Date(2024, 0, 1);
        const daysSinceEpoch = Math.floor(
          (now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24),
        );
        const biweekNum = Math.floor(daysSinceEpoch / 14);
        const start = new Date(epoch);
        start.setDate(epoch.getDate() + biweekNum * 14);
        const end = new Date(start);
        end.setDate(start.getDate() + 13);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'monthly': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), quarter * 3, 1);
        const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'annual': {
        return {
          start: `${now.getFullYear()}-01-01`,
          end: `${now.getFullYear()}-12-31`,
        };
      }
      default:
        return this.getPeriodDates('monthly', now);
    }
  }

  getPreviousPeriodDates(
    period: string,
    now: Date = new Date(),
  ): { start: string; end: string } {
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    switch (period) {
      case 'weekly': {
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() + mondayOffset);
        const prevMonday = new Date(thisMonday);
        prevMonday.setDate(thisMonday.getDate() - 7);
        const prevSunday = new Date(prevMonday);
        prevSunday.setDate(prevMonday.getDate() + 6);
        return { start: fmt(prevMonday), end: fmt(prevSunday) };
      }
      case 'biweekly': {
        const epoch = new Date(2024, 0, 1);
        const daysSinceEpoch = Math.floor(
          (now.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24),
        );
        const biweekNum = Math.floor(daysSinceEpoch / 14) - 1;
        const start = new Date(epoch);
        start.setDate(epoch.getDate() + biweekNum * 14);
        const end = new Date(start);
        end.setDate(start.getDate() + 13);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'monthly': {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: fmt(prevMonth), end: fmt(end) };
      }
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3) - 1;
        const year =
          quarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const q = quarter < 0 ? 3 : quarter;
        const start = new Date(year, q * 3, 1);
        const end = new Date(year, q * 3 + 3, 0);
        return { start: fmt(start), end: fmt(end) };
      }
      case 'annual': {
        const prevYear = now.getFullYear() - 1;
        return {
          start: `${prevYear}-01-01`,
          end: `${prevYear}-12-31`,
        };
      }
      default:
        return this.getPreviousPeriodDates('monthly', now);
    }
  }

  // ── Private: Validation ───────────────────────────────────────────

  private validatePeriod(period: string) {
    const normalizedPeriod = this.normalizePeriod(period);

    if (!VALID_PERIODS.includes(normalizedPeriod)) {
      throw new BadRequestException(
        `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      );
    }

    return normalizedPeriod;
  }

  private normalizePeriod(period: string): BudgetPeriod {
    if (period === 'yearly') {
      return 'annual';
    }

    return period as BudgetPeriod;
  }

  private validateAmount(amount: number) {
    if (typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestException('Budget amount must be a positive number');
    }
    if (amount > 999999999) {
      throw new BadRequestException('Budget amount exceeds maximum limit');
    }
  }

  private getAlertSeverity(
    threshold: number,
  ): 'info' | 'warning' | 'danger' | 'critical' {
    if (threshold <= 50) return 'info';
    if (threshold <= 75) return 'warning';
    if (threshold <= 100) return 'danger';
    return 'critical';
  }
}
