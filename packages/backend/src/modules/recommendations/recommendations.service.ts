import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { productRecommendations } from './recommendations.schema';
import { PRODUCT_CATALOG, type CatalogProduct } from './product-catalog';
import * as schema from '../../database/schema';

export interface FinancialProfile {
  totalAccounts: number;
  checkingBalance: number;
  savingsBalance: number;
  creditCardCount: number;
  investmentAccountCount: number;
  totalMonthlySpending: number;
  topCategories: Array<{ category: string; total: number }>;
  savingsRate: number;
  hasInvestments: boolean;
  avgMonthlyIncome: number;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async generateRecommendations(userId: string) {
    const profile = await this.getProfile(userId);

    // Clear existing active recommendations (keep dismissed ones)
    await this.db
      .delete(productRecommendations)
      .where(
        and(
          eq(productRecommendations.userId, userId),
          eq(productRecommendations.isDismissed, 0),
        ),
      );

    const recommendations = this.matchProducts(profile);

    if (recommendations.length > 0) {
      await this.db.insert(productRecommendations).values(
        recommendations.map((rec) => ({
          userId,
          productType: rec.product.type,
          productName: rec.product.name,
          provider: rec.product.provider,
          description: rec.product.description,
          annualFee: rec.product.annualFee,
          interestRate: rec.product.interestRate,
          rewardType: rec.product.rewardType,
          matchScore: rec.score,
          matchReason: rec.reason,
          applyUrl: rec.product.applyUrl,
          isActive: 1,
          isDismissed: 0,
        })),
      );
    }

    return this.getRecommendations(userId);
  }

  async getRecommendations(userId: string, type?: string) {
    const conditions = [
      eq(productRecommendations.userId, userId),
      eq(productRecommendations.isActive, 1),
      eq(productRecommendations.isDismissed, 0),
    ];

    if (type) {
      conditions.push(eq(productRecommendations.productType, type));
    }

    return this.db
      .select()
      .from(productRecommendations)
      .where(and(...conditions))
      .orderBy(desc(productRecommendations.matchScore));
  }

  async dismissRecommendation(userId: string, id: string) {
    const [rec] = await this.db
      .select()
      .from(productRecommendations)
      .where(
        and(
          eq(productRecommendations.id, id),
          eq(productRecommendations.userId, userId),
        ),
      )
      .limit(1);

    if (!rec) throw new NotFoundException('Recommendation not found');

    const [updated] = await this.db
      .update(productRecommendations)
      .set({ isDismissed: 1 })
      .where(eq(productRecommendations.id, id))
      .returning();

    return updated;
  }

  async getProfile(userId: string): Promise<FinancialProfile> {
    // Fetch accounts
    const accounts = await this.db
      .select({
        type: schema.accounts.type,
        currentBalance: schema.accounts.currentBalance,
        isHidden: schema.accounts.isHidden,
      })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, userId),
          eq(schema.accounts.isHidden, false),
        ),
      );

    const checkingBalance = accounts
      .filter((a) => a.type === 'checking')
      .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

    const savingsBalance = accounts
      .filter((a) => a.type === 'savings')
      .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

    const creditCardCount = accounts.filter(
      (a) => a.type === 'credit_card',
    ).length;

    const investmentAccountCount = accounts.filter(
      (a) => a.type === 'investment',
    ).length;

    // Fetch recent spending (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const spendingRows = await this.db
      .select({
        categoryName: schema.categories.name,
        total: sql<number>`SUM(${schema.transactions.amount})`.as('total'),
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.amount} > 0`,
          sql`${schema.transactions.date} >= ${startDate}`,
          sql`${schema.transactions.date} <= ${endDate}`,
        ),
      )
      .groupBy(schema.categories.name)
      .orderBy(desc(sql`total`))
      .limit(5);

    const totalMonthlySpending =
      spendingRows.reduce((sum, r) => sum + Math.abs(r.total), 0) / 3;

    const topCategories = spendingRows.map((r) => ({
      category: r.categoryName || 'Uncategorized',
      total: Math.abs(r.total) / 3, // Monthly average
    }));

    // Fetch income (last 3 months)
    const incomeRows = await this.db
      .select({
        total: sql<number>`SUM(ABS(${schema.transactions.amount}))`.as('total'),
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.amount} < 0`,
          sql`${schema.transactions.date} >= ${startDate}`,
          sql`${schema.transactions.date} <= ${endDate}`,
        ),
      );

    const avgMonthlyIncome = (incomeRows[0]?.total ?? 0) / 3;

    const savingsRate =
      avgMonthlyIncome > 0
        ? ((avgMonthlyIncome - totalMonthlySpending) / avgMonthlyIncome) * 100
        : 0;

    return {
      totalAccounts: accounts.length,
      checkingBalance,
      savingsBalance,
      creditCardCount,
      investmentAccountCount,
      totalMonthlySpending,
      topCategories,
      savingsRate,
      hasInvestments: investmentAccountCount > 0,
      avgMonthlyIncome,
    };
  }

  private matchProducts(
    profile: FinancialProfile,
  ): Array<{ product: CatalogProduct; score: number; reason: string }> {
    const matches: Array<{
      product: CatalogProduct;
      score: number;
      reason: string;
    }> = [];

    for (const product of PRODUCT_CATALOG) {
      const result = this.scoreProduct(product, profile);
      if (result.score >= 40) {
        matches.push({ product, ...result });
      }
    }

    // Sort by score descending, then take top recommendations per type
    matches.sort((a, b) => b.score - a.score);

    // Limit to top 2 per product type
    const typeCount: Record<string, number> = {};
    const filtered = matches.filter((m) => {
      const count = typeCount[m.product.type] || 0;
      if (count >= 2) return false;
      typeCount[m.product.type] = count + 1;
      return true;
    });

    return filtered.slice(0, 8); // Max 8 total recommendations
  }

  private scoreProduct(
    product: CatalogProduct,
    profile: FinancialProfile,
  ): { score: number; reason: string } {
    let score = 50; // Baseline score
    const reasons: string[] = [];

    switch (product.type) {
      case 'credit_card':
        score = this.scoreCreditCard(product, profile, reasons);
        break;
      case 'savings_account':
        score = this.scoreSavingsAccount(product, profile, reasons);
        break;
      case 'checking_account':
        score = this.scoreCheckingAccount(product, profile, reasons);
        break;
      case 'investment_account':
        score = this.scoreInvestmentAccount(product, profile, reasons);
        break;
      case 'personal_loan':
        score = this.scorePersonalLoan(product, profile, reasons);
        break;
      default:
        score = 40;
        reasons.push('General financial product that may benefit you.');
    }

    return {
      score: Math.min(Math.max(score, 0), 100),
      reason: reasons.join(' '),
    };
  }

  private scoreCreditCard(
    product: CatalogProduct,
    profile: FinancialProfile,
    reasons: string[],
  ): number {
    let score = 45;

    // Check if user has high spending in relevant categories
    const hasDining = profile.topCategories.some(
      (c) =>
        c.category.toLowerCase().includes('dining') ||
        c.category.toLowerCase().includes('restaurant') ||
        c.category.toLowerCase().includes('food'),
    );
    const hasTravel = profile.topCategories.some(
      (c) =>
        c.category.toLowerCase().includes('travel') ||
        c.category.toLowerCase().includes('airline') ||
        c.category.toLowerCase().includes('hotel'),
    );
    const hasGroceries = profile.topCategories.some(
      (c) =>
        c.category.toLowerCase().includes('grocer') ||
        c.category.toLowerCase().includes('supermarket'),
    );

    // Travel cards
    if (
      product.idealFor.includes('high_travel_spending') ||
      product.idealFor.includes('travel_spending')
    ) {
      if (hasTravel) {
        score += 25;
        reasons.push(
          'Your travel spending makes this card especially rewarding.',
        );
      }
      if (profile.totalMonthlySpending > 3000) {
        score += 10;
        reasons.push('High monthly spending maximizes reward earning potential.');
      }
    }

    // Dining cards
    if (product.idealFor.includes('dining_spending') && hasDining) {
      score += 20;
      reasons.push('Great match for your dining habits.');
    }

    // Grocery cards
    if (product.idealFor.includes('high_grocery_spending') && hasGroceries) {
      score += 25;
      reasons.push(
        'You spend significantly on groceries, where this card offers top rewards.',
      );
    }

    // No annual fee preference for lower spenders
    if (product.annualFee === 0) {
      if (profile.totalMonthlySpending < 2000) {
        score += 15;
        reasons.push('No annual fee keeps costs low for your spending level.');
      } else {
        score += 5;
      }
    }

    // Cashback cards for general spending
    if (
      product.rewardType === 'cashback' &&
      product.idealFor.includes('general_spending')
    ) {
      score += 10;
      reasons.push('Simple cashback rewards on all purchases.');
    }

    // First card recommendation if user has few credit cards
    if (
      product.idealFor.includes('first_credit_card') &&
      profile.creditCardCount === 0
    ) {
      score += 20;
      reasons.push(
        'A great starter card to begin building your credit history.',
      );
    }

    if (reasons.length === 0) {
      reasons.push('A solid credit card option based on your financial profile.');
    }

    return score;
  }

  private scoreSavingsAccount(
    product: CatalogProduct,
    profile: FinancialProfile,
    reasons: string[],
  ): number {
    let score = 40;

    // Users with low savings rate benefit most
    if (profile.savingsRate < 20) {
      score += 20;
      reasons.push(
        'A high-yield savings account can help you grow your savings faster.',
      );
    }

    // Users with cash sitting in checking
    if (profile.checkingBalance > 5000 && profile.savingsBalance < 1000) {
      score += 25;
      reasons.push(
        'You have significant cash in checking that could earn higher interest in a dedicated savings account.',
      );
    }

    // High APY is always attractive
    if (product.interestRate && product.interestRate >= 4.0) {
      score += 15;
      reasons.push(
        `Earn ${product.interestRate}% APY, significantly more than traditional banks.`,
      );
    }

    // Emergency fund building
    if (profile.savingsBalance < profile.totalMonthlySpending * 3) {
      score += 10;
      reasons.push(
        'Building an emergency fund of 3-6 months of expenses is recommended.',
      );
    }

    if (reasons.length === 0) {
      reasons.push(
        'A high-yield savings account to maximize your interest earnings.',
      );
    }

    return score;
  }

  private scoreCheckingAccount(
    product: CatalogProduct,
    profile: FinancialProfile,
    reasons: string[],
  ): number {
    let score = 35;

    if (profile.checkingBalance > 0 && product.interestRate && product.interestRate > 0) {
      score += 20;
      reasons.push(
        `Earn ${product.interestRate}% APY on your checking balance instead of the typical near-zero rate.`,
      );
    }

    if (product.idealFor.includes('direct_deposit')) {
      score += 10;
      reasons.push('Get paid up to 2 days early with direct deposit.');
    }

    if (reasons.length === 0) {
      reasons.push(
        'A modern checking account with competitive features and no fees.',
      );
    }

    return score;
  }

  private scoreInvestmentAccount(
    product: CatalogProduct,
    profile: FinancialProfile,
    reasons: string[],
  ): number {
    let score = 35;

    // If user has no investment accounts, strongly recommend
    if (!profile.hasInvestments) {
      score += 30;
      reasons.push(
        'You have no investment accounts yet. Starting to invest can help build long-term wealth.',
      );
    }

    // If user has good savings, recommend investing excess
    if (profile.savingsBalance > profile.totalMonthlySpending * 6) {
      score += 20;
      reasons.push(
        'Your savings exceed 6 months of expenses, making it a good time to consider investing the surplus.',
      );
    }

    // Good savings rate means capacity to invest
    if (profile.savingsRate > 20) {
      score += 15;
      reasons.push(
        'Your healthy savings rate suggests capacity for regular investment contributions.',
      );
    }

    if (reasons.length === 0) {
      reasons.push(
        'A brokerage account to help you start or expand your investment portfolio.',
      );
    }

    return score;
  }

  private scorePersonalLoan(
    product: CatalogProduct,
    profile: FinancialProfile,
    reasons: string[],
  ): number {
    let score = 25; // Lower baseline — only recommend when relevant

    // Check if user might benefit from debt consolidation
    if (profile.creditCardCount >= 2) {
      score += 15;
      reasons.push(
        'A personal loan could help consolidate multiple credit card balances at a lower rate.',
      );
    }

    if (reasons.length === 0) {
      reasons.push(
        'A personal loan option for debt consolidation or planned expenses.',
      );
    }

    return score;
  }
}
