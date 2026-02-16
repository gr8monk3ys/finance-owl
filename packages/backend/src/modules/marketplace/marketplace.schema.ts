import { pgTable, text, real, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const financialProducts = pgTable('financial_products', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  category: text('category').notNull(), // credit_card, savings_account, cd, loan, insurance, investment
  description: text('description'),
  annualFee: numeric('annual_fee', { precision: 19, scale: 4 }).$type<number>(),
  interestRate: real('interest_rate'),
  rewardRate: real('reward_rate'),
  signupBonus: text('signup_bonus'),
  terms: text('terms'),
  affiliateUrl: text('affiliate_url'),
  isActive: boolean('is_active').notNull().default(true),
  rating: real('rating'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const productClicks = pgTable('product_clicks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => financialProducts.id, { onDelete: 'cascade' }),
  clickedAt: text('clicked_at')
    .notNull()
    .default('now()'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
