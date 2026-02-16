import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const categories = pgTable('categories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = system default
  parentId: text('parent_id'), // self-referencing for hierarchy
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  isSystem: boolean('is_system').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const categorizationRules = pgTable('categorization_rules', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  matchType: text('match_type').notNull(), // merchant, description, amount_range, regex
  matchValue: text('match_value').notNull(),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const categorizationCorrections = pgTable(
  'categorization_corrections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantName: text('merchant_name'),
    description: text('description'),
    fromCategoryId: text('from_category_id'),
    toCategoryId: text('to_category_id')
      .notNull()
      .references(() => categories.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
);
