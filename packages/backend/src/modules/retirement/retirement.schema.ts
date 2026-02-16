import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const retirementProfiles = pgTable('retirement_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentAge: integer('current_age').notNull().default(30),
  retirementAge: integer('retirement_age').notNull().default(65),
  currentSavings: numeric('current_savings', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  monthlyContribution: numeric('monthly_contribution', { precision: 19, scale: 4 }).$type<number>().notNull().default(500),
  employerMatch: numeric('employer_match', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  expectedReturn: real('expected_return').notNull().default(7),
  inflationRate: real('inflation_rate').notNull().default(3),
  desiredMonthlyIncome: numeric('desired_monthly_income', { precision: 19, scale: 4 }).$type<number>().notNull().default(5000),
  socialSecurityEstimate: numeric('social_security_estimate', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  pensionAmount: numeric('pension_amount', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  riskTolerance: text('risk_tolerance').notNull().default('moderate'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
