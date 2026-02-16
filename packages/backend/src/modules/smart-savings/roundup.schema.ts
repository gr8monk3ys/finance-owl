import { pgTable, text, real, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const roundUpConfigs = pgTable('round_up_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  roundTo: numeric('round_to', { precision: 19, scale: 4 }).$type<number>().notNull().default(1), // round to nearest $1, $5, $10
  multiplier: real('multiplier').notNull().default(1), // 1x, 2x, 3x round-ups
  savingsGoalId: text('savings_goal_id'), // which goal to contribute to
  maxDailyRoundUp: numeric('max_daily_round_up', { precision: 19, scale: 4 }).$type<number>().default(10),
  accountId: text('account_id'), // which account to watch for transactions
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const roundUpTransactions = pgTable('round_up_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').notNull(),
  originalAmount: numeric('original_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  roundedAmount: numeric('rounded_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  roundUpAmount: numeric('round_up_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  status: text('status').notNull().default('pending'), // pending, processed, skipped
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
