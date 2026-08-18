import { pgTable, text, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const plaidItems = pgTable('plaid_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plaidItemId: text('plaid_item_id').notNull().unique(),
  accessToken: text('access_token').notNull(), // AES-256-GCM encrypted
  institutionId: text('institution_id'),
  institutionName: text('institution_name'),
  cursor: text('cursor'), // for transaction sync
  status: text('status').notNull().default('active'), // active, error, login_required
  errorCode: text('error_code'),
  consentExpiresAt: text('consent_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  plaidItemId: text('plaid_item_id').references(() => plaidItems.id, {
    onDelete: 'set null',
  }),
  plaidAccountId: text('plaid_account_id'),
  name: text('name').notNull(),
  officialName: text('official_name'),
  type: text('type').notNull(), // checking, savings, credit_card, investment, loan, mortgage, other
  subtype: text('subtype'),
  institutionName: text('institution_name'),
  mask: text('mask'), // last 4 digits
  currentBalance: numeric('current_balance', { precision: 19, scale: 4 })
    .$type<number>()
    .default(0),
  availableBalance: numeric('available_balance', { precision: 19, scale: 4 }).$type<number>(),
  creditLimit: numeric('credit_limit', { precision: 19, scale: 4 }).$type<number>(),
  currency: text('currency').notNull().default('USD'),
  isManual: boolean('is_manual').notNull().default(false),
  isHidden: boolean('is_hidden').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
