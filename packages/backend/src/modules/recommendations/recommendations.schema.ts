import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const productRecommendations = pgTable('product_recommendations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productType: text('product_type').notNull(), // 'credit_card' | 'savings_account' | 'checking_account' | 'personal_loan' | 'auto_loan' | 'mortgage' | 'investment_account'
  productName: text('product_name').notNull(),
  provider: text('provider').notNull(),
  description: text('description').notNull(),
  annualFee: numeric('annual_fee', { precision: 19, scale: 4 }).$type<number>(),
  interestRate: real('interest_rate'),
  rewardType: text('reward_type'), // 'cashback' | 'points' | 'miles'
  matchScore: integer('match_score').notNull(), // 0-100
  matchReason: text('match_reason').notNull(),
  applyUrl: text('apply_url'),
  isActive: integer('is_active').notNull().default(1),
  isDismissed: integer('is_dismissed').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
