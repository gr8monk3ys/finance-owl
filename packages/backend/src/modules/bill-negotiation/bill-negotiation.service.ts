import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import {
  PROVIDER_DATABASE,
  normalizeProviderKey,
  getProvidersByCategory,
  type ProviderInfo,
} from './providers';

// Categories that are commonly negotiable
const NEGOTIABLE_CATEGORIES = [
  'internet',
  'cable',
  'phone',
  'insurance',
  'streaming',
  'utilities',
];

// Common negotiable merchant keywords
const NEGOTIABLE_KEYWORDS: Record<string, string> = {
  'comcast': 'internet',
  'xfinity': 'internet',
  'spectrum': 'internet',
  'at&t': 'phone',
  'verizon': 'phone',
  't-mobile': 'phone',
  'tmobile': 'phone',
  'sprint': 'phone',
  'cox': 'internet',
  'centurylink': 'internet',
  'state farm': 'insurance',
  'geico': 'insurance',
  'progressive': 'insurance',
  'allstate': 'insurance',
  'usaa': 'insurance',
  'netflix': 'streaming',
  'hulu': 'streaming',
  'disney': 'streaming',
  'hbo': 'streaming',
  'spotify': 'streaming',
  'apple music': 'streaming',
  'electric': 'utilities',
  'gas': 'utilities',
  'water': 'utilities',
  'power': 'utilities',
  'energy': 'utilities',
};

export interface AnalyzedBill {
  billName: string;
  provider: string;
  providerKey: string | null;
  currentAmount: number;
  category: string;
  estimatedSavingsMin: number;
  estimatedSavingsMax: number;
  estimatedSavingsPercent: number;
  frequency: string;
  hasProviderInfo: boolean;
}

export interface NegotiationScript {
  provider: string;
  providerInfo: ProviderInfo | null;
  category: string;
  script: {
    opening: string;
    leveragePoints: string[];
    specificAsk: string;
    ifRefused: string[];
    escalation: string;
    finalMove: string;
  };
  tips: string[];
  contactInfo: {
    retentionPhone: string;
    cancellationPhone: string;
    bestTimeToCall: string;
  };
  competitorPricing: { competitor: string; price: string; details: string }[];
}

export interface SavingsSummary {
  totalAnnualSavings: number;
  totalMonthlySavings: number;
  successfulNegotiations: number;
  totalNegotiations: number;
  successRate: number;
  byCategory: {
    category: string;
    annualSavings: number;
    count: number;
  }[];
}

@Injectable()
export class BillNegotiationService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Analyze user's recurring transactions to identify negotiable bills.
   */
  async analyzeBills(userId: string): Promise<AnalyzedBill[]> {
    const subscriptions = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
        categoryName: schema.categories.name,
      })
      .from(schema.recurringTransactions)
      .leftJoin(
        schema.categories,
        eq(schema.recurringTransactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    const analyzedBills: AnalyzedBill[] = [];

    for (const sub of subscriptions) {
      const merchantKey = (sub.merchantName ?? sub.name).toLowerCase();
      let category: string | null = null;
      let providerKey: string | null = null;

      // Try to match by merchant name
      for (const [keyword, cat] of Object.entries(NEGOTIABLE_KEYWORDS)) {
        if (merchantKey.includes(keyword)) {
          category = cat;
          providerKey = normalizeProviderKey(keyword);
          break;
        }
      }

      // Also try category name matching
      if (!category && sub.categoryName) {
        const catLower = sub.categoryName.toLowerCase();
        for (const negotiableCat of NEGOTIABLE_CATEGORIES) {
          if (catLower.includes(negotiableCat)) {
            category = negotiableCat;
            break;
          }
        }
      }

      if (!category) {
        continue;
      }

      // Estimate savings based on provider data or general averages
      let savingsPercent = 15; // default
      if (providerKey && PROVIDER_DATABASE[providerKey]) {
        savingsPercent = PROVIDER_DATABASE[providerKey].averageSavingsPercent;
      }

      const currentMonthly = sub.estimatedAmount;
      const estimatedSavingsMin = Math.round(currentMonthly * (savingsPercent * 0.5) / 100 * 100) / 100;
      const estimatedSavingsMax = Math.round(currentMonthly * savingsPercent / 100 * 100) / 100;

      analyzedBills.push({
        billName: sub.merchantName ?? sub.name,
        provider: sub.merchantName ?? sub.name,
        providerKey,
        currentAmount: currentMonthly,
        category,
        estimatedSavingsMin,
        estimatedSavingsMax,
        estimatedSavingsPercent: savingsPercent,
        frequency: sub.frequency,
        hasProviderInfo: !!providerKey && !!PROVIDER_DATABASE[providerKey],
      });
    }

    // Sort by highest potential savings
    analyzedBills.sort((a, b) => b.estimatedSavingsMax - a.estimatedSavingsMax);

    return analyzedBills;
  }

  /**
   * List all negotiation records for a user.
   */
  async getBillNegotiations(userId: string) {
    return this.db
      .select()
      .from(schema.billNegotiations)
      .where(eq(schema.billNegotiations.userId, userId))
      .orderBy(desc(schema.billNegotiations.createdAt));
  }

  /**
   * Create a negotiation record.
   */
  async startNegotiation(
    userId: string,
    data: {
      billName: string;
      provider: string;
      currentAmount: number;
      targetAmount: number;
      category: string;
      method?: string;
      notes?: string;
    },
  ) {
    const [negotiation] = await this.db
      .insert(schema.billNegotiations)
      .values({
        userId,
        billName: data.billName,
        provider: data.provider,
        currentAmount: data.currentAmount,
        targetAmount: data.targetAmount,
        category: data.category,
        method: data.method ?? 'self_service',
        status: 'pending',
        notes: data.notes ?? null,
      })
      .returning();

    return negotiation;
  }

  /**
   * Generate a negotiation script for a provider.
   */
  getNegotiationScript(
    provider: string,
    category: string,
    currentAmount?: number,
    targetAmount?: number,
  ): NegotiationScript {
    const providerKey = normalizeProviderKey(provider);
    const providerInfo = providerKey ? PROVIDER_DATABASE[providerKey] ?? null : null;

    const displayProvider = providerInfo?.name ?? provider;
    const displayCategory = category.charAt(0).toUpperCase() + category.slice(1);

    const savingsPercent = providerInfo?.averageSavingsPercent ?? 15;
    const suggestedTarget = currentAmount
      ? Math.round(currentAmount * (1 - savingsPercent / 100) * 100) / 100
      : null;
    const targetStr = targetAmount
      ? `$${targetAmount.toFixed(2)}`
      : suggestedTarget
        ? `$${suggestedTarget.toFixed(2)}`
        : `${savingsPercent}% less than what I am currently paying`;

    const competitorLines =
      providerInfo?.competitorPricing
        .map((c) => `${c.competitor} is offering ${c.price} for ${c.details}`)
        .join('. ') ?? 'Competitors in the area are offering significantly lower rates';

    const script = {
      opening: `"Hi, my name is [Your Name], and I have been a loyal ${displayProvider} customer for [X years/months]. I am calling because I have been reviewing my ${displayCategory.toLowerCase()} expenses, and I noticed my bill has been higher than I expected. I would like to discuss options for reducing my monthly payment."`,

      leveragePoints: [
        `Mention your loyalty: "I have been a customer for [X] years and have always paid on time. I value the service but need my bill to be more competitive."`,
        `Reference competitors: "${competitorLines}. I want to stay with ${displayProvider}, but I need the pricing to make sense."`,
        currentAmount
          ? `State your current cost: "I am currently paying $${currentAmount.toFixed(2)} per month, and I would like to get this closer to ${targetStr}."`
          : `State clearly what you are paying and what you would like to pay instead.`,
        `Ask about promotions: "Are there any current promotions, loyalty discounts, or retention offers available for existing customers?"`,
        `Mention bundling: "I am open to bundling services if it helps bring down the overall cost."`,
      ],

      specificAsk: `"Based on what I am seeing from other providers, I would like to get my bill down to ${targetStr} per month. Is there anything you can do to help me reach that number?"`,

      ifRefused: [
        `"I understand you might not be able to match that exact number. What is the best you can offer to keep me as a customer?"`,
        `"Can you check if there are any unadvertised promotions or loyalty offers in the system?"`,
        `"Would it help if I committed to a longer term or bundled additional services?"`,
        `"I appreciate your help, but at this price I will need to seriously consider switching. Can you transfer me to someone who might have more options?"`,
      ],

      escalation: `"I appreciate your help, but I do not think this offer meets my needs. Could you please transfer me to your retention department or a supervisor who might have additional options available?"`,

      finalMove: `"I have been a loyal customer and I would really prefer to stay, but at this price I will need to cancel and switch to [competitor]. Can you please connect me with the cancellation department?" (Note: The cancellation or "save" team typically has the deepest discounts available.)`,
    };

    const tips = providerInfo?.tips ?? [
      'Always be polite but firm - customer service agents respond better to respectful conversations.',
      'Have competitor quotes ready before you call.',
      'Call during off-peak hours (Tuesday-Thursday mornings) for shorter wait times and potentially better offers.',
      'Take notes during the call including the agent name and any reference numbers.',
      'If the first offer is not satisfactory, politely decline and ask for something better.',
    ];

    const contactInfo = providerInfo
      ? {
          retentionPhone: providerInfo.retentionPhone,
          cancellationPhone: providerInfo.cancellationPhone,
          bestTimeToCall: providerInfo.bestTimeToCall,
        }
      : {
          retentionPhone: 'Check your bill for the customer service number',
          cancellationPhone: 'Check your bill for the customer service number',
          bestTimeToCall: 'Tuesday-Thursday, 8-10 AM local time',
        };

    const competitorPricing = providerInfo?.competitorPricing ?? [];

    return {
      provider: displayProvider,
      providerInfo,
      category,
      script,
      tips,
      contactInfo,
      competitorPricing,
    };
  }

  /**
   * Update negotiation result.
   */
  async updateNegotiationResult(
    userId: string,
    id: string,
    data: {
      status?: string;
      negotiatedAmount?: number;
      expirationDate?: string;
      notes?: string;
    },
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.billNegotiations)
      .where(
        and(
          eq(schema.billNegotiations.id, id),
          eq(schema.billNegotiations.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Negotiation not found');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.status) {
      updateData.status = data.status;
    }

    if (data.negotiatedAmount !== undefined) {
      updateData.negotiatedAmount = data.negotiatedAmount;
      updateData.negotiationDate = new Date().toISOString().split('T')[0];

      // Calculate annual savings
      if (data.status === 'success' && data.negotiatedAmount < existing.currentAmount) {
        const monthlySavings = existing.currentAmount - data.negotiatedAmount;
        updateData.annualSavings = Math.round(monthlySavings * 12 * 100) / 100;
      }
    }

    if (data.expirationDate) {
      updateData.expirationDate = data.expirationDate;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const [updated] = await this.db
      .update(schema.billNegotiations)
      .set(updateData)
      .where(
        and(
          eq(schema.billNegotiations.id, id),
          eq(schema.billNegotiations.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  /**
   * Get provider info and tips.
   */
  getProviderInfo(provider: string): ProviderInfo | null {
    const key = normalizeProviderKey(provider);
    if (!key) return null;
    return PROVIDER_DATABASE[key] ?? null;
  }

  /**
   * Get savings summary for a user.
   */
  async getSavingsSummary(userId: string): Promise<SavingsSummary> {
    const negotiations = await this.db
      .select()
      .from(schema.billNegotiations)
      .where(eq(schema.billNegotiations.userId, userId));

    let totalAnnualSavings = 0;
    const successfulNegotiations = negotiations.filter(
      (n) => n.status === 'success',
    );
    const categoryMap = new Map<
      string,
      { annualSavings: number; count: number }
    >();

    for (const neg of successfulNegotiations) {
      const savings = neg.annualSavings ?? 0;
      totalAnnualSavings += savings;

      const existing = categoryMap.get(neg.category);
      if (existing) {
        existing.annualSavings += savings;
        existing.count += 1;
      } else {
        categoryMap.set(neg.category, {
          annualSavings: savings,
          count: 1,
        });
      }
    }

    const totalNegotiations = negotiations.filter(
      (n) => n.status !== 'pending',
    ).length;

    return {
      totalAnnualSavings: Math.round(totalAnnualSavings * 100) / 100,
      totalMonthlySavings: Math.round((totalAnnualSavings / 12) * 100) / 100,
      successfulNegotiations: successfulNegotiations.length,
      totalNegotiations,
      successRate:
        totalNegotiations > 0
          ? Math.round(
              (successfulNegotiations.length / totalNegotiations) * 100,
            )
          : 0,
      byCategory: Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          annualSavings: Math.round(data.annualSavings * 100) / 100,
          count: data.count,
        }))
        .sort((a, b) => b.annualSavings - a.annualSavings),
    };
  }

  /**
   * Get all known providers.
   */
  getProviders() {
    return getProvidersByCategory();
  }

  /**
   * Check for expiring promotional rates (within N days).
   */
  async checkForRateExpiration(userId: string, daysAhead: number = 90) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    return this.db
      .select()
      .from(schema.billNegotiations)
      .where(
        and(
          eq(schema.billNegotiations.userId, userId),
          eq(schema.billNegotiations.status, 'success'),
          sql`${schema.billNegotiations.expirationDate} IS NOT NULL`,
          sql`${schema.billNegotiations.expirationDate} >= ${todayStr}`,
          sql`${schema.billNegotiations.expirationDate} <= ${futureDateStr}`,
        ),
      )
      .orderBy(schema.billNegotiations.expirationDate);
  }
}
