import { pgTable, text, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const referralCodes = pgTable('referral_codes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  totalReferrals: integer('total_referrals').notNull().default(0),
  totalEarnings: numeric('total_earnings', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const referrals = pgTable('referrals', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  referrerId: text('referrer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  referredUserId: text('referred_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  referralCodeId: text('referral_code_id')
    .notNull()
    .references(() => referralCodes.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  rewardAmount: numeric('reward_amount', { precision: 19, scale: 4 }).$type<number>(),
  completedAt: text('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
