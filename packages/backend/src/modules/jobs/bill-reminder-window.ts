/**
 * Decides which upcoming bills a user should be reminded about today.
 *
 * This arithmetic used to exist three times with three different answers:
 * the jobs processor honoured the user's `billReminderDaysBefore`, the
 * notification scheduler looked ahead a fixed seven days and then filtered,
 * and the trigger service re-read the preferences a third time to decide
 * whether to send at all. None of it could be tested without a Drizzle mock.
 *
 * It is now one pure function over rows and a clock, so the window rules —
 * inclusive of today, inclusive of the cutoff, silent on bills with no next
 * occurrence — are pinned by tests instead of by inspection.
 */

/** Default when a user has never touched their notification preferences. */
export const DEFAULT_BILL_REMINDER_DAYS_BEFORE = 3;

/** Upper bound on the window, so a bad preference row cannot spam a year ahead. */
export const MAX_BILL_REMINDER_DAYS_BEFORE = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BillReminderPreferences {
  /** How many days before the due date to start reminding. */
  readonly billReminderDaysBefore: number | null;
  /** Integer-as-boolean column: whether to also send email. */
  readonly emailBillReminders: number | boolean | null;
}

/** The recurring-transaction columns the window rules actually read. */
export interface UpcomingBill {
  readonly id: string;
  readonly name: string;
  readonly merchantName: string | null;
  readonly estimatedAmount: number;
  readonly frequency: string;
  /** `YYYY-MM-DD`, or null when the series has no known next occurrence. */
  readonly nextExpectedDate: string | null;
}

export interface PlannedBillReminder {
  readonly subscriptionId: string;
  readonly billName: string;
  readonly amount: number;
  readonly dueDate: string;
  readonly frequency: string;
  /** 0 when due today. Never negative — overdue bills are not reminders. */
  readonly daysUntilDue: number;
  /** `today`, `tomorrow`, or `in N days`. */
  readonly dueLabel: string;
  readonly sendEmail: boolean;
}

/**
 * Clamps a stored preference into a usable window, falling back to the
 * default for null, NaN and negative values.
 */
export function resolveReminderWindow(daysBefore: number | null | undefined): number {
  if (daysBefore === null || daysBefore === undefined || !Number.isFinite(daysBefore)) {
    return DEFAULT_BILL_REMINDER_DAYS_BEFORE;
  }

  const whole = Math.floor(daysBefore);
  if (whole < 0) return DEFAULT_BILL_REMINDER_DAYS_BEFORE;

  return Math.min(whole, MAX_BILL_REMINDER_DAYS_BEFORE);
}

export function describeDueIn(daysUntilDue: number): string {
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue === 1) return 'tomorrow';
  return `in ${daysUntilDue} days`;
}

/**
 * @param preferences the user's notification preferences, or null when they
 *   have none — in which case the defaults apply and email is on.
 * @param bills the user's active, confirmed recurring transactions.
 * @param today any instant during the day being evaluated; only its local
 *   calendar date matters.
 */
export function planBillReminders(
  preferences: BillReminderPreferences | null | undefined,
  bills: readonly UpcomingBill[],
  today: Date,
): PlannedBillReminder[] {
  const window = resolveReminderWindow(preferences?.billReminderDaysBefore);
  // No preferences row means the user never opted out, so email stays on.
  const sendEmail = preferences ? Boolean(preferences.emailBillReminders) : true;

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const reminders: PlannedBillReminder[] = [];

  for (const bill of bills) {
    const daysUntilDue = daysFromStartOfDay(startOfToday, bill.nextExpectedDate);
    if (daysUntilDue === null) continue;

    // Inclusive both ends: due today still deserves a reminder, and so does
    // a bill landing exactly on the cutoff. Already-overdue bills do not —
    // a reminder for something the user has presumably paid is noise.
    if (daysUntilDue < 0 || daysUntilDue > window) continue;

    reminders.push({
      subscriptionId: bill.id,
      billName: bill.merchantName || bill.name,
      amount: bill.estimatedAmount,
      dueDate: bill.nextExpectedDate as string,
      frequency: bill.frequency,
      daysUntilDue,
      dueLabel: describeDueIn(daysUntilDue),
      sendEmail,
    });
  }

  return reminders;
}

/**
 * Whole days between local midnight today and a `YYYY-MM-DD` due date.
 * Returns null for missing or unparseable dates rather than NaN, so callers
 * cannot accidentally compare their way into sending a reminder.
 */
function daysFromStartOfDay(startOfToday: Date, dueDate: string | null): number | null {
  if (!dueDate) return null;

  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;

  // Round rather than floor: a DST transition inside the window shifts the
  // difference by an hour, which must not shift the day count.
  return Math.round((due.getTime() - startOfToday.getTime()) / MS_PER_DAY);
}
