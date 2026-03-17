import { pgTable, text, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const taxDocuments = pgTable('tax_documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  type: text('type').notNull(), // w2, 1099, 1098, charitable, medical, business
  description: text('description'),
  amount: numeric('amount', { precision: 19, scale: 4 }).$type<number>().notNull(),
  isDeductible: boolean('is_deductible').notNull().default(false),
  category: text('category'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const taxSummaries = pgTable('tax_summaries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  estimatedIncome: numeric('estimated_income', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  estimatedDeductions: numeric('estimated_deductions', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  estimatedTaxableIncome: numeric('estimated_taxable_income', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  estimatedFederalTax: numeric('estimated_federal_tax', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  estimatedStateTax: numeric('estimated_state_tax', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  filingStatus: text('filing_status').notNull().default('single'), // single, married_joint, married_separate, head_of_household
  state: text('state'), // 2-letter US state code (e.g. CA, TX, NY)
  generatedAt: text('generated_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
