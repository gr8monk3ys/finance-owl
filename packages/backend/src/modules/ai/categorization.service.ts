import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { OllamaClient } from './ollama.client';
import * as schema from '../../database/schema';

interface TransactionForCategorization {
  id: string;
  name: string;
  merchantName: string | null;
  description: string | null;
  amount: number;
}

interface CategorizationResult {
  categoryId: string | null;
  source: string; // 'rule' | 'plaid' | 'ai' | null
}

// Plaid PFC to our category name mapping
const PLAID_PFC_MAP: Record<string, string> = {
  FOOD_AND_DRINK: 'Food & Drink',
  FOOD_AND_DRINK_RESTAURANTS: 'Restaurants',
  FOOD_AND_DRINK_GROCERIES: 'Groceries',
  FOOD_AND_DRINK_COFFEE: 'Coffee Shops',
  FOOD_AND_DRINK_FAST_FOOD: 'Fast Food',
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: 'Bars & Alcohol',
  TRANSPORTATION: 'Transportation',
  TRANSPORTATION_GAS: 'Gas & Fuel',
  TRANSPORTATION_PARKING: 'Parking',
  TRANSPORTATION_PUBLIC_TRANSIT: 'Public Transit',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: 'Ride Share',
  GENERAL_MERCHANDISE: 'Shopping',
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'Clothing',
  GENERAL_MERCHANDISE_ELECTRONICS: 'Electronics',
  GENERAL_MERCHANDISE_SPORTING_GOODS: 'Sporting Goods',
  RENT_AND_UTILITIES: 'Utilities',
  RENT_AND_UTILITIES_RENT: 'Rent',
  RENT_AND_UTILITIES_ELECTRIC: 'Electric',
  RENT_AND_UTILITIES_GAS: 'Gas',
  RENT_AND_UTILITIES_WATER: 'Water',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: 'Internet',
  RENT_AND_UTILITIES_TELEPHONE: 'Phone',
  MEDICAL: 'Health & Medical',
  MEDICAL_VETERINARY_SERVICES: 'Vet',
  ENTERTAINMENT: 'Entertainment',
  ENTERTAINMENT_MUSIC_AND_AUDIO: 'Music',
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'Hobbies',
  ENTERTAINMENT_TV_AND_MOVIES: 'Streaming Services',
  ENTERTAINMENT_GAMES: 'Games',
  PERSONAL_CARE: 'Personal Care',
  EDUCATION: 'Education',
  TRAVEL: 'Travel',
  TRAVEL_FLIGHTS: 'Flights',
  TRAVEL_LODGING: 'Hotels',
  TRAVEL_CAR_RENTAL: 'Car Rental',
  INCOME: 'Income',
  INCOME_WAGES: 'Salary',
  INCOME_DIVIDENDS: 'Dividends',
  INCOME_INTEREST_EARNED: 'Interest',
  TRANSFER_IN: 'Transfers',
  TRANSFER_OUT: 'Transfers',
  LOAN_PAYMENTS: 'Financial',
  BANK_FEES: 'Bank Fees',
  BANK_FEES_ATM_FEES: 'ATM Fees',
  BANK_FEES_OVERDRAFT_FEES: 'Bank Fees',
};

@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);
  private categoryNameMap: Map<string, string> | null = null;

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private ollamaClient: OllamaClient,
  ) {}

  async categorize(
    userId: string,
    transaction: TransactionForCategorization,
    plaidCategory?: string | null,
  ): Promise<CategorizationResult> {
    // 1. Try user-defined rules
    const ruleResult = await this.tryRules(userId, transaction);
    if (ruleResult) return ruleResult;

    // 2. Try Plaid PFC mapping
    if (plaidCategory) {
      const plaidResult = await this.tryPlaidMapping(plaidCategory);
      if (plaidResult) return plaidResult;
    }

    // 3. Try AI categorization
    const aiResult = await this.tryAiCategorization(userId, transaction);
    if (aiResult) return aiResult;

    // 4. Leave uncategorized
    return { categoryId: null, source: 'null' };
  }

  private async tryRules(
    userId: string,
    transaction: TransactionForCategorization,
  ): Promise<CategorizationResult | null> {
    const rules = await this.db
      .select()
      .from(schema.categorizationRules)
      .where(eq(schema.categorizationRules.userId, userId))
      .orderBy(desc(schema.categorizationRules.priority));

    for (const rule of rules) {
      let matches = false;

      switch (rule.matchType) {
        case 'merchant':
          matches =
            (transaction.merchantName ?? '')
              .toLowerCase()
              .includes(rule.matchValue.toLowerCase());
          break;

        case 'description':
          matches =
            (transaction.name + ' ' + (transaction.description ?? ''))
              .toLowerCase()
              .includes(rule.matchValue.toLowerCase());
          break;

        case 'amount_range': {
          const [min, max] = rule.matchValue.split(',').map(Number);
          const absAmount = Math.abs(transaction.amount);
          matches = absAmount >= min && absAmount <= max;
          break;
        }

        case 'regex':
          try {
            const re = new RegExp(rule.matchValue, 'i');
            matches = re.test(
              transaction.merchantName ?? transaction.name,
            );
          } catch {
            // Invalid regex, skip
          }
          break;
      }

      if (matches) {
        return { categoryId: rule.categoryId, source: 'rule' };
      }
    }

    return null;
  }

  private async tryPlaidMapping(
    plaidCategory: string,
  ): Promise<CategorizationResult | null> {
    const categoryName = PLAID_PFC_MAP[plaidCategory];
    if (!categoryName) return null;

    const nameMap = await this.getCategoryNameMap();
    const categoryId = nameMap.get(categoryName);
    if (!categoryId) return null;

    return { categoryId, source: 'plaid' };
  }

  private async tryAiCategorization(
    userId: string,
    transaction: TransactionForCategorization,
  ): Promise<CategorizationResult | null> {
    if (!this.ollamaClient.isAvailable()) return null;

    // Get available categories
    const categories = await this.db
      .select({ id: schema.categories.id, name: schema.categories.name, parentId: schema.categories.parentId })
      .from(schema.categories);

    // Build category list for prompt
    const parentCategories = categories.filter((c) => !c.parentId);
    const categoryList = parentCategories
      .map((parent) => {
        const children = categories
          .filter((c) => c.parentId === parent.id)
          .map((c) => c.name);
        if (children.length > 0) {
          return `${parent.name}: ${children.join(', ')}`;
        }
        return parent.name;
      })
      .join('\n');

    // Get recent user corrections for few-shot examples
    const corrections = await this.db
      .select()
      .from(schema.categorizationCorrections)
      .where(eq(schema.categorizationCorrections.userId, userId))
      .orderBy(desc(schema.categorizationCorrections.createdAt))
      .limit(10);

    let fewShotExamples = '';
    if (corrections.length > 0) {
      const examples = corrections
        .map(
          (c) =>
            `- "${c.merchantName || c.description}" -> Category: "${categories.find((cat) => cat.id === c.toCategoryId)?.name || 'Unknown'}"`,
        )
        .join('\n');
      fewShotExamples = `\nHere are examples of how this user categorizes transactions:\n${examples}\n`;
    }

    const prompt = `You are a financial transaction categorizer. Given a transaction, respond with ONLY the exact subcategory name from the list below. Do not explain.

Available categories:
${categoryList}
${fewShotExamples}
Transaction:
- Name: ${transaction.name}
- Merchant: ${transaction.merchantName || 'Unknown'}
- Amount: $${Math.abs(transaction.amount).toFixed(2)}
- Description: ${transaction.description || 'N/A'}

Category:`;

    const response = await this.ollamaClient.generate(prompt);
    if (!response) return null;

    // Find the category by name
    const cleanedResponse = response.replace(/['"]/g, '').trim();
    const match = categories.find(
      (c) => c.name.toLowerCase() === cleanedResponse.toLowerCase(),
    );

    if (match) {
      return { categoryId: match.id, source: 'ai' };
    }

    // Try partial match
    const partialMatch = categories.find((c) =>
      cleanedResponse.toLowerCase().includes(c.name.toLowerCase()),
    );

    if (partialMatch) {
      return { categoryId: partialMatch.id, source: 'ai' };
    }

    this.logger.debug(
      `AI returned unmatched category "${cleanedResponse}" for transaction "${transaction.name}"`,
    );
    return null;
  }

  private async getCategoryNameMap(): Promise<Map<string, string>> {
    if (this.categoryNameMap) return this.categoryNameMap;

    const categories = await this.db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories);

    this.categoryNameMap = new Map();
    for (const cat of categories) {
      this.categoryNameMap.set(cat.name, cat.id);
    }

    return this.categoryNameMap;
  }

  // Call this when categories change to invalidate cache
  invalidateCache() {
    this.categoryNameMap = null;
  }
}
