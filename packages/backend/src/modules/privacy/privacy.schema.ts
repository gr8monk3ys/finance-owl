import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const privacyConsents = pgTable('privacy_consents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  consentType: text('consent_type').notNull(), // data_processing, marketing, analytics, third_party
  isGranted: boolean('is_granted').notNull().default(false),
  grantedAt: text('granted_at'),
  revokedAt: text('revoked_at'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const dataExportRequests = pgTable('data_export_requests', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending, processing, completed, expired
  format: text('format').notNull().default('json'), // json, csv
  downloadUrl: text('download_url'),
  expiresAt: text('expires_at'),
  completedAt: text('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
