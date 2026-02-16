import { pgTable, text, real, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const properties = pgTable('properties', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  zipCode: text('zip_code').notNull(),
  propertyType: text('property_type').notNull().default('single_family'), // single_family, condo, townhouse, multi_family, land
  bedrooms: integer('bedrooms'),
  bathrooms: real('bathrooms'),
  squareFeet: integer('square_feet'),
  yearBuilt: integer('year_built'),
  purchasePrice: numeric('purchase_price', { precision: 19, scale: 4 }).$type<number>(),
  purchaseDate: text('purchase_date'),
  currentEstimate: numeric('current_estimate', { precision: 19, scale: 4 }).$type<number>(),
  lastEstimateDate: text('last_estimate_date'),
  zestimateUrl: text('zestimate_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const propertyValueHistory = pgTable('property_value_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  estimatedValue: numeric('estimated_value', { precision: 19, scale: 4 }).$type<number>().notNull(),
  source: text('source').notNull(),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
