import { describe, it, expect } from 'vitest';
import { QUEUES } from './queues';
import {
  EMAIL_JOBS_FLAG,
  JOBS,
  SCHEDULES,
  findDuplicateScheduleIds,
  findSchedulesWithoutProcessor,
  isFlagEnabled,
  planSchedules,
  scheduledJobKey,
  type ScheduleDefinition,
} from './schedules';

function schedule(overrides: Partial<ScheduleDefinition> = {}): ScheduleDefinition {
  return {
    id: 'some-schedule',
    queue: QUEUES.ALERTS,
    jobName: JOBS.BILL_REMINDER,
    pattern: '0 9 * * *',
    description: 'test schedule',
    ...overrides,
  };
}

describe('isFlagEnabled', () => {
  it.each(['1', 'true', 'TRUE', ' yes ', 'on'])('treats %j as on', (raw) => {
    expect(isFlagEnabled(raw)).toBe(true);
  });

  it.each(['0', 'false', 'no', 'off', '', '  ', 'maybe'])('treats %j as off', (raw) => {
    expect(isFlagEnabled(raw)).toBe(false);
  });

  it('defaults to off when the variable is unset', () => {
    expect(isFlagEnabled(undefined)).toBe(false);
    expect(isFlagEnabled(null)).toBe(false);
  });
});

describe('planSchedules', () => {
  it('activates schedules that carry no flag', () => {
    const plan = planSchedules([schedule({ id: 'unflagged' })], () => undefined);

    expect(plan.active.map((s) => s.id)).toEqual(['unflagged']);
    expect(plan.skipped).toEqual([]);
  });

  it('holds back a flagged schedule when the flag is unset', () => {
    const plan = planSchedules([schedule({ id: 'mail', requiresFlag: 'MAIL' })], () => undefined);

    expect(plan.active).toEqual([]);
    expect(plan.skipped.map((s) => s.id)).toEqual(['mail']);
  });

  it('activates a flagged schedule once the flag is truthy', () => {
    const plan = planSchedules([schedule({ id: 'mail', requiresFlag: 'MAIL' })], (name) =>
      name === 'MAIL' ? 'true' : undefined,
    );

    expect(plan.active.map((s) => s.id)).toEqual(['mail']);
    expect(plan.skipped).toEqual([]);
  });

  it('reads only the flag each schedule names', () => {
    const read: string[] = [];

    planSchedules([schedule({ requiresFlag: 'A' }), schedule({ id: 'b' })], (name) => {
      read.push(name);
      return '1';
    });

    expect(read).toEqual(['A']);
  });
});

describe('findDuplicateScheduleIds', () => {
  it('accepts an id reused across different queues', () => {
    const duplicates = findDuplicateScheduleIds([
      schedule({ id: 'daily', queue: QUEUES.ALERTS }),
      schedule({ id: 'daily', queue: QUEUES.BACKUP }),
    ]);

    expect(duplicates).toEqual([]);
  });

  it('reports an id reused on the same queue, which would overwrite in Redis', () => {
    const duplicates = findDuplicateScheduleIds([
      schedule({ id: 'daily' }),
      schedule({ id: 'daily', pattern: '0 3 * * *' }),
      schedule({ id: 'other' }),
    ]);

    expect(duplicates).toEqual(['daily']);
  });
});

describe('findSchedulesWithoutProcessor', () => {
  it('passes a schedule whose (queue, job name) pair is covered', () => {
    const keys = new Set([scheduledJobKey(QUEUES.ALERTS, JOBS.BILL_REMINDER)]);

    expect(findSchedulesWithoutProcessor([schedule()], keys)).toEqual([]);
  });

  it('flags a schedule whose job name is handled on a different queue', () => {
    const keys = new Set([scheduledJobKey(QUEUES.BACKUP, JOBS.BILL_REMINDER)]);

    expect(findSchedulesWithoutProcessor([schedule()], keys).map((s) => s.id)).toEqual([
      'some-schedule',
    ]);
  });

  it('flags a schedule with no processor at all', () => {
    expect(
      findSchedulesWithoutProcessor([schedule({ id: 'orphan' })], new Set()).map((s) => s.id),
    ).toEqual(['orphan']);
  });
});

describe('the SCHEDULES table', () => {
  it('has no duplicate ids', () => {
    expect(findDuplicateScheduleIds(SCHEDULES)).toEqual([]);
  });

  it('uses five-field cron patterns', () => {
    for (const s of SCHEDULES) {
      expect(s.pattern.trim().split(/\s+/), `${s.id} pattern "${s.pattern}"`).toHaveLength(5);
    }
  });

  it('names only queues this application registers', () => {
    const known = new Set<string>(Object.values(QUEUES));

    for (const s of SCHEDULES) {
      expect(known.has(s.queue), `${s.id} -> ${s.queue}`).toBe(true);
    }
  });

  it('keeps every user-facing email schedule behind the opt-in flag', () => {
    const flagged = SCHEDULES.filter((s) => s.requiresFlag === EMAIL_JOBS_FLAG).map((s) => s.id);

    expect(flagged.sort()).toEqual(['daily-bill-reminder', 'weekly-digest']);
  });

  it('no longer schedules the net worth snapshot, whose processor was deleted', () => {
    expect(SCHEDULES.map((s) => s.id)).not.toContain('daily-net-worth-snapshot');
  });
});
