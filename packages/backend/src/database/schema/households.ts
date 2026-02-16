import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';
import { transactions } from './transactions';

export const households = pgTable('households', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  inviteCode: text('invite_code'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const householdMembers = pgTable('household_members', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] })
    .notNull()
    .default('viewer'),
  joinedAt: text('joined_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sharedAccounts = pgTable('shared_accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  sharedBy: text('shared_by')
    .notNull()
    .references(() => users.id),
  sharedAt: text('shared_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const transactionFlags = pgTable('transaction_flags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id),
  flaggedBy: text('flagged_by')
    .notNull()
    .references(() => users.id),
  reason: text('reason'),
  status: text('status', { enum: ['open', 'resolved'] })
    .notNull()
    .default('open'),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
