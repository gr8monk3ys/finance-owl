import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const debts = pgTable('debts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull().default('other'),
  currentBalance: numeric('current_balance', { precision: 19, scale: 4 }).$type<number>().notNull(),
  interestRate: real('interest_rate').notNull(),
  minimumPayment: numeric('minimum_payment', { precision: 19, scale: 4 }).$type<number>().notNull(),
  originalBalance: numeric('original_balance', { precision: 19, scale: 4 }).$type<number>(),
  lender: text('lender'),
  dueDay: integer('due_day'),
  isPaidOff: integer('is_paid_off').notNull().default(0),
  paidOffDate: text('paid_off_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const debtPayments = pgTable('debt_payments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  debtId: text('debt_id')
    .notNull()
    .references(() => debts.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  date: text('date').notNull(),
  principal: numeric('principal', { precision: 19, scale: 4 }).$type<number>(),
  interest: numeric('interest', { precision: 19, scale: 4 }).$type<number>(),
  balanceAfter: numeric('balance_after', { precision: 19, scale: 4 }).$type<number>(),
  isExtra: integer('is_extra').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
