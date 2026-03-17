import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const emailQueue = pgTable('email_queue', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
});
