import { pgTable, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const yearReviews = pgTable('year_reviews', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  totalIncome: numeric('total_income', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  totalSpending: numeric('total_spending', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  totalSaved: numeric('total_saved', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  topCategory: text('top_category'),
  topMerchant: text('top_merchant'),
  transactionCount: integer('transaction_count').notNull().default(0),
  averageTransaction: numeric('average_transaction', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  biggestPurchase: numeric('biggest_purchase', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  biggestPurchaseDescription: text('biggest_purchase_description'),
  monthlyBreakdown: text('monthly_breakdown'), // JSON string
  categoryBreakdown: text('category_breakdown'), // JSON string
  generatedAt: text('generated_at')
    .notNull()
    .default('now()'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
