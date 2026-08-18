import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, inArray, isNull, or } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface SplitInput {
  categoryId?: string;
  amount: number;
  note?: string;
  householdMemberId?: string;
}

export interface Split {
  id: string;
  transactionId: string;
  categoryId: string | null;
  amount: number;
  note: string | null;
  householdMemberId: string | null;
  createdAt: Date;
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
}

@Injectable()
export class TransactionSplitService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Split a transaction across multiple categories
   */
  async splitTransaction(
    userId: string,
    transactionId: string,
    splits: SplitInput[],
  ): Promise<Split[]> {
    // Verify the transaction belongs to the user
    const transaction = await this.getTransaction(userId, transactionId);

    // Validate splits sum to the original transaction amount
    this.validateSplitAmounts(transaction.amount, splits);

    // Client-supplied FK references must be usable by this user
    await this.assertSplitReferencesUsable(userId, splits);

    // Remove any existing splits
    await this.db
      .delete(schema.transactionSplits)
      .where(eq(schema.transactionSplits.transactionId, transactionId));

    // Insert new splits
    const insertedSplits = await this.db
      .insert(schema.transactionSplits)
      .values(
        splits.map((split) => ({
          transactionId,
          categoryId: split.categoryId ?? null,
          amount: split.amount,
          note: split.note ?? null,
          householdMemberId: split.householdMemberId ?? null,
        })),
      )
      .returning();

    // Return splits with category info
    return this.getSplitsWithCategories(transactionId);
  }

  /**
   * Verify every referenced categoryId belongs to the user (or is a system
   * default) and every householdMemberId is in a household the user is a
   * member of. Prevents cross-tenant references in split rows.
   */
  private async assertSplitReferencesUsable(
    userId: string,
    splits: SplitInput[],
  ): Promise<void> {
    const categoryIds = [
      ...new Set(splits.map((s) => s.categoryId).filter((v): v is string => !!v)),
    ];
    if (categoryIds.length > 0) {
      const found = await this.db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(
          and(
            inArray(schema.categories.id, categoryIds),
            or(
              eq(schema.categories.userId, userId),
              isNull(schema.categories.userId),
            ),
          ),
        );
      if (found.length !== categoryIds.length) {
        throw new BadRequestException('Category not found');
      }
    }

    const memberIds = [
      ...new Set(
        splits.map((s) => s.householdMemberId).filter((v): v is string => !!v),
      ),
    ];
    if (memberIds.length > 0) {
      const myHouseholds = this.db
        .select({ householdId: schema.householdMembers.householdId })
        .from(schema.householdMembers)
        .where(eq(schema.householdMembers.userId, userId));
      const found = await this.db
        .select({ id: schema.householdMembers.id })
        .from(schema.householdMembers)
        .where(
          and(
            inArray(schema.householdMembers.id, memberIds),
            inArray(schema.householdMembers.householdId, myHouseholds),
          ),
        );
      if (found.length !== memberIds.length) {
        throw new BadRequestException('Household member not found');
      }
    }
  }

  /**
   * Get splits for a transaction
   */
  async getSplits(userId: string, transactionId: string): Promise<Split[]> {
    // Verify the transaction belongs to the requesting user
    await this.getTransaction(userId, transactionId);

    return this.getSplitsWithCategories(transactionId);
  }

  /**
   * Update splits for a transaction
   */
  async updateSplits(
    userId: string,
    transactionId: string,
    splits: SplitInput[],
  ): Promise<Split[]> {
    // Same logic as split - replace all splits
    return this.splitTransaction(userId, transactionId, splits);
  }

  /**
   * Remove all splits (revert to single category)
   */
  async removeSplits(userId: string, transactionId: string): Promise<void> {
    // Verify the transaction belongs to the user
    await this.getTransaction(userId, transactionId);

    await this.db
      .delete(schema.transactionSplits)
      .where(eq(schema.transactionSplits.transactionId, transactionId));
  }

  /**
   * Get splits with joined category information
   */
  private async getSplitsWithCategories(
    transactionId: string,
  ): Promise<Split[]> {
    const results = await this.db
      .select({
        id: schema.transactionSplits.id,
        transactionId: schema.transactionSplits.transactionId,
        categoryId: schema.transactionSplits.categoryId,
        amount: schema.transactionSplits.amount,
        note: schema.transactionSplits.note,
        householdMemberId: schema.transactionSplits.householdMemberId,
        createdAt: schema.transactionSplits.createdAt,
        categoryName: schema.categories.name,
        categoryColor: schema.categories.color,
        categoryIcon: schema.categories.icon,
      })
      .from(schema.transactionSplits)
      .leftJoin(
        schema.categories,
        eq(schema.transactionSplits.categoryId, schema.categories.id),
      )
      .where(eq(schema.transactionSplits.transactionId, transactionId));

    return results;
  }

  /**
   * Get and verify a transaction belongs to the user
   */
  private async getTransaction(userId: string, transactionId: string) {
    const [transaction] = await this.db
      .select({
        id: schema.transactions.id,
        amount: schema.transactions.amount,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, transactionId),
          eq(schema.transactions.userId, userId),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }

  /**
   * Validate that split amounts sum to the original transaction amount
   */
  private validateSplitAmounts(
    originalAmount: number,
    splits: SplitInput[],
  ): void {
    if (splits.length < 2) {
      throw new BadRequestException(
        'At least 2 splits are required',
      );
    }

    const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
    const tolerance = 0.01; // Allow for floating point rounding

    if (Math.abs(Math.abs(splitTotal) - Math.abs(originalAmount)) > tolerance) {
      throw new BadRequestException(
        `Split amounts must sum to the transaction amount. ` +
          `Expected ${Math.abs(originalAmount).toFixed(2)}, got ${Math.abs(splitTotal).toFixed(2)}`,
      );
    }

    // Validate each split has a positive amount
    for (const split of splits) {
      if (split.amount === 0) {
        throw new BadRequestException('Split amount cannot be zero');
      }
    }
  }
}
