import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// Simplified 2024 federal tax brackets for single filer
const FEDERAL_BRACKETS_SINGLE = [
  { min: 0, max: 11_600, rate: 0.10 },
  { min: 11_600, max: 47_150, rate: 0.12 },
  { min: 47_150, max: 100_525, rate: 0.22 },
  { min: 100_525, max: 191_950, rate: 0.24 },
  { min: 191_950, max: 243_725, rate: 0.32 },
  { min: 243_725, max: 609_350, rate: 0.35 },
  { min: 609_350, max: Infinity, rate: 0.37 },
];

const FEDERAL_BRACKETS_MARRIED_JOINT = [
  { min: 0, max: 23_200, rate: 0.10 },
  { min: 23_200, max: 94_300, rate: 0.12 },
  { min: 94_300, max: 201_050, rate: 0.22 },
  { min: 201_050, max: 383_900, rate: 0.24 },
  { min: 383_900, max: 487_450, rate: 0.32 },
  { min: 487_450, max: 731_200, rate: 0.35 },
  { min: 731_200, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION: Record<string, number> = {
  single: 14_600,
  married_joint: 29_200,
  married_separate: 14_600,
  head_of_household: 21_900,
};

const DEFAULT_STATE_TAX_RATE = 0.05;

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

interface StateTaxConfig {
  type: 'none' | 'flat' | 'progressive';
  /** Flat rate (used when type === 'flat') */
  rate?: number;
  /** Progressive brackets (used when type === 'progressive') */
  brackets?: TaxBracket[];
}

// Real 2024/2025 state income tax data for the 15 most populous US states.
// Sources: state revenue department publications and Tax Foundation data.
const STATE_TAX_DATA: Record<string, StateTaxConfig> = {
  // California – progressive 1% to 13.3% (single filer brackets)
  CA: {
    type: 'progressive',
    brackets: [
      { min: 0, max: 10_412, rate: 0.01 },
      { min: 10_412, max: 24_684, rate: 0.02 },
      { min: 24_684, max: 38_959, rate: 0.04 },
      { min: 38_959, max: 54_081, rate: 0.06 },
      { min: 54_081, max: 68_350, rate: 0.08 },
      { min: 68_350, max: 349_137, rate: 0.093 },
      { min: 349_137, max: 418_961, rate: 0.103 },
      { min: 418_961, max: 698_271, rate: 0.113 },
      { min: 698_271, max: 1_000_000, rate: 0.123 },
      { min: 1_000_000, max: Infinity, rate: 0.133 },
    ],
  },

  // Texas – no state income tax
  TX: { type: 'none' },

  // Florida – no state income tax
  FL: { type: 'none' },

  // New York – progressive 4% to 10.9% (single filer brackets)
  NY: {
    type: 'progressive',
    brackets: [
      { min: 0, max: 8_500, rate: 0.04 },
      { min: 8_500, max: 11_700, rate: 0.045 },
      { min: 11_700, max: 13_900, rate: 0.0525 },
      { min: 13_900, max: 80_650, rate: 0.0585 },
      { min: 80_650, max: 215_400, rate: 0.0625 },
      { min: 215_400, max: 1_077_550, rate: 0.0685 },
      { min: 1_077_550, max: 5_000_000, rate: 0.0965 },
      { min: 5_000_000, max: 25_000_000, rate: 0.103 },
      { min: 25_000_000, max: Infinity, rate: 0.109 },
    ],
  },

  // Pennsylvania – flat 3.07%
  PA: { type: 'flat', rate: 0.0307 },

  // Illinois – flat 4.95%
  IL: { type: 'flat', rate: 0.0495 },

  // Ohio – progressive 0% to 3.99%
  OH: {
    type: 'progressive',
    brackets: [
      { min: 0, max: 26_050, rate: 0.0 },
      { min: 26_050, max: 100_000, rate: 0.02765 },
      { min: 100_000, max: Infinity, rate: 0.0399 },
    ],
  },

  // Georgia – progressive 1% to 5.49%
  GA: {
    type: 'progressive',
    brackets: [
      { min: 0, max: 750, rate: 0.01 },
      { min: 750, max: 2_250, rate: 0.02 },
      { min: 2_250, max: 3_750, rate: 0.03 },
      { min: 3_750, max: 5_250, rate: 0.04 },
      { min: 5_250, max: 7_000, rate: 0.05 },
      { min: 7_000, max: Infinity, rate: 0.0549 },
    ],
  },

  // North Carolina – flat 4.5%
  NC: { type: 'flat', rate: 0.045 },

  // Michigan – flat 4.05%
  MI: { type: 'flat', rate: 0.0405 },

  // New Jersey – progressive 1.4% to 10.75%
  NJ: {
    type: 'progressive',
    brackets: [
      { min: 0, max: 20_000, rate: 0.014 },
      { min: 20_000, max: 35_000, rate: 0.0175 },
      { min: 35_000, max: 40_000, rate: 0.035 },
      { min: 40_000, max: 75_000, rate: 0.05525 },
      { min: 75_000, max: 500_000, rate: 0.0637 },
      { min: 500_000, max: 1_000_000, rate: 0.0897 },
      { min: 1_000_000, max: Infinity, rate: 0.1075 },
    ],
  },

  // Virginia – progressive 2% to 5.75%
  VA: {
    type: 'progressive',
    brackets: [
      { min: 0, max: 3_000, rate: 0.02 },
      { min: 3_000, max: 5_000, rate: 0.03 },
      { min: 5_000, max: 17_000, rate: 0.05 },
      { min: 17_000, max: Infinity, rate: 0.0575 },
    ],
  },

  // Washington – no state income tax
  WA: { type: 'none' },

  // Arizona – flat 2.5%
  AZ: { type: 'flat', rate: 0.025 },

  // Massachusetts – flat 5%
  MA: { type: 'flat', rate: 0.05 },

  // ── Additional no-income-tax states ──
  NV: { type: 'none' },
  SD: { type: 'none' },
  WY: { type: 'none' },
  AK: { type: 'none' },
  NH: { type: 'none' },
  TN: { type: 'none' },
};

/**
 * Calculate tax using progressive brackets. Works for both federal
 * and state progressive tax schedules.
 */
function calculateProgressiveTax(
  taxableIncome: number,
  brackets: TaxBracket[],
): number {
  let tax = 0;
  let remaining = taxableIncome;

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const taxableInBracket = Math.min(remaining, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }

  return Math.round(tax * 100) / 100;
}

/**
 * Calculate state income tax for a given state and taxable income.
 * Falls back to a default flat rate when the state is not in the lookup table.
 */
export function calculateStateTax(
  taxableIncome: number,
  stateCode?: string | null,
): number {
  if (taxableIncome <= 0) return 0;

  const code = stateCode?.toUpperCase()?.trim();
  const config = code ? STATE_TAX_DATA[code] : undefined;

  if (!config) {
    // Unknown state – use a reasonable default (median effective state rate)
    return Math.round(taxableIncome * DEFAULT_STATE_TAX_RATE * 100) / 100;
  }

  switch (config.type) {
    case 'none':
      return 0;
    case 'flat':
      return Math.round(taxableIncome * (config.rate ?? 0) * 100) / 100;
    case 'progressive':
      return calculateProgressiveTax(taxableIncome, config.brackets ?? []);
  }
}

/** Expose the state config map for introspection / testing. */
export { STATE_TAX_DATA };

function getBrackets(filingStatus: string): TaxBracket[] {
  if (filingStatus === 'married_joint') {
    return FEDERAL_BRACKETS_MARRIED_JOINT;
  }
  return FEDERAL_BRACKETS_SINGLE;
}

@Injectable()
export class TaxService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getDocuments(userId: string, year: number) {
    return this.db
      .select()
      .from(schema.taxDocuments)
      .where(
        and(
          eq(schema.taxDocuments.userId, userId),
          eq(schema.taxDocuments.year, year),
        ),
      )
      .orderBy(desc(schema.taxDocuments.createdAt));
  }

  async addDocument(
    userId: string,
    data: {
      year: number;
      type: string;
      description?: string;
      amount: number;
      isDeductible?: boolean;
      category?: string;
    },
  ) {
    const [document] = await this.db
      .insert(schema.taxDocuments)
      .values({
        userId,
        year: data.year,
        type: data.type,
        description: data.description,
        amount: data.amount,
        isDeductible: data.isDeductible ?? false,
        category: data.category,
      })
      .returning();

    return document;
  }

  async updateDocument(
    userId: string,
    id: string,
    data: {
      type?: string;
      description?: string;
      amount?: number;
      isDeductible?: boolean;
      category?: string;
    },
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.taxDocuments)
      .where(
        and(
          eq(schema.taxDocuments.id, id),
          eq(schema.taxDocuments.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) throw new NotFoundException('Tax document not found');

    const [updated] = await this.db
      .update(schema.taxDocuments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.taxDocuments.id, id),
          eq(schema.taxDocuments.userId, userId),
        ),
      )
      .returning();

    return updated;
  }

  async removeDocument(userId: string, id: string) {
    const [existing] = await this.db
      .select()
      .from(schema.taxDocuments)
      .where(
        and(
          eq(schema.taxDocuments.id, id),
          eq(schema.taxDocuments.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) throw new NotFoundException('Tax document not found');

    await this.db
      .delete(schema.taxDocuments)
      .where(
        and(
          eq(schema.taxDocuments.id, id),
          eq(schema.taxDocuments.userId, userId),
        ),
      );
  }

  async generateSummary(userId: string, year: number, state?: string) {
    const documents = await this.getDocuments(userId, year);

    // Calculate estimated income from W-2s and 1099s
    const incomeTypes = ['w2', '1099'];
    const estimatedIncome = documents
      .filter((d) => incomeTypes.includes(d.type))
      .reduce((sum, d) => sum + d.amount, 0);

    // Calculate deductions from deductible documents
    const itemizedDeductions = documents
      .filter((d) => d.isDeductible)
      .reduce((sum, d) => sum + d.amount, 0);

    // Get existing summary to determine filing status, or default to single
    const [existingSummary] = await this.db
      .select()
      .from(schema.taxSummaries)
      .where(
        and(
          eq(schema.taxSummaries.userId, userId),
          eq(schema.taxSummaries.year, year),
        ),
      )
      .limit(1);

    const filingStatus = existingSummary?.filingStatus ?? 'single';
    const standardDeduction = STANDARD_DEDUCTION[filingStatus] ?? 14_600;
    const estimatedDeductions = Math.max(itemizedDeductions, standardDeduction);
    const estimatedTaxableIncome = Math.max(
      0,
      estimatedIncome - estimatedDeductions,
    );

    // Use state from parameter, or fall back to the saved summary's state
    const resolvedState =
      state ?? (existingSummary as any)?.state ?? undefined;

    const brackets = getBrackets(filingStatus);
    const estimatedFederalTax = calculateProgressiveTax(
      estimatedTaxableIncome,
      brackets,
    );
    const estimatedStateTax = calculateStateTax(
      estimatedTaxableIncome,
      resolvedState,
    );
    const generatedAt = new Date().toISOString();

    // Upsert the summary
    if (existingSummary) {
      const [updated] = await this.db
        .update(schema.taxSummaries)
        .set({
          estimatedIncome,
          estimatedDeductions,
          estimatedTaxableIncome,
          estimatedFederalTax,
          estimatedStateTax,
          generatedAt,
          ...(resolvedState ? { state: resolvedState.toUpperCase() } : {}),
        })
        .where(eq(schema.taxSummaries.id, existingSummary.id))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(schema.taxSummaries)
      .values({
        userId,
        year,
        estimatedIncome,
        estimatedDeductions,
        estimatedTaxableIncome,
        estimatedFederalTax,
        estimatedStateTax,
        filingStatus,
        generatedAt,
        ...(resolvedState ? { state: resolvedState.toUpperCase() } : {}),
      })
      .returning();

    return created;
  }

  async getSummary(userId: string, year: number) {
    const [summary] = await this.db
      .select()
      .from(schema.taxSummaries)
      .where(
        and(
          eq(schema.taxSummaries.userId, userId),
          eq(schema.taxSummaries.year, year),
        ),
      )
      .limit(1);

    return (
      summary ?? {
        year,
        estimatedIncome: 0,
        estimatedDeductions: 0,
        estimatedTaxableIncome: 0,
        estimatedFederalTax: 0,
        estimatedStateTax: 0,
        filingStatus: 'single',
        state: null,
        generatedAt: null,
      }
    );
  }

  async getDeductibleTransactions(userId: string, year: number) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // Find transactions in common deductible categories
    const deductibleCategories = [
      'charitable',
      'donations',
      'medical',
      'health',
      'education',
      'business',
      'office',
      'home office',
    ];

    const transactions = await this.db
      .select({
        id: schema.transactions.id,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        categoryName: schema.categories.name,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          sql`${schema.transactions.date} >= ${startDate}`,
          sql`${schema.transactions.date} <= ${endDate}`,
          eq(schema.transactions.pending, false),
        ),
      )
      .orderBy(desc(schema.transactions.date));

    // Filter for potentially deductible transactions based on category name
    return transactions.filter((t) => {
      if (!t.categoryName) return false;
      const lowerCategoryName = t.categoryName.toLowerCase();
      return deductibleCategories.some((dc) => lowerCategoryName.includes(dc));
    });
  }
}
