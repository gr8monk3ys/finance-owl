import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const dataDeletionRequests = pgTable('data_deletion_requests', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending, confirmed, processing, completed
  reason: text('reason'),
  scheduledAt: text('scheduled_at'),
  completedAt: text('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
