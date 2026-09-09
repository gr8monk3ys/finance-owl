import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BILL_REMINDER_DAYS_BEFORE,
  MAX_BILL_REMINDER_DAYS_BEFORE,
  describeDueIn,
  planBillReminders,
  resolveReminderWindow,
  type BillReminderPreferences,
  type UpcomingBill,
} from './bill-reminder-window';

/** Local midnight, matching how the recurring-transaction dates are parsed. */
const TODAY = new Date(2026, 2, 10, 13, 45, 0);

function bill(overrides: Partial<UpcomingBill> = {}): UpcomingBill {
  return {
    id: 'sub-1',
    name: 'Streaming Plan',
    merchantName: 'Netflix',
    estimatedAmount: 15.49,
    frequency: 'monthly',
    nextExpectedDate: '2026-03-12',
    ...overrides,
  };
}

function prefs(overrides: Partial<BillReminderPreferences> = {}): BillReminderPreferences {
  return { billReminderDaysBefore: 3, emailBillReminders: 1, ...overrides };
}

describe('resolveReminderWindow', () => {
  it('falls back to the default for a missing preference', () => {
    expect(resolveReminderWindow(null)).toBe(DEFAULT_BILL_REMINDER_DAYS_BEFORE);
    expect(resolveReminderWindow(undefined)).toBe(DEFAULT_BILL_REMINDER_DAYS_BEFORE);
  });

  it('falls back to the default for values a window cannot be made from', () => {
    expect(resolveReminderWindow(Number.NaN)).toBe(DEFAULT_BILL_REMINDER_DAYS_BEFORE);
    expect(resolveReminderWindow(-1)).toBe(DEFAULT_BILL_REMINDER_DAYS_BEFORE);
  });

  it('honours zero, meaning "only on the due date"', () => {
    expect(resolveReminderWindow(0)).toBe(0);
  });

  it('caps an absurd stored value', () => {
    expect(resolveReminderWindow(3650)).toBe(MAX_BILL_REMINDER_DAYS_BEFORE);
  });
});

describe('describeDueIn', () => {
  it('reads naturally at the near end of the window', () => {
    expect(describeDueIn(0)).toBe('today');
    expect(describeDueIn(1)).toBe('tomorrow');
    expect(describeDueIn(5)).toBe('in 5 days');
  });
});

describe('planBillReminders', () => {
  it('includes a bill due on the far edge of the window', () => {
    const planned = planBillReminders(prefs({ billReminderDaysBefore: 2 }), [bill()], TODAY);

    expect(planned).toHaveLength(1);
    expect(planned[0]).toMatchObject({
      subscriptionId: 'sub-1',
      billName: 'Netflix',
      dueDate: '2026-03-12',
      daysUntilDue: 2,
      dueLabel: 'in 2 days',
    });
  });

  it('excludes a bill one day past the window', () => {
    const planned = planBillReminders(prefs({ billReminderDaysBefore: 1 }), [bill()], TODAY);

    expect(planned).toEqual([]);
  });

  it('includes a bill due today', () => {
    const planned = planBillReminders(prefs(), [bill({ nextExpectedDate: '2026-03-10' })], TODAY);

    expect(planned).toHaveLength(1);
    expect(planned[0].daysUntilDue).toBe(0);
    expect(planned[0].dueLabel).toBe('today');
  });

  it('excludes an overdue bill rather than nagging about a payment already made', () => {
    const planned = planBillReminders(prefs(), [bill({ nextExpectedDate: '2026-03-09' })], TODAY);

    expect(planned).toEqual([]);
  });

  it('ignores a series with no next occurrence', () => {
    expect(planBillReminders(prefs(), [bill({ nextExpectedDate: null })], TODAY)).toEqual([]);
  });

  it('ignores an unparseable due date instead of comparing against NaN', () => {
    expect(planBillReminders(prefs(), [bill({ nextExpectedDate: 'not-a-date' })], TODAY)).toEqual(
      [],
    );
  });

  it('applies the default window when the user has no preferences row', () => {
    const inWindow = bill({ id: 'in', nextExpectedDate: '2026-03-13' });
    const outOfWindow = bill({ id: 'out', nextExpectedDate: '2026-03-14' });

    const planned = planBillReminders(null, [inWindow, outOfWindow], TODAY);

    expect(planned.map((r) => r.subscriptionId)).toEqual(['in']);
  });

  it('treats a missing preferences row as email opted in', () => {
    const planned = planBillReminders(null, [bill()], TODAY);

    expect(planned[0].sendEmail).toBe(true);
  });

  it('still raises the in-app reminder when email is switched off', () => {
    const planned = planBillReminders(prefs({ emailBillReminders: 0 }), [bill()], TODAY);

    expect(planned).toHaveLength(1);
    expect(planned[0].sendEmail).toBe(false);
  });

  it('reminds only on the due date when the window is zero', () => {
    const dueToday = bill({ id: 'today', nextExpectedDate: '2026-03-10' });
    const dueTomorrow = bill({ id: 'tomorrow', nextExpectedDate: '2026-03-11' });

    const planned = planBillReminders(
      prefs({ billReminderDaysBefore: 0 }),
      [dueToday, dueTomorrow],
      TODAY,
    );

    expect(planned.map((r) => r.subscriptionId)).toEqual(['today']);
  });

  it('falls back to the series name when there is no merchant', () => {
    const planned = planBillReminders(prefs(), [bill({ merchantName: null })], TODAY);

    expect(planned[0].billName).toBe('Streaming Plan');
  });

  it('reads the calendar date from the clock, not the time of day', () => {
    const lateAtNight = new Date(2026, 2, 10, 23, 59, 59);
    const planned = planBillReminders(
      prefs(),
      [bill({ nextExpectedDate: '2026-03-11' })],
      lateAtNight,
    );

    expect(planned[0].daysUntilDue).toBe(1);
  });

  it('keeps every matching bill for a user, not just the first', () => {
    const planned = planBillReminders(
      prefs({ billReminderDaysBefore: 5 }),
      [
        bill({ id: 'a', nextExpectedDate: '2026-03-11' }),
        bill({ id: 'b', nextExpectedDate: '2026-03-13' }),
        bill({ id: 'c', nextExpectedDate: '2026-03-20' }),
      ],
      TODAY,
    );

    expect(planned.map((r) => r.subscriptionId)).toEqual(['a', 'b']);
  });
});
