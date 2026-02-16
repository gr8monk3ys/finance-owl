import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class MarketplaceService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getProducts(category?: string, sort?: string) {
    let query = this.db
      .select()
      .from(schema.financialProducts)
      .where(eq(schema.financialProducts.isActive, true));

    if (category) {
      query = this.db
        .select()
        .from(schema.financialProducts)
        .where(
          and(
            eq(schema.financialProducts.isActive, true),
            eq(schema.financialProducts.category, category),
          ),
        );
    }

    const products = await query;

    // Sort results in memory for flexibility
    switch (sort) {
      case 'rating':
        return products.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case 'interest_rate':
        return products.sort(
          (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0),
        );
      case 'annual_fee':
        return products.sort(
          (a, b) => (a.annualFee ?? 0) - (b.annualFee ?? 0),
        );
      case 'reward_rate':
        return products.sort(
          (a, b) => (b.rewardRate ?? 0) - (a.rewardRate ?? 0),
        );
      default:
        return products.sort(
          (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
        );
    }
  }

  async getProductById(id: string) {
    const [product] = await this.db
      .select()
      .from(schema.financialProducts)
      .where(eq(schema.financialProducts.id, id))
      .limit(1);

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getRecommendations(userId: string) {
    // Get user's account types to determine relevant product categories
    const accounts = await this.db
      .select({
        type: schema.accounts.type,
        subtype: schema.accounts.subtype,
        balance: schema.accounts.currentBalance,
      })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.isHidden, false),
        ),
      );

    const hasCredit = accounts.some((a) => a.type === 'credit');
    const hasSavings = accounts.some(
      (a) => a.type === 'depository' && a.subtype === 'savings',
    );
    const hasInvestments = accounts.some((a) => a.type === 'investment');
    const totalBalance = accounts.reduce(
      (sum, a) => sum + (a.balance ?? 0),
      0,
    );

    // Build recommended categories based on what user is missing or could improve
    const recommendedCategories: string[] = [];

    if (!hasCredit) {
      recommendedCategories.push('credit_card');
    }
    if (!hasSavings || totalBalance < 1000) {
      recommendedCategories.push('savings_account');
    }
    if (!hasInvestments) {
      recommendedCategories.push('investment');
    }
    if (totalBalance > 10_000) {
      recommendedCategories.push('cd');
    }

    // Always suggest credit cards and savings accounts
    if (!recommendedCategories.includes('credit_card')) {
      recommendedCategories.push('credit_card');
    }
    if (!recommendedCategories.includes('savings_account')) {
      recommendedCategories.push('savings_account');
    }

    // Fetch active products in recommended categories
    const allProducts = await this.db
      .select()
      .from(schema.financialProducts)
      .where(eq(schema.financialProducts.isActive, true));

    const recommendations = allProducts
      .filter((p) => recommendedCategories.includes(p.category))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 10);

    return recommendations;
  }

  async trackClick(userId: string, productId: string) {
    // Verify product exists
    await this.getProductById(productId);

    const [click] = await this.db
      .insert(schema.productClicks)
      .values({
        userId,
        productId,
      })
      .returning();

    return click;
  }

  async getPopular() {
    // Get products ranked by click count
    const clickCounts = await this.db
      .select({
        productId: schema.productClicks.productId,
        clicks: sql<number>`COUNT(*)`.as('clicks'),
      })
      .from(schema.productClicks)
      .groupBy(schema.productClicks.productId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    if (clickCounts.length === 0) {
      // Fallback to highest-rated products
      return this.db
        .select()
        .from(schema.financialProducts)
        .where(eq(schema.financialProducts.isActive, true))
        .orderBy(desc(schema.financialProducts.rating))
        .limit(10);
    }

    const productIds = clickCounts.map((c) => c.productId);
    const products = await this.db
      .select()
      .from(schema.financialProducts)
      .where(eq(schema.financialProducts.isActive, true));

    // Return products sorted by click count
    return products
      .filter((p) => productIds.includes(p.id))
      .sort((a, b) => {
        const aClicks =
          clickCounts.find((c) => c.productId === a.id)?.clicks ?? 0;
        const bClicks =
          clickCounts.find((c) => c.productId === b.id)?.clicks ?? 0;
        return bClicks - aClicks;
      });
  }
}
