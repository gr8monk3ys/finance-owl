import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { DiscoveryService } from '@nestjs/core';
import type { Queue } from 'bullmq';
import { QUEUES, type QueueName } from './queues';
import { JOBS, type ScheduleDefinition } from './schedules';
import { collectProcessorKeys, isScheduledJobHandler } from './scheduled-job-handler';
import { ScheduleRegistrar } from './schedule-registrar.service';

type FakeQueue = { upsertJobScheduler: ReturnType<typeof vi.fn> };

function fakeQueues(): Record<QueueName, FakeQueue> {
  return {
    [QUEUES.TRANSACTION_SYNC]: { upsertJobScheduler: vi.fn() },
    [QUEUES.SUBSCRIPTION_DETECT]: { upsertJobScheduler: vi.fn() },
    [QUEUES.ALERTS]: { upsertJobScheduler: vi.fn() },
    [QUEUES.BACKUP]: { upsertJobScheduler: vi.fn() },
  };
}

function handler(queue: QueueName, ...jobNames: string[]) {
  return { handles: { queue, jobNames } };
}

function build(options: {
  queues: Record<QueueName, FakeQueue>;
  providers?: unknown[];
  env?: Record<string, string>;
}) {
  const discovery = {
    getProviders: () => (options.providers ?? []).map((instance) => ({ instance })),
  } as unknown as DiscoveryService;

  const config = {
    get: (name: string) => options.env?.[name],
  } as unknown as ConfigService;

  return new ScheduleRegistrar(
    discovery,
    config,
    options.queues[QUEUES.TRANSACTION_SYNC] as unknown as Queue,
    options.queues[QUEUES.SUBSCRIPTION_DETECT] as unknown as Queue,
    options.queues[QUEUES.ALERTS] as unknown as Queue,
    options.queues[QUEUES.BACKUP] as unknown as Queue,
  );
}

const billReminderSchedule: ScheduleDefinition = {
  id: 'daily-bill-reminder',
  queue: QUEUES.ALERTS,
  jobName: JOBS.BILL_REMINDER,
  pattern: '0 9 * * *',
  description: 'remind about bills',
};

describe('isScheduledJobHandler', () => {
  it('recognises a well-formed declaration', () => {
    expect(isScheduledJobHandler(handler(QUEUES.ALERTS, JOBS.BILL_REMINDER))).toBe(true);
  });

  it.each([
    ['a plain provider', {}],
    ['null', null],
    ['a string', 'alerts'],
    ['a malformed declaration', { handles: { queue: QUEUES.ALERTS } }],
    ['non-string job names', { handles: { queue: QUEUES.ALERTS, jobNames: [1] } }],
  ])('rejects %s', (_label, value) => {
    expect(isScheduledJobHandler(value)).toBe(false);
  });
});

describe('collectProcessorKeys', () => {
  it('skips providers that declare nothing and keeps every declared pair', () => {
    const keys = collectProcessorKeys([
      {},
      undefined,
      handler(QUEUES.ALERTS, JOBS.BILL_REMINDER, JOBS.WEEKLY_DIGEST),
      handler(QUEUES.TRANSACTION_SYNC, JOBS.PERIODIC_TRANSACTION_SYNC),
    ]);

    expect([...keys].sort()).toEqual([
      'alerts#daily-bill-reminder',
      'alerts#weekly-digest',
      'transaction-sync#periodic-sync',
    ]);
  });
});

describe('ScheduleRegistrar', () => {
  let queues: Record<QueueName, FakeQueue>;

  beforeEach(() => {
    queues = fakeQueues();
  });

  it('registers each schedule on its own queue with an empty payload', async () => {
    const registrar = build({
      queues,
      providers: [handler(QUEUES.ALERTS, JOBS.BILL_REMINDER)],
    });

    await registrar.register([billReminderSchedule]);

    expect(queues[QUEUES.ALERTS].upsertJobScheduler).toHaveBeenCalledWith(
      'daily-bill-reminder',
      { pattern: '0 9 * * *' },
      { name: JOBS.BILL_REMINDER, data: {} },
    );
    expect(queues[QUEUES.TRANSACTION_SYNC].upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('refuses to boot when a schedule has no processor for its job name', async () => {
    const registrar = build({ queues, providers: [] });

    await expect(registrar.register([billReminderSchedule])).rejects.toThrow(
      /no registered processor.*daily-bill-reminder/s,
    );
    expect(queues[QUEUES.ALERTS].upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('refuses to boot when the processor listens on a different queue', async () => {
    const registrar = build({
      queues,
      providers: [handler(QUEUES.BACKUP, JOBS.BILL_REMINDER)],
    });

    await expect(registrar.register([billReminderSchedule])).rejects.toThrow(
      /no registered processor/,
    );
  });

  it('refuses to boot when two schedules share an id on one queue', async () => {
    const registrar = build({
      queues,
      providers: [handler(QUEUES.ALERTS, JOBS.BILL_REMINDER)],
    });

    await expect(
      registrar.register([billReminderSchedule, { ...billReminderSchedule, pattern: '0 7 * * *' }]),
    ).rejects.toThrow(/Duplicate schedule id/);
  });

  it('skips a flagged schedule when the flag is unset, without needing a processor', async () => {
    const registrar = build({ queues, providers: [] });

    await registrar.register([{ ...billReminderSchedule, requiresFlag: 'MAIL_ON' }]);

    expect(queues[QUEUES.ALERTS].upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('registers a flagged schedule once the flag is set', async () => {
    const registrar = build({
      queues,
      providers: [handler(QUEUES.ALERTS, JOBS.BILL_REMINDER)],
      env: { MAIL_ON: 'true' },
    });

    await registrar.register([{ ...billReminderSchedule, requiresFlag: 'MAIL_ON' }]);

    expect(queues[QUEUES.ALERTS].upsertJobScheduler).toHaveBeenCalledTimes(1);
  });

  it('still demands a processor for a flagged schedule that is switched on', async () => {
    const registrar = build({ queues, providers: [], env: { MAIL_ON: '1' } });

    await expect(
      registrar.register([{ ...billReminderSchedule, requiresFlag: 'MAIL_ON' }]),
    ).rejects.toThrow(/no registered processor/);
  });

  it('registers the real table on module init', async () => {
    const registrar = build({
      queues,
      providers: [
        handler(QUEUES.ALERTS, JOBS.BILL_REMINDER, JOBS.WEEKLY_DIGEST, JOBS.BUDGET_UTILIZATION),
        handler(QUEUES.TRANSACTION_SYNC, JOBS.PERIODIC_TRANSACTION_SYNC),
        handler(QUEUES.SUBSCRIPTION_DETECT, JOBS.SUBSCRIPTION_DETECT),
      ],
    });

    await registrar.onModuleInit();

    // Email schedules stay off unless SCHEDULED_EMAIL_JOBS_ENABLED says otherwise.
    expect(queues[QUEUES.ALERTS].upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queues[QUEUES.TRANSACTION_SYNC].upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queues[QUEUES.SUBSCRIPTION_DETECT].upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queues[QUEUES.BACKUP].upsertJobScheduler).not.toHaveBeenCalled();
  });

  it('carries no per-entity payload, so no scheduled job can poison itself', async () => {
    const registrar = build({
      queues,
      providers: [handler(QUEUES.TRANSACTION_SYNC, JOBS.PERIODIC_TRANSACTION_SYNC)],
    });

    await registrar.register([
      {
        id: 'periodic-transaction-sync',
        queue: QUEUES.TRANSACTION_SYNC,
        jobName: JOBS.PERIODIC_TRANSACTION_SYNC,
        pattern: '0 */4 * * *',
        description: 'sync every active item',
      },
    ]);

    const [, , jobTemplate] = queues[QUEUES.TRANSACTION_SYNC].upsertJobScheduler.mock.calls[0];
    expect(jobTemplate.data).toEqual({});
  });
});
