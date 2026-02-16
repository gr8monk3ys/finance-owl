import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';
import { accounts } from '../../database/schema/accounts';

export const importHistory = pgTable('import_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // csv, ofx, qfx
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  totalRows: integer('total_rows').notNull().default(0),
  importedCount: integer('imported_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  duplicateCount: integer('duplicate_count').notNull().default(0),
  columnMapping: text('column_mapping'), // JSON string
  importedAt: text('imported_at')
    .notNull()
    .default('now()'),
});
