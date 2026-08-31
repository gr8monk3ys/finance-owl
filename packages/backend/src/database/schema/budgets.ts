import {
  pgTable,
  text,
  numeric,
  boolean,
  timestamp,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';
import { categories } from './categories';
import { households } from './households';

// ── Budget periods enum ─────────────────────────────────────────────
// weekly | biweekly | monthly | quarterly | annual

// ── Budget types ────────────────────────────────────────────────────
// category  – tied to a specific category (and its children)
// overall   – tracks total spending across all categories

export const budgets = pgTable('budgets', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  householdId: text('household_id').references(() => households.id, {
    onDelete: 'set null',
  }),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'cascade',
  }),
  name: text('name'),
  budgetType: text('budget_type').notNull().default('category'), // 'category' | 'overall'
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  period: text('period').notNull(), // weekly, biweekly, monthly, quarterly, annual
  rollover: boolean('rollover').notNull().default(false),
  rolloverCap: numeric('rollover_cap', { precision: 19, scale: 4 }).$type<number>(),
  isActive: boolean('is_active').notNull().default(true),
  alertThresholds: text('alert_thresholds'), // JSON: [50, 75, 90, 100, 110]
  startDate: text('start_date'), // optional custom start date YYYY-MM-DD
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const budgetPeriods = pgTable('budget_periods', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  budgetId: text('budget_id')
    .notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  budgetedAmount: numeric('budgeted_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  spentAmount: numeric('spent_amount', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull()
    .default(0),
  rolloverAmount: numeric('rollover_amount', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull()
    .default(0),
});

export const budgetAlerts = pgTable('budget_alerts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  budgetId: text('budget_id')
    .notNull()
    .references(() => budgets.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  thresholdPercent: integer('threshold_percent').notNull(),
  actualPercent: numeric('actual_percent', { precision: 7, scale: 2 }).$type<number>().notNull(),
  periodStart: text('period_start').notNull(),
  acknowledged: boolean('acknowledged').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const recurringTransactions = pgTable('recurring_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  merchantName: text('merchant_name'),
  estimatedAmount: numeric('estimated_amount', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull(),
  frequency: text('frequency').notNull(), // weekly, biweekly, monthly, quarterly, annual
  nextExpectedDate: text('next_expected_date'),
  isActive: boolean('is_active').notNull().default(true),
  isConfirmed: boolean('is_confirmed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
