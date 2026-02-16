import { pgTable, text, numeric, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const vehicles = pgTable('vehicles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  trim: text('trim'),
  vin: text('vin'),
  mileage: integer('mileage'),
  condition: text('condition').notNull().default('good'), // excellent, good, fair, poor
  purchasePrice: numeric('purchase_price', { precision: 19, scale: 4 }).$type<number>(),
  purchaseDate: text('purchase_date'),
  currentEstimate: numeric('current_estimate', { precision: 19, scale: 4 }).$type<number>(),
  lastEstimateDate: text('last_estimate_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const vehicleValueHistory = pgTable('vehicle_value_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vehicleId: text('vehicle_id')
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  estimatedValue: numeric('estimated_value', { precision: 19, scale: 4 }).$type<number>().notNull(),
  source: text('source').notNull(),
  mileageAtEstimate: integer('mileage_at_estimate'),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
