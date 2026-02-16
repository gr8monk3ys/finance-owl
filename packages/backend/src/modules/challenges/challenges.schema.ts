import { pgTable, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const challenges = pgTable('challenges', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // no_spend, round_up, 52_week, penny, custom
  name: text('name').notNull(),
  description: text('description'),
  targetAmount: numeric('target_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  currentAmount: numeric('current_amount', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('active'), // active, completed, abandoned
  streakDays: integer('streak_days').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const challengeEntries = pgTable('challenge_entries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  challengeId: text('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  date: text('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
