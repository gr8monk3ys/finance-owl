import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const creditScores = pgTable('credit_scores', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  source: text('source').notNull(), // 'manual' | 'transunion' | 'equifax' | 'experian'
  scoreType: text('score_type').notNull(), // 'vantage3' | 'fico8' | 'fico9'
  reportDate: text('report_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const creditFactors = pgTable('credit_factors', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scoreId: text('score_id')
    .notNull()
    .references(() => creditScores.id, { onDelete: 'cascade' }),
  factor: text('factor').notNull(), // 'payment_history' | 'credit_utilization' | 'credit_age' | 'total_accounts' | 'hard_inquiries' | 'derogatory_marks'
  value: text('value').notNull(),
  impact: text('impact').notNull(), // 'high' | 'medium' | 'low'
  status: text('status').notNull(), // 'good' | 'fair' | 'poor' | 'needs_work'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const creditAlerts = pgTable('credit_alerts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  alertType: text('alert_type').notNull(), // 'score_change' | 'new_account' | 'hard_inquiry' | 'derogatory_mark'
  description: text('description').notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  isRead: integer('is_read').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
