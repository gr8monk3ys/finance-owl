import { pgTable, text, real, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const benchmarkProfiles = pgTable('benchmark_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ageRange: text('age_range').notNull(), // 18-24, 25-34, 35-44, 45-54, 55-64, 65+
  incomeRange: text('income_range').notNull(), // under_25k, 25k_50k, 50k_75k, 75k_100k, 100k_150k, 150k_plus
  region: text('region'),
  householdSize: integer('household_size').notNull().default(1),
  isOptedIn: boolean('is_opted_in').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const benchmarkData = pgTable('benchmark_data', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  category: text('category').notNull(),
  ageRange: text('age_range').notNull(),
  incomeRange: text('income_range').notNull(),
  averageSpending: numeric('average_spending', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  averageSavingsRate: real('average_savings_rate').notNull().default(0),
  averageDebtRatio: real('average_debt_ratio').notNull().default(0),
  sampleSize: integer('sample_size').notNull().default(0),
  period: text('period').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
