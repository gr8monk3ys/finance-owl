import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const communityPosts = pgTable('community_posts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(),
  likesCount: integer('likes_count').notNull().default(0),
  repliesCount: integer('replies_count').notNull().default(0),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const postLikes = pgTable('post_likes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  postId: text('post_id')
    .notNull()
    .references(() => communityPosts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const postReplies = pgTable('post_replies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  postId: text('post_id')
    .notNull()
    .references(() => communityPosts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  likesCount: integer('likes_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
