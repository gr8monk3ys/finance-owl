import { pgTable, text, real, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const exchangeRates = pgTable('exchange_rates', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  baseCurrency: text('base_currency').notNull(),
  targetCurrency: text('target_currency').notNull(),
  rate: real('rate').notNull(),
  source: text('source'),
  fetchedAt: text('fetched_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userCurrencyPreferences = pgTable('user_currency_preferences', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  defaultCurrency: text('default_currency').notNull().default('USD'),
  displayFormat: text('display_format').notNull().default('symbol'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
