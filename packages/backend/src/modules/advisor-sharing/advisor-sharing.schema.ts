import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const advisorShares = pgTable('advisor_shares', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  advisorEmail: text('advisor_email').notNull(),
  advisorName: text('advisor_name').notNull(),
  token: text('token').notNull().unique(),
  permissions: text('permissions').notNull(),
  expiresAt: text('expires_at'),
  lastAccessedAt: text('last_accessed_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const advisorAccessLogs = pgTable('advisor_access_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  shareId: text('share_id')
    .notNull()
    .references(() => advisorShares.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  ipAddress: text('ip_address'),
  accessedAt: text('accessed_at')
    .notNull()
    .default('now()'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
