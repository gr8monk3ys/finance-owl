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

const ESTIMATED_STATE_TAX_RATE = 0.05;

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

function calculateFederalTax(
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

  async generateSummary(userId: string, year: number) {
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

    const brackets = getBrackets(filingStatus);
    const estimatedFederalTax = calculateFederalTax(
      estimatedTaxableIncome,
      brackets,
    );
    const estimatedStateTax =
      Math.round(estimatedTaxableIncome * ESTIMATED_STATE_TAX_RATE * 100) / 100;
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
