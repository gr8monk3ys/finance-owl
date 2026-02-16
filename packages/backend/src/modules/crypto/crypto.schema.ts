import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const cryptoHoldings = pgTable('crypto_holdings', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(), // BTC, ETH, SOL, etc.
  name: text('name').notNull(), // Bitcoin, Ethereum, Solana, etc.
  quantity: numeric('quantity', { precision: 19, scale: 4 }).$type<number>().notNull(),
  averageCostBasis: numeric('average_cost_basis', { precision: 19, scale: 4 }).$type<number>().notNull(),
  currentPrice: numeric('current_price', { precision: 19, scale: 4 }).$type<number>(),
  lastPriceUpdate: text('last_price_update'),
  exchange: text('exchange'), // coinbase, binance, kraken, manual
  walletAddress: text('wallet_address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const cryptoTransactions = pgTable('crypto_transactions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  holdingId: text('holding_id')
    .notNull()
    .references(() => cryptoHoldings.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // buy, sell, transfer, staking_reward, airdrop
  quantity: numeric('quantity', { precision: 19, scale: 4 }).$type<number>().notNull(),
  pricePerUnit: numeric('price_per_unit', { precision: 19, scale: 4 }).$type<number>().notNull(),
  totalValue: numeric('total_value', { precision: 19, scale: 4 }).$type<number>().notNull(),
  fee: numeric('fee', { precision: 19, scale: 4 }).$type<number>(),
  date: text('date').notNull(),
  exchange: text('exchange'),
  txHash: text('tx_hash'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const cryptoWatchlist = pgTable('crypto_watchlist', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  addedAt: text('added_at')
    .notNull()
    .default('now()'),
});
