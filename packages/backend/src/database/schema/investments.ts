import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';

export const securities = pgTable('securities', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  plaidSecurityId: text('plaid_security_id').unique(),
  tickerSymbol: text('ticker_symbol'),
  name: text('name').notNull(),
  type: text('type'), // equity, etf, mutual fund, bond, etc.
  closePrice: numeric('close_price', { precision: 19, scale: 4 }).$type<number>(),
  closePriceAsOf: text('close_price_as_of'),
  isin: text('isin'),
  cusip: text('cusip'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const investmentHoldings = pgTable('investment_holdings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  securityId: text('security_id')
    .notNull()
    .references(() => securities.id),
  quantity: numeric('quantity', { precision: 19, scale: 4 }).$type<number>().notNull(),
  costBasis: numeric('cost_basis', { precision: 19, scale: 4 }).$type<number>(),
  institutionValue: numeric('institution_value', { precision: 19, scale: 4 }).$type<number>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const securityPrices = pgTable('security_prices', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  securityId: text('security_id')
    .notNull()
    .references(() => securities.id, { onDelete: 'cascade' }),
  price: numeric('price', { precision: 19, scale: 4 }).$type<number>().notNull(),
  date: text('date').notNull(),
});

export const investmentTransactions = pgTable('investment_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  securityId: text('security_id').references(() => securities.id),
  plaidInvestmentTransactionId: text('plaid_investment_transaction_id').unique(),
  type: text('type').notNull(), // buy, sell, dividend, transfer, etc.
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  quantity: numeric('quantity', { precision: 19, scale: 4 }).$type<number>(),
  price: numeric('price', { precision: 19, scale: 4 }).$type<number>(),
  fees: numeric('fees', { precision: 19, scale: 4 }).$type<number>(),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
