import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const creditProfiles = pgTable('credit_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentScore: integer('current_score').notNull(),
  scoreDate: text('score_date').notNull(),
  paymentHistory: real('payment_history').notNull(), // 0-1 ratio
  creditUtilization: real('credit_utilization').notNull(), // 0-1 ratio
  accountAge: integer('account_age').notNull(), // months
  totalAccounts: integer('total_accounts').notNull(),
  hardInquiries: integer('hard_inquiries').notNull(),
  derogatoryMarks: integer('derogatory_marks').notNull(),
  totalDebt: numeric('total_debt', { precision: 19, scale: 4 }).$type<number>().notNull(),
  availableCredit: numeric('available_credit', { precision: 19, scale: 4 }).$type<number>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const creditSimulations = pgTable('credit_simulations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  profileId: text('profile_id')
    .notNull()
    .references(() => creditProfiles.id, { onDelete: 'cascade' }),
  scenarioType: text('scenario_type').notNull(), // pay_debt, open_card, close_card, hard_inquiry, on_time_payments, increase_limit
  parameters: text('parameters').notNull(), // JSON string
  estimatedImpact: integer('estimated_impact').notNull(), // point change (+/-)
  estimatedNewScore: integer('estimated_new_score').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
