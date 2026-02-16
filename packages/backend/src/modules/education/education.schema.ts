import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const articleProgress = pgTable('article_progress', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  articleSlug: text('article_slug').notNull(),
  readAt: text('read_at')
    .notNull()
    .default('now()'),
  isBookmarked: integer('is_bookmarked').notNull().default(0),
});
