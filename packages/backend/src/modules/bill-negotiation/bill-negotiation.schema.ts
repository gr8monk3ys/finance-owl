import { pgTable, text, real, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const billNegotiations = pgTable('bill_negotiations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  billName: text('bill_name').notNull(),
  provider: text('provider').notNull(),
  currentAmount: numeric('current_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  targetAmount: numeric('target_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  category: text('category').notNull(), // internet, cable, phone, insurance, streaming, utilities, other
  status: text('status').notNull().default('pending'), // pending, in_progress, success, failed, skipped
  negotiatedAmount: numeric('negotiated_amount', { precision: 19, scale: 4 }).$type<number>(),
  annualSavings: numeric('annual_savings', { precision: 19, scale: 4 }).$type<number>(),
  method: text('method').notNull().default('self_service'), // self_service, script
  negotiationDate: text('negotiation_date'),
  expirationDate: text('expiration_date'), // when promotional rate expires
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const negotiationScripts = pgTable('negotiation_scripts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text('provider').notNull(),
  category: text('category').notNull(),
  scriptTemplate: text('script_template').notNull(),
  tips: text('tips').notNull(), // JSON array of tips
  averageSavingsPercent: real('average_savings_percent').notNull(),
  successRate: real('success_rate').notNull(),
  lastUpdated: text('last_updated')
    .notNull()
    .default('now()'),
});
