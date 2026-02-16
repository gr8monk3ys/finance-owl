import { pgTable, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';
import { transactions } from '../../database/schema/transactions';

export const receipts = pgTable('receipts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').references(() => transactions.id, {
    onDelete: 'set null',
  }),
  imagePath: text('image_path').notNull(),
  merchantName: text('merchant_name'),
  totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).$type<number>(),
  date: text('date'),
  items: text('items'), // JSON text - array of line items
  status: text('status').notNull().default('pending'), // pending | processed | failed
  ocrRawText: text('ocr_raw_text'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
