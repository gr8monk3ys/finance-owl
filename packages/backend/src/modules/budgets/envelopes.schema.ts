import { pgTable, text, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';
import { categories } from '../../database/schema/categories';
import { transactions } from '../../database/schema/transactions';

// Envelopes for zero-based / envelope budgeting
export const envelopes = pgTable('envelopes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  budgetedAmount: numeric('budgeted_amount', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  spentAmount: numeric('spent_amount', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  categoryId: text('category_id').references(() => categories.id),
  color: text('color'),
  icon: text('icon'),
  rollover: boolean('rollover').notNull().default(false),
  isGoal: boolean('is_goal').notNull().default(false),
  targetAmount: numeric('target_amount', { precision: 19, scale: 4 }).$type<number>(),
  period: text('period').notNull().default('monthly'), // monthly, weekly, yearly
  periodStart: timestamp('period_start').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Links transactions to envelopes
export const envelopeTransactions = pgTable('envelope_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  envelopeId: text('envelope_id')
    .notNull()
    .references(() => envelopes.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').references(() => transactions.id),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  type: text('type').notNull(), // allocation, spend, transfer
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
