import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const negotiationAttempts = pgTable('negotiation_attempts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  billId: text('bill_id'),
  provider: text('provider').notNull(),
  billType: text('bill_type').notNull(), // 'internet', 'cable', 'phone', 'insurance', 'medical', 'utility', 'streaming', 'other'
  originalAmount: numeric('original_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  targetAmount: numeric('target_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  negotiatedAmount: numeric('negotiated_amount', { precision: 19, scale: 4 }).$type<number>(),
  status: text('status').notNull().default('planned'), // 'planned', 'in_progress', 'succeeded', 'failed', 'pending_confirmation'
  method: text('method').notNull().default('phone'), // 'phone', 'email', 'chat', 'in_person'
  notes: text('notes'),
  startedAt: text('started_at')
    .notNull()
    .default('now()'),
  completedAt: text('completed_at'),
  annualSavings: numeric('annual_savings', { precision: 19, scale: 4 }).$type<number>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const negotiationScriptsStore = pgTable('negotiation_scripts_store', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text('provider').notNull(),
  billType: text('bill_type').notNull(),
  script: text('script').notNull(), // JSON string with steps
  tips: text('tips').notNull(), // JSON array of tips
  bestTimeToCall: text('best_time_to_call'),
  retentionNumber: text('retention_number'),
  successRate: real('success_rate').notNull().default(50),
  avgSavingsPercent: real('avg_savings_percent').notNull().default(15),
  isSystem: integer('is_system').notNull().default(1), // boolean: 1 = system-provided, 0 = user-created
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
