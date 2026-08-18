/**
 * Database Seed Script
 *
 * Populates the database with realistic demo data for development and testing.
 * Creates a demo user, bank accounts, 6 months of transactions including the
 * current month, budgets,
 * savings goals, and notification preferences.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *   pnpm db:seed
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { hash } from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

import { users } from '../src/database/schema/users';
import { accounts } from '../src/database/schema/accounts';
import { categories } from '../src/database/schema/categories';
import { transactions } from '../src/database/schema/transactions';
import { budgets, recurringTransactions } from '../src/database/schema/budgets';
import { userPreferences } from '../src/database/schema/audit';
import {
  savingsGoals,
  savingsContributions,
} from '../src/modules/savings-goals/savings-goals.schema';
import { notificationPreferences } from '../src/modules/notifications/notification-preferences.schema';

// ---------------------------------------------------------------------------
// Load .env if present
// ---------------------------------------------------------------------------
function loadEnv(): void {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf-8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

interface CategoryDef {
  name: string;
  icon: string;
  color: string;
}

const SYSTEM_CATEGORIES: CategoryDef[] = [
  { name: 'Income', icon: 'dollar-sign', color: '#22c55e' },
  { name: 'Groceries', icon: 'shopping-cart', color: '#f97316' },
  { name: 'Dining', icon: 'utensils', color: '#ef4444' },
  { name: 'Transportation', icon: 'car', color: '#3b82f6' },
  { name: 'Housing', icon: 'home', color: '#8b5cf6' },
  { name: 'Utilities', icon: 'zap', color: '#eab308' },
  { name: 'Entertainment', icon: 'film', color: '#ec4899' },
  { name: 'Shopping', icon: 'shopping-bag', color: '#14b8a6' },
  { name: 'Health & Fitness', icon: 'heart', color: '#f43f5e' },
  { name: 'Subscriptions', icon: 'refresh-cw', color: '#6366f1' },
  { name: 'Personal Care', icon: 'smile', color: '#d946ef' },
  { name: 'Education', icon: 'book', color: '#0ea5e9' },
  { name: 'Travel', icon: 'plane', color: '#06b6d4' },
  { name: 'Insurance', icon: 'shield', color: '#64748b' },
  { name: 'Gifts & Donations', icon: 'gift', color: '#a855f7' },
  { name: 'Transfer', icon: 'arrow-right-left', color: '#94a3b8' },
  { name: 'Other', icon: 'more-horizontal', color: '#71717a' },
];

// ---------------------------------------------------------------------------
// Transaction templates
// ---------------------------------------------------------------------------

interface MonthlyBill {
  name: string;
  merchant: string;
  amount: number;
  category: string;
  dayOfMonth: number;
}

const MONTHLY_BILLS: MonthlyBill[] = [
  {
    name: 'Rent Payment',
    merchant: 'Oakwood Apartments',
    amount: 1800,
    category: 'Housing',
    dayOfMonth: 1,
  },
  {
    name: 'Auto Loan Payment',
    merchant: 'Capital One Auto',
    amount: 380,
    category: 'Transportation',
    dayOfMonth: 15,
  },
  {
    name: 'Internet Service',
    merchant: 'Xfinity',
    amount: 79.99,
    category: 'Utilities',
    dayOfMonth: 8,
  },
  {
    name: 'Netflix',
    merchant: 'Netflix',
    amount: 15.49,
    category: 'Subscriptions',
    dayOfMonth: 12,
  },
  {
    name: 'Spotify Premium',
    merchant: 'Spotify',
    amount: 9.99,
    category: 'Subscriptions',
    dayOfMonth: 18,
  },
  {
    name: 'Gym Membership',
    merchant: 'LA Fitness',
    amount: 49.99,
    category: 'Health & Fitness',
    dayOfMonth: 5,
  },
];

interface RandomTransaction {
  merchants: string[];
  category: string;
  minAmount: number;
  maxAmount: number;
  frequencyPerMonth: number; // average occurrences per month
  namePrefix: string;
}

const RANDOM_TRANSACTIONS: RandomTransaction[] = [
  {
    merchants: [
      'Olive Garden',
      'Chipotle',
      'Panera Bread',
      'Thai Orchid',
      'Burger King',
      'Panda Express',
      "Chili's",
      'Subway',
      'Five Guys',
      'Sushi Palace',
    ],
    category: 'Dining',
    minAmount: 15,
    maxAmount: 80,
    frequencyPerMonth: 8,
    namePrefix: 'Restaurant',
  },
  {
    merchants: ['Starbucks', "Dunkin'", "Peet's Coffee", 'Blue Bottle Coffee', 'Local Cafe'],
    category: 'Dining',
    minAmount: 4,
    maxAmount: 7,
    frequencyPerMonth: 12,
    namePrefix: 'Coffee',
  },
  {
    merchants: [
      'Amazon',
      'Target',
      'Walmart',
      'Best Buy',
      'Nordstrom',
      "Macy's",
      'TJ Maxx',
      'Home Depot',
      'IKEA',
    ],
    category: 'Shopping',
    minAmount: 20,
    maxAmount: 200,
    frequencyPerMonth: 4,
    namePrefix: 'Shopping',
  },
  {
    merchants: ['Uber', 'Lyft'],
    category: 'Transportation',
    minAmount: 8,
    maxAmount: 25,
    frequencyPerMonth: 3,
    namePrefix: 'Rideshare',
  },
];

const GROCERY_STORES = [
  'Whole Foods',
  "Trader Joe's",
  'Kroger',
  'Safeway',
  'Costco',
  'Aldi',
  'Publix',
  'Sprouts',
];
const GAS_STATIONS = ['Shell', 'Chevron', 'BP', 'ExxonMobil', 'Costco Gas', 'Arco'];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  const startTime = Date.now();
  console.log('FinanceOwl -- Database Seed');
  console.log('==========================================\n');

  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/finance_owl';

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // ── 1. Create demo user ──────────────────────────────────────
    console.log('[1/8] Creating demo user...');
    const userId = uuid();
    const passwordHash = await hash('Demo123!');

    await db.insert(users).values({
      id: userId,
      email: 'demo@financeowl.com',
      name: 'Demo User',
      passwordHash,
      totpEnabled: false,
    });
    console.log('  Created: demo@financeowl.com / Demo123!');

    // ── 2. Create system categories ──────────────────────────────
    console.log('[2/8] Creating categories...');
    const categoryMap = new Map<string, string>();

    for (let i = 0; i < SYSTEM_CATEGORIES.length; i++) {
      const cat = SYSTEM_CATEGORIES[i];
      const catId = uuid();
      categoryMap.set(cat.name, catId);

      await db.insert(categories).values({
        id: catId,
        userId: null,
        parentId: null,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isSystem: true,
        sortOrder: i,
      });
    }
    console.log(`  Created ${SYSTEM_CATEGORIES.length} system categories`);

    // ── 3. Create bank accounts ──────────────────────────────────
    console.log('[3/8] Creating bank accounts...');
    const checkingId = uuid();
    const savingsId = uuid();
    const creditCardId = uuid();

    await db.insert(accounts).values([
      {
        id: checkingId,
        userId,
        name: 'Primary Checking',
        type: 'checking',
        subtype: 'checking',
        institutionName: 'Chase',
        mask: '4521',
        currentBalance: 5200,
        availableBalance: 5200,
        currency: 'USD',
        isManual: true,
        isHidden: false,
      },
      {
        id: savingsId,
        userId,
        name: 'High-Yield Savings',
        type: 'savings',
        subtype: 'savings',
        institutionName: 'Marcus by Goldman Sachs',
        mask: '8834',
        currentBalance: 12000,
        availableBalance: 12000,
        currency: 'USD',
        isManual: true,
        isHidden: false,
      },
      {
        id: creditCardId,
        userId,
        name: 'Sapphire Preferred',
        type: 'credit_card',
        subtype: 'credit card',
        institutionName: 'Chase',
        mask: '2198',
        currentBalance: -1840,
        availableBalance: 8160,
        creditLimit: 10000,
        currency: 'USD',
        isManual: true,
        isHidden: false,
      },
    ]);
    console.log('  Created: Primary Checking ($5,200)');
    console.log('  Created: High-Yield Savings ($12,000)');
    console.log('  Created: Sapphire Preferred (-$1,840)');

    // ── 4. Generate 6 months of transactions ─────────────────────
    console.log('[4/8] Generating transactions (last 6 months, including this month)...');
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const transactionValues: Array<{
      id: string;
      userId: string;
      accountId: string;
      categoryId: string | null;
      amount: number;
      name: string;
      merchantName: string | null;
      date: string;
      pending: boolean;
      isManual: boolean;
      categorizationSource: string;
    }> = [];

    // Iterate over each month in the 6-month window
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const monthDate = new Date(
        sixMonthsAgo.getFullYear(),
        sixMonthsAgo.getMonth() + monthOffset,
        1,
      );
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // --- Biweekly salary (1st and 15th) ---
      for (const payDay of [1, 15]) {
        const salaryDate = new Date(year, month, payDay);
        if (salaryDate <= now) {
          transactionValues.push({
            id: uuid(),
            userId,
            accountId: checkingId,
            categoryId: categoryMap.get('Income') || null,
            amount: -3200, // negative = income in bank perspective (money in)
            name: 'Payroll Direct Deposit',
            merchantName: 'Acme Corp',
            date: formatDate(salaryDate),
            pending: false,
            isManual: true,
            categorizationSource: 'manual',
          });
        }
      }

      // --- Monthly bills ---
      for (const bill of MONTHLY_BILLS) {
        const billDay = Math.min(bill.dayOfMonth, daysInMonth);
        const billDate = new Date(year, month, billDay);
        if (billDate <= now) {
          // Rent and auto loan come from checking, others from credit card
          const acctId =
            bill.name === 'Rent Payment' || bill.name === 'Auto Loan Payment'
              ? checkingId
              : creditCardId;

          transactionValues.push({
            id: uuid(),
            userId,
            accountId: acctId,
            categoryId: categoryMap.get(bill.category) || null,
            amount: bill.amount, // positive = expense (money out)
            name: bill.name,
            merchantName: bill.merchant,
            date: formatDate(billDate),
            pending: false,
            isManual: true,
            categorizationSource: 'manual',
          });
        }
      }

      // --- Weekly groceries ---
      for (let week = 0; week < 4; week++) {
        const groceryDay = 3 + week * 7 + Math.floor(Math.random() * 3); // Wed-Fri each week
        if (groceryDay <= daysInMonth) {
          const groceryDate = new Date(year, month, groceryDay);
          if (groceryDate <= now) {
            transactionValues.push({
              id: uuid(),
              userId,
              accountId: creditCardId,
              categoryId: categoryMap.get('Groceries') || null,
              amount: randomBetween(80, 150),
              name: 'Groceries',
              merchantName: pickRandom(GROCERY_STORES),
              date: formatDate(groceryDate),
              pending: false,
              isManual: true,
              categorizationSource: 'manual',
            });
          }
        }
      }

      // --- Weekly gas ---
      for (let week = 0; week < 4; week++) {
        const gasDay = 6 + week * 7 + Math.floor(Math.random() * 2); // Sat-Sun each week
        if (gasDay <= daysInMonth) {
          const gasDate = new Date(year, month, gasDay);
          if (gasDate <= now) {
            transactionValues.push({
              id: uuid(),
              userId,
              accountId: creditCardId,
              categoryId: categoryMap.get('Transportation') || null,
              amount: randomBetween(40, 60),
              name: 'Gas',
              merchantName: pickRandom(GAS_STATIONS),
              date: formatDate(gasDate),
              pending: false,
              isManual: true,
              categorizationSource: 'manual',
            });
          }
        }
      }

      // --- Random transactions ---
      for (const template of RANDOM_TRANSACTIONS) {
        // Poisson-like distribution: use frequency +/- some randomness
        const count = Math.max(1, Math.round(template.frequencyPerMonth + (Math.random() * 4 - 2)));
        for (let i = 0; i < count; i++) {
          const day = Math.floor(Math.random() * daysInMonth) + 1;
          const txDate = new Date(year, month, day);
          if (txDate <= now) {
            const merchant = pickRandom(template.merchants);
            transactionValues.push({
              id: uuid(),
              userId,
              accountId: creditCardId,
              categoryId: categoryMap.get(template.category) || null,
              amount: randomBetween(template.minAmount, template.maxAmount),
              name: `${template.namePrefix} - ${merchant}`,
              merchantName: merchant,
              date: formatDate(txDate),
              pending: false,
              isManual: true,
              categorizationSource: 'manual',
            });
          }
        }
      }
    }

    // Insert transactions in batches of 50
    let insertedCount = 0;
    const batchSize = 50;
    for (let i = 0; i < transactionValues.length; i += batchSize) {
      const batch = transactionValues.slice(i, i + batchSize);
      await db.insert(transactions).values(batch);
      insertedCount += batch.length;
    }
    console.log(`  Generated ${insertedCount} transactions across the last 6 months`);

    // ── 5. Create budgets ────────────────────────────────────────
    console.log('[5/8] Creating budgets...');

    const budgetDefs = [
      { name: 'Groceries', categoryName: 'Groceries', amount: 600, period: 'monthly' as const },
      { name: 'Dining Out', categoryName: 'Dining', amount: 300, period: 'monthly' as const },
      { name: 'Shopping', categoryName: 'Shopping', amount: 200, period: 'monthly' as const },
      {
        name: 'Transportation',
        categoryName: 'Transportation',
        amount: 250,
        period: 'monthly' as const,
      },
    ];

    for (const def of budgetDefs) {
      await db.insert(budgets).values({
        id: uuid(),
        userId,
        categoryId: categoryMap.get(def.categoryName) || null,
        name: def.name,
        budgetType: 'category',
        amount: def.amount,
        period: def.period,
        rollover: false,
        isActive: true,
        alertThresholds: JSON.stringify([50, 75, 90, 100]),
      });
      console.log(`  Created budget: ${def.name} - $${def.amount}/mo`);
    }

    // ── 6. Create savings goals ──────────────────────────────────
    console.log('[6/8] Creating savings goals...');

    const emergencyFundId = uuid();
    const vacationId = uuid();

    await db.insert(savingsGoals).values([
      {
        id: emergencyFundId,
        userId,
        name: 'Emergency Fund',
        targetAmount: 20000,
        currentAmount: 12000,
        deadline: formatDate(new Date(now.getFullYear() + 1, 5, 30)),
        icon: 'shield',
        color: '#22c55e',
        isCompleted: false,
      },
      {
        id: vacationId,
        userId,
        name: 'Vacation Fund',
        targetAmount: 3000,
        currentAmount: 800,
        deadline: formatDate(new Date(now.getFullYear(), 11, 15)),
        icon: 'plane',
        color: '#06b6d4',
        isCompleted: false,
      },
    ]);

    // Add a few contributions to show history
    const contributionValues = [];
    for (let i = 5; i >= 0; i--) {
      const contribDate = new Date(now.getFullYear(), now.getMonth() - i, 20);
      if (contribDate <= now) {
        contributionValues.push({
          id: uuid(),
          goalId: emergencyFundId,
          amount: 500,
          note: 'Monthly contribution',
          date: formatDate(contribDate),
        });
        if (i <= 3) {
          contributionValues.push({
            id: uuid(),
            goalId: vacationId,
            amount: 200,
            note: 'Monthly contribution',
            date: formatDate(contribDate),
          });
        }
      }
    }
    await db.insert(savingsContributions).values(contributionValues);

    console.log('  Created: Emergency Fund ($20,000 target, $12,000 current)');
    console.log('  Created: Vacation Fund ($3,000 target, $800 current)');

    // ── 7. Create notification preferences ───────────────────────
    console.log('[7/8] Creating notification preferences...');

    await db.insert(notificationPreferences).values({
      id: uuid(),
      userId,
      emailBillReminders: 1,
      emailBudgetAlerts: 1,
      emailAnomalies: 1,
      emailWeeklyDigest: 1,
      billReminderDaysBefore: 3,
    });
    console.log('  All email notifications enabled, bill reminders: 3 days before');

    // ── 8. Create user preferences ───────────────────────────────
    console.log('[8/8] Creating user preferences...');

    await db.insert(userPreferences).values({
      id: uuid(),
      userId,
      currency: 'USD',
      dateFormat: 'MM/DD/YYYY',
      theme: 'dark',
      notifications: JSON.stringify({
        push: true,
        email: true,
        sms: false,
      }),
    });
    console.log('  Currency: USD, Theme: dark');

    // ── Create recurring transaction records ─────────────────────
    const recurringDefs = MONTHLY_BILLS.map((bill) => ({
      id: uuid(),
      userId,
      accountId:
        bill.name === 'Rent Payment' || bill.name === 'Auto Loan Payment'
          ? checkingId
          : creditCardId,
      categoryId: categoryMap.get(bill.category) || null,
      name: bill.name,
      merchantName: bill.merchant,
      estimatedAmount: bill.amount,
      frequency: 'monthly' as const,
      nextExpectedDate: formatDate(
        new Date(now.getFullYear(), now.getMonth() + 1, bill.dayOfMonth),
      ),
      isActive: true,
      isConfirmed: true,
    }));

    await db.insert(recurringTransactions).values(recurringDefs);

    // ── Summary ──────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n==========================================');
    console.log('Seed Summary');
    console.log('==========================================');
    console.log(`  User:             1 (demo@financeowl.com)`);
    console.log(`  Categories:       ${SYSTEM_CATEGORIES.length}`);
    console.log(`  Bank Accounts:    3`);
    console.log(`  Transactions:     ${insertedCount}`);
    console.log(`  Recurring Bills:  ${MONTHLY_BILLS.length}`);
    console.log(`  Budgets:          ${budgetDefs.length}`);
    console.log(`  Savings Goals:    2`);
    console.log(`  Contributions:    ${contributionValues.length}`);
    console.log(`  Duration:         ${elapsed}s`);
    console.log('==========================================\n');
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
