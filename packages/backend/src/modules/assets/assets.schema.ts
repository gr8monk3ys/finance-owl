import { pgTable, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';
import { accounts } from '../../database/schema/accounts';

export const properties = pgTable('properties', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  propertyType: text('property_type').notNull().default('primary_residence'), // primary_residence, rental, vacation, investment, land
  purchasePrice: numeric('purchase_price', { precision: 19, scale: 4 }).$type<number>(),
  purchaseDate: text('purchase_date'),
  currentValue: numeric('current_value', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  lastValuationDate: text('last_valuation_date'),
  valuationSource: text('valuation_source').default('manual'), // manual, zillow, estimate
  mortgageAccountId: text('mortgage_account_id').references(
    () => accounts.id,
    { onDelete: 'set null' },
  ),
  monthlyRent: numeric('monthly_rent', { precision: 19, scale: 4 }).$type<number>(),
  annualPropertyTax: numeric('annual_property_tax', { precision: 19, scale: 4 }).$type<number>(),
  annualInsurance: numeric('annual_insurance', { precision: 19, scale: 4 }).$type<number>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const vehicles = pgTable('vehicles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  trim: text('trim'),
  vin: text('vin'),
  mileage: integer('mileage'),
  condition: text('condition').notNull().default('good'), // excellent, good, fair, poor
  purchasePrice: numeric('purchase_price', { precision: 19, scale: 4 }).$type<number>(),
  purchaseDate: text('purchase_date'),
  currentValue: numeric('current_value', { precision: 19, scale: 4 }).$type<number>().notNull().default(0),
  lastValuationDate: text('last_valuation_date'),
  valuationSource: text('valuation_source').default('manual'), // manual, kbb, estimate
  loanAccountId: text('loan_account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
  monthlyPayment: numeric('monthly_payment', { precision: 19, scale: 4 }).$type<number>(),
  annualInsurance: numeric('annual_insurance', { precision: 19, scale: 4 }).$type<number>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const assetValueHistory = pgTable('asset_value_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  assetType: text('asset_type').notNull(), // property, vehicle
  assetId: text('asset_id').notNull(),
  value: numeric('value', { precision: 19, scale: 4 }).$type<number>().notNull(),
  date: text('date').notNull(),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
