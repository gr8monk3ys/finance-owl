import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const dashboardLayouts = pgTable('dashboard_layouts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  widgets: text('widgets').notNull(), // JSON text - array of widget configs
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
