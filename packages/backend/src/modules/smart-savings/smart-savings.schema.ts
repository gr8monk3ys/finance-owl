import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const savingsRules = pgTable('savings_rules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(), // 'round_up', 'percentage', 'fixed', 'surplus'
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>(), // for fixed/percentage rules
  roundUpTo: numeric('round_up_to', { precision: 19, scale: 4 }).$type<number>(), // nearest 1, 5, 10
  sourceAccountId: text('source_account_id'),
  targetGoalId: text('target_goal_id'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const savingsTransfers = pgTable('savings_transfers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id')
    .notNull()
    .references(() => savingsRules.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  calculatedFrom: text('calculated_from'), // description of what triggered it
  status: text('status').notNull().default('pending'), // 'pending', 'completed', 'skipped'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const savingsAnalysis = pgTable('savings_analysis', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  averageMonthlyIncome: numeric('average_monthly_income', { precision: 19, scale: 4 }).$type<number>().notNull(),
  averageMonthlyExpenses: numeric('average_monthly_expenses', { precision: 19, scale: 4 }).$type<number>().notNull(),
  averageSurplus: numeric('average_surplus', { precision: 19, scale: 4 }).$type<number>().notNull(),
  recommendedSavingsRate: real('recommended_savings_rate').notNull(),
  currentSavingsRate: real('current_savings_rate').notNull(),
  analysisDate: text('analysis_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
