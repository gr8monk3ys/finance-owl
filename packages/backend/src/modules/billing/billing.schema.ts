import { pgTable, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(), // 'free', 'premium', 'family'
  stripePriceId: text('stripe_price_id'),
  stripeProductId: text('stripe_product_id'),
  monthlyPrice: numeric('monthly_price', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull()
    .default(0),
  yearlyPrice: numeric('yearly_price', { precision: 19, scale: 4 })
    .$type<number>()
    .notNull()
    .default(0),
  features: text('features').notNull().default('[]'), // JSON array of feature strings
  isActive: integer('is_active').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const billingCustomers = pgTable('billing_customers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  plan: text('plan').notNull().default('free'), // 'free', 'premium', 'family'
  status: text('status').notNull().default('active'), // 'active', 'past_due', 'canceled', 'trialing'
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  currency: text('currency').notNull().default('usd'),
  status: text('status').notNull(), // 'paid', 'open', 'void', 'uncollectible', 'draft'
  description: text('description'),
  invoiceUrl: text('invoice_url'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const usageTracking = pgTable('usage_tracking', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(), // 'linked_accounts', 'api_calls', etc.
  count: integer('count').notNull().default(0),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
