import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';
import { recurringTransactions } from '../../database/schema/budgets';

export const cancellationRequests = pgTable('cancellation_requests', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id')
    .notNull()
    .references(() => recurringTransactions.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, failed
  method: text('method').notNull().default('self_service'), // self_service, email, phone, chat
  cancellationInstructions: text('cancellation_instructions'), // AI-generated instructions
  providerContactInfo: text('provider_contact_info'), // JSON: { phone, email, website, chatUrl }
  cancellationConfirmedAt: text('cancellation_confirmed_at'),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
