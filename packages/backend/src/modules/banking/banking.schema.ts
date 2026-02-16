import {
  pgTable,
  text,
  real,
  numeric,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

/**
 * Banking accounts opened through BaaS providers (Unit, Treasury Prime).
 * These are real deposit accounts with routing/account numbers.
 */
export const bankingAccounts = pgTable('banking_accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** BaaS provider name ('unit' | 'treasury_prime'). */
  provider: text('provider').notNull(),
  /** Provider-side account identifier. */
  externalAccountId: text('external_account_id').notNull().unique(),
  /** Account type: 'checking' or 'savings'. */
  type: text('type').notNull(), // 'checking' | 'savings'
  /** ABA routing number. */
  routingNumber: text('routing_number'),
  /** Encrypted full account number (AES-256-GCM). */
  accountNumber: text('account_number'), // encrypted at rest
  /** Masked account number (last 4 digits). */
  accountNumberMask: text('account_number_mask'),
  /** Current balance in cents. */
  balance: numeric('balance', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  /** Current interest rate (decimal, e.g. 0.045). */
  interestRate: real('interest_rate').default(0),
  /** Annual percentage yield (decimal). */
  apy: real('apy').default(0),
  /** Account status. */
  status: text('status').notNull().default('pending'), // 'pending' | 'active' | 'frozen' | 'closed'
  /** Whether FDIC insured (up to $250k). */
  fdicInsured: boolean('fdic_insured').notNull().default(true),
  /** Name of the partner bank. */
  bankName: text('bank_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Transfers between banking accounts or to/from external accounts.
 */
export const bankingTransfers = pgTable('banking_transfers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Source banking account (internal). */
  fromAccountId: text('from_account_id').references(() => bankingAccounts.id, {
    onDelete: 'set null',
  }),
  /** Destination banking account (internal, null for external). */
  toAccountId: text('to_account_id').references(() => bankingAccounts.id, {
    onDelete: 'set null',
  }),
  /** Transfer amount in cents. */
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  /** Transfer memo / description. */
  memo: text('memo'),
  /** Transfer status. */
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed' | 'returned'
  /** Provider-side transfer identifier. */
  externalTransferId: text('external_transfer_id'),
  /** Estimated arrival date (ISO string). */
  estimatedArrival: text('estimated_arrival'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

/**
 * Interest payments credited to banking accounts.
 */
export const interestPayments = pgTable('interest_payments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** Banking account that earned the interest. */
  bankingAccountId: text('banking_account_id')
    .notNull()
    .references(() => bankingAccounts.id, { onDelete: 'cascade' }),
  /** Interest amount in cents. */
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  /** Period covered (e.g. '2026-01', '2026-Q1'). */
  period: text('period').notNull(),
  /** When the interest was paid/credited. */
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
