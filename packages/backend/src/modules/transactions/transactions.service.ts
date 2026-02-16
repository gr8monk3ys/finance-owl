import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, like, desc, sql, count } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import { CategorizationService } from '../ai/categorization.service';
import * as schema from '../../database/schema';

interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  pending?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private categorizationService: CategorizationService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Invalidate all analytics-related caches for a user after transaction mutations.
   */
  private async invalidateUserCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.delPattern(`analytics:${userId}:*`),
      this.cacheService.delPattern(`financial-health:${userId}:*`),
    ]);
  }

  async findAll(userId: string, filters: TransactionFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(schema.transactions.userId, userId),
    ];

    if (filters.accountId) {
      conditions.push(eq(schema.transactions.accountId, filters.accountId));
    }
    if (filters.categoryId) {
      conditions.push(eq(schema.transactions.categoryId, filters.categoryId));
    }
    if (filters.startDate) {
      conditions.push(gte(schema.transactions.date, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.transactions.date, filters.endDate));
    }
    if (filters.minAmount !== undefined) {
      conditions.push(gte(schema.transactions.amount, filters.minAmount));
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(lte(schema.transactions.amount, filters.maxAmount));
    }
    if (filters.pending !== undefined) {
      conditions.push(eq(schema.transactions.pending, filters.pending));
    }

    const whereClause = and(...conditions);

    // Handle FTS search
    if (filters.search) {
      // Use SQLite LIKE as fallback (FTS5 requires virtual table setup via migration)
      const searchPattern = `%${filters.search}%`;
      const searchCondition = sql`(${schema.transactions.name} LIKE ${searchPattern} OR ${schema.transactions.merchantName} LIKE ${searchPattern} OR ${schema.transactions.description} LIKE ${searchPattern})`;

      const [totalResult] = await this.db
        .select({ total: count() })
        .from(schema.transactions)
        .where(and(whereClause!, searchCondition));

      const data = await this.db
        .select({
          id: schema.transactions.id,
          accountId: schema.transactions.accountId,
          categoryId: schema.transactions.categoryId,
          plaidTransactionId: schema.transactions.plaidTransactionId,
          amount: schema.transactions.amount,
          name: schema.transactions.name,
          merchantName: schema.transactions.merchantName,
          description: schema.transactions.description,
          date: schema.transactions.date,
          authorizedDate: schema.transactions.authorizedDate,
          pending: schema.transactions.pending,
          notes: schema.transactions.notes,
          categorizationSource: schema.transactions.categorizationSource,
          isManual: schema.transactions.isManual,
          createdAt: schema.transactions.createdAt,
          updatedAt: schema.transactions.updatedAt,
          accountName: schema.accounts.name,
          accountType: schema.accounts.type,
          categoryName: schema.categories.name,
          categoryColor: schema.categories.color,
          categoryIcon: schema.categories.icon,
        })
        .from(schema.transactions)
        .leftJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
        .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
        .where(and(whereClause!, searchCondition))
        .orderBy(desc(schema.transactions.date), desc(schema.transactions.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data,
        meta: {
          page,
          limit,
          total: totalResult.total,
          totalPages: Math.ceil(totalResult.total / limit),
        },
      };
    }

    // No search — standard query
    const [totalResult] = await this.db
      .select({ total: count() })
      .from(schema.transactions)
      .where(whereClause);

    const data = await this.db
      .select({
        id: schema.transactions.id,
        accountId: schema.transactions.accountId,
        categoryId: schema.transactions.categoryId,
        plaidTransactionId: schema.transactions.plaidTransactionId,
        amount: schema.transactions.amount,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        description: schema.transactions.description,
        date: schema.transactions.date,
        authorizedDate: schema.transactions.authorizedDate,
        pending: schema.transactions.pending,
        notes: schema.transactions.notes,
        categorizationSource: schema.transactions.categorizationSource,
        isManual: schema.transactions.isManual,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        accountName: schema.accounts.name,
        accountType: schema.accounts.type,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
      })
      .from(schema.transactions)
      .leftJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(whereClause)
      .orderBy(desc(schema.transactions.date), desc(schema.transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: {
        page,
        limit,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limit),
      },
    };
  }

  async findById(userId: string, id: string) {
    const [transaction] = await this.db
      .select({
        id: schema.transactions.id,
        accountId: schema.transactions.accountId,
        categoryId: schema.transactions.categoryId,
        plaidTransactionId: schema.transactions.plaidTransactionId,
        amount: schema.transactions.amount,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        description: schema.transactions.description,
        date: schema.transactions.date,
        authorizedDate: schema.transactions.authorizedDate,
        pending: schema.transactions.pending,
        notes: schema.transactions.notes,
        categorizationSource: schema.transactions.categorizationSource,
        isManual: schema.transactions.isManual,
        createdAt: schema.transactions.createdAt,
        updatedAt: schema.transactions.updatedAt,
        accountName: schema.accounts.name,
        accountType: schema.accounts.type,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
      })
      .from(schema.transactions)
      .leftJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, userId),
        ),
      )
      .limit(1);

    if (!transaction) throw new NotFoundException('Transaction not found');
    return transaction;
  }

  async createManual(userId: string, data: {
    accountId: string;
    amount: number;
    name: string;
    merchantName?: string;
    description?: string;
    categoryId?: string;
    date: string;
    pending?: boolean;
    notes?: string;
  }) {
    const [transaction] = await this.db
      .insert(schema.transactions)
      .values({
        userId,
        accountId: data.accountId,
        amount: data.amount,
        name: data.name,
        merchantName: data.merchantName,
        description: data.description,
        categoryId: data.categoryId,
        date: data.date,
        pending: data.pending ?? false,
        notes: data.notes,
        categorizationSource: data.categoryId ? 'manual' : null,
        isManual: true,
      })
      .returning();

    // If no category was specified, try auto-categorization
    if (!data.categoryId) {
      const result = await this.categorizationService.categorize(userId, {
        id: transaction.id,
        name: data.name,
        merchantName: data.merchantName ?? null,
        description: data.description ?? null,
        amount: data.amount,
      });

      if (result.categoryId) {
        await this.db
          .update(schema.transactions)
          .set({
            categoryId: result.categoryId,
            categorizationSource: result.source,
          })
          .where(eq(schema.transactions.id, transaction.id));

        await this.invalidateUserCaches(userId);
        return { ...transaction, categoryId: result.categoryId, categorizationSource: result.source };
      }
    }

    await this.invalidateUserCaches(userId);
    return transaction;
  }

  async update(userId: string, id: string, data: {
    categoryId?: string;
    notes?: string;
    name?: string;
  }) {
    // Get existing transaction for correction tracking
    const existing = await this.findById(userId, id);

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.categoryId !== undefined) {
      // Track category correction if changing from a previous category
      if (existing.categoryId && data.categoryId !== existing.categoryId) {
        await this.db.insert(schema.categorizationCorrections).values({
          userId,
          merchantName: existing.merchantName,
          description: existing.name,
          fromCategoryId: existing.categoryId,
          toCategoryId: data.categoryId,
        });
      }

      updateData.categoryId = data.categoryId;
      updateData.categorizationSource = 'user';
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    const [updated] = await this.db
      .update(schema.transactions)
      .set(updateData)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, userId),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundException('Transaction not found');
    await this.invalidateUserCaches(userId);
    return updated;
  }

  async remove(userId: string, id: string) {
    // Only allow deleting manual transactions
    const tx = await this.findById(userId, id);
    if (!tx.isManual) {
      throw new NotFoundException('Can only delete manual transactions');
    }

    await this.db
      .delete(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, userId),
        ),
      );

    await this.invalidateUserCaches(userId);
  }
}
