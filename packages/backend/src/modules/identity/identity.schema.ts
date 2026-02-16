import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const breachChecks = pgTable('breach_checks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  lastCheckedAt: text('last_checked_at')
    .notNull()
    .default('now()'),
  totalBreaches: integer('total_breaches').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const breaches = pgTable('breaches', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  checkId: text('check_id')
    .notNull()
    .references(() => breachChecks.id, { onDelete: 'cascade' }),
  breachName: text('breach_name').notNull(),
  breachDate: text('breach_date').notNull(),
  breachDescription: text('breach_description').notNull(),
  dataClasses: text('data_classes').notNull(), // JSON array of exposed data types
  isVerified: integer('is_verified').notNull().default(1),
  isSensitive: integer('is_sensitive').notNull().default(0),
  isAcknowledged: integer('is_acknowledged').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const passwordExposures = pgTable('password_exposures', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  checkId: text('check_id')
    .notNull()
    .references(() => breachChecks.id, { onDelete: 'cascade' }),
  passwordPrefix: text('password_prefix').notNull(), // first 5 chars of SHA1 hash only
  exposureCount: integer('exposure_count').notNull(),
  checkedAt: text('checked_at')
    .notNull()
    .default('now()'),
});
