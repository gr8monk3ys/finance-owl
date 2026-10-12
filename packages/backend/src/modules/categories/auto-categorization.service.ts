import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, or } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { CategorizationEngineService } from './categorization.service';

export interface AutoCategorizeInput {
  userId: string;
  description: string;
  merchantName?: string | null;
  mcc?: string | null;
}

export interface AutoCategorizeResult {
  categoryId: string | null;
  source: string | null;
}

/**
 * Bridges the rule-based CategorizationEngineService (pure name matching)
 * to real category rows: it turns the engine's `category` / `subcategory`
 * name pair into a `categoryId` the transaction can actually reference.
 */
@Injectable()
export class AutoCategorizationService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly engine: CategorizationEngineService,
  ) {}

  async categorize(input: AutoCategorizeInput): Promise<AutoCategorizeResult> {
    const result = this.engine.categorizeTransaction(
      input.description,
      input.merchantName,
      input.mcc,
      input.userId,
    );

    if (result.source === 'uncategorized') {
      return { categoryId: null, source: null };
    }

    const categoryId = await this.resolveCategoryId(
      input.userId,
      result.category,
      result.subcategory,
    );

    if (!categoryId) {
      return { categoryId: null, source: null };
    }

    return { categoryId, source: 'rule' };
  }

  /**
   * Finds the category row matching the engine's category/subcategory
   * name pair. Prefers the subcategory (child) row and falls back to the
   * parent when no matching child exists. System categories (userId is
   * null) and the user's own categories are both considered.
   */
  private async resolveCategoryId(
    userId: string,
    category: string,
    subcategory: string,
  ): Promise<string | null> {
    const [parent] = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.name, category),
          isNull(schema.categories.parentId),
          or(eq(schema.categories.userId, userId), isNull(schema.categories.userId)),
        ),
      )
      .limit(1);

    if (!parent) return null;

    const [child] = await this.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(
        and(eq(schema.categories.parentId, parent.id), eq(schema.categories.name, subcategory)),
      )
      .limit(1);

    return child?.id ?? parent.id;
  }
}
