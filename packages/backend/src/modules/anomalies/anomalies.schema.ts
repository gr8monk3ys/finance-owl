import {
  pgTable,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';
import { transactions } from '../../database/schema/transactions';

export const anomalies = pgTable('anomalies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: [
      'unusual_amount',
      'unusual_merchant',
      'unusual_timing',
      'duplicate_charge',
      'velocity_spike',
      'geographic_anomaly',
      'category_spending_spike',
      'recurring_charge_change',
    ],
  }).notNull(),
  severity: text('severity', {
    enum: ['info', 'warning', 'critical'],
  }).notNull(),
  status: text('status', {
    enum: ['active', 'dismissed', 'acknowledged', 'resolved'],
  })
    .notNull()
    .default('active'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 })
    .$type<number>()
    .notNull(),
  /**
   * JSON-encoded metadata specific to the anomaly type.
   * Examples:
   *  - unusual_amount: { zScore, mean, stdDev, categoryId }
   *  - duplicate_charge: { matchedTransactionId, timeDeltaMinutes }
   *  - velocity_spike: { windowMinutes, transactionCount, baseline }
   */
  metadata: text('metadata'),
  /** Primary transaction that triggered the anomaly */
  transactionId: text('transaction_id').references(() => transactions.id, {
    onDelete: 'set null',
  }),
  /**
   * JSON array of additional transaction IDs involved.
   * Used for duplicate charges or velocity spikes referencing multiple txns.
   */
  affectedTransactionIds: text('affected_transaction_ids'),
  dismissedAt: timestamp('dismissed_at'),
  dismissedReason: text('dismissed_reason'),
  acknowledgedAt: timestamp('acknowledged_at'),
  detectedAt: timestamp('detected_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
