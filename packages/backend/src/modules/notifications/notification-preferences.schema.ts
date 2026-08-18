import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../../database/schema/users';

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailBillReminders: integer('email_bill_reminders').notNull().default(1),
  emailBudgetAlerts: integer('email_budget_alerts').notNull().default(1),
  emailAnomalies: integer('email_anomalies').notNull().default(1),
  emailWeeklyDigest: integer('email_weekly_digest').notNull().default(1),
  billReminderDaysBefore: integer('bill_reminder_days_before').notNull().default(3),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
