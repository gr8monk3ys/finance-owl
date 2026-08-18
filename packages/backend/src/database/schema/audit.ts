import { pgTable, text, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const auditLog = pgTable('audit_log', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details'), // JSON
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userPreferences = pgTable('user_preferences', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull().default('USD'),
  dateFormat: text('date_format').notNull().default('MM/DD/YYYY'),
  theme: text('theme').notNull().default('dark'),
  notifications: text('notifications'), // JSON preferences
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const netWorthHistory = pgTable('net_worth_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  assets: numeric('assets', { precision: 19, scale: 4 }).$type<number>().notNull(),
  liabilities: numeric('liabilities', { precision: 19, scale: 4 }).$type<number>().notNull(),
  netWorth: numeric('net_worth', { precision: 19, scale: 4 }).$type<number>().notNull(),
  accountCount: integer('account_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  severity: text('severity').notNull().default('info'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: text('data'), // JSON
  actionUrl: text('action_url'),
  read: boolean('read').notNull().default(false),
  deleted: boolean('deleted').notNull().default(false),
  readAt: timestamp('read_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
