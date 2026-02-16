import { pgTable, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const unclaimedSearches = pgTable('unclaimed_searches', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  state: text('state').notNull(),
  lastSearchedAt: text('last_searched_at')
    .notNull()
    .default('now()'),
  resultsCount: integer('results_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const unclaimedResults = pgTable('unclaimed_results', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  searchId: text('search_id')
    .notNull()
    .references(() => unclaimedSearches.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  propertyType: text('property_type').notNull(), // 'bank_account' | 'insurance' | 'utility_deposit' | 'tax_refund' | 'payroll' | 'other'
  holderName: text('holder_name').notNull(),
  reportedAmount: numeric('reported_amount', { precision: 19, scale: 4 }).$type<number>(),
  state: text('state').notNull(),
  sourceUrl: text('source_url').notNull(),
  claimUrl: text('claim_url'),
  status: text('status').notNull().default('found'), // 'found' | 'claimed' | 'dismissed'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
