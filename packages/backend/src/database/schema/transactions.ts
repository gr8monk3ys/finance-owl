import { pgTable, text, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';
import { categories } from './categories';

export const transactions = pgTable('transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  plaidTransactionId: text('plaid_transaction_id').unique(),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  name: text('name').notNull(),
  merchantName: text('merchant_name'),
  description: text('description'),
  date: text('date').notNull(), // YYYY-MM-DD
  authorizedDate: text('authorized_date'),
  pending: boolean('pending').notNull().default(false),
  notes: text('notes'),
  categorizationSource: text('categorization_source'), // user, rule, plaid, ai, manual
  isManual: boolean('is_manual').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const transactionSplits = pgTable('transaction_splits', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  note: text('note'),
  householdMemberId: text('household_member_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
