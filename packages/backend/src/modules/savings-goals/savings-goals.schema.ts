import { pgTable, text, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const savingsGoals = pgTable('savings_goals', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: numeric('target_amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  currentAmount: numeric('current_amount', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  deadline: text('deadline'),
  icon: text('icon'),
  color: text('color'),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: text('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const savingsContributions = pgTable('savings_contributions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  goalId: text('goal_id')
    .notNull()
    .references(() => savingsGoals.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  note: text('note'),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
