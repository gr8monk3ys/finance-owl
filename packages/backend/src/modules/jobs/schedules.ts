import { QUEUES, type QueueName } from './queues';

/**
 * Every recurring job this product runs, in one readable list.
 *
 * Before this table each schedule was its own 25-line `OnModuleInit` class,
 * so "what does this deployment do on a timer?" could only be answered by
 * reading five files and checking which of them were actually wired into a
 * Nest module — three of them were not. Adding, retiming or retiring a cron
 * is now a one-line edit here, and `ScheduleRegistrar` refuses to boot when
 * an entry names a job no processor consumes.
 */

/**
 * `job.name` values. A scheduled job carries no payload; the name is the
 * entire contract between this table and the processor that dispatches on it.
 */
export const JOBS = {
  /** Fan out a sync job per active Plaid item. */
  PERIODIC_TRANSACTION_SYNC: 'periodic-sync',
  /** Re-run subscription detection for every user. */
  SUBSCRIPTION_DETECT: 'weekly-detect',
  /** Notify users of bills falling due inside their reminder window. */
  BILL_REMINDER: 'daily-bill-reminder',
  /** Email a spending summary for the past week. */
  WEEKLY_DIGEST: 'weekly-digest',
  /** Raise budget alerts at the 75/90/100% thresholds. */
  BUDGET_UTILIZATION: 'daily-budget-utilization',
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/**
 * Guards every schedule that puts mail in a real user's inbox.
 *
 * Off by default. The bill-reminder and weekly-digest workers spent their
 * whole life unreachable (jobs.module.ts declared no providers), so switching
 * them on is a behaviour change an operator should make deliberately rather
 * than discover from their users.
 */
export const EMAIL_JOBS_FLAG = 'SCHEDULED_EMAIL_JOBS_ENABLED';

export interface ScheduleDefinition {
  /**
   * Stable key BullMQ upserts the repeatable job under. Changing it orphans
   * the previously registered scheduler instead of replacing it.
   */
  readonly id: string;
  readonly queue: QueueName;
  /** Dispatch key the queue's processor switches on. */
  readonly jobName: JobName;
  /** Five-field cron pattern, evaluated in the server's local timezone. */
  readonly pattern: string;
  /** Human-readable intent, echoed in the boot log. */
  readonly description: string;
  /** When set, the schedule is registered only if this env var is truthy. */
  readonly requiresFlag?: string;
}

export const SCHEDULES: readonly ScheduleDefinition[] = [
  {
    id: 'periodic-transaction-sync',
    queue: QUEUES.TRANSACTION_SYNC,
    jobName: JOBS.PERIODIC_TRANSACTION_SYNC,
    pattern: '0 */4 * * *',
    description: 'Pull new transactions for every active Plaid item',
  },
  {
    id: 'weekly-subscription-detect',
    queue: QUEUES.SUBSCRIPTION_DETECT,
    jobName: JOBS.SUBSCRIPTION_DETECT,
    pattern: '0 2 * * 0',
    description: 'Re-detect recurring charges for every user (Sundays, 2 AM)',
  },
  {
    id: 'daily-budget-utilization',
    queue: QUEUES.ALERTS,
    jobName: JOBS.BUDGET_UTILIZATION,
    pattern: '0 10 * * *',
    description: 'Budget alerts at the 75/90/100% thresholds (daily, 10 AM)',
  },
  {
    id: 'daily-bill-reminder',
    queue: QUEUES.ALERTS,
    jobName: JOBS.BILL_REMINDER,
    pattern: '0 9 * * *',
    description: 'Remind users of bills due inside their reminder window (daily, 9 AM)',
    requiresFlag: EMAIL_JOBS_FLAG,
  },
  {
    id: 'weekly-digest',
    queue: QUEUES.ALERTS,
    jobName: JOBS.WEEKLY_DIGEST,
    pattern: '0 8 * * 1',
    description: "Email last week's spending summary (Mondays, 8 AM)",
    requiresFlag: EMAIL_JOBS_FLAG,
  },
];

// ── Pure helpers ────────────────────────────────────────────────────
// Everything below is deliberately free of Nest, BullMQ and the database so
// the registrar's boot-time rules can be tested without standing up either.

/** Identity of a (queue, job name) pair, shared by schedules and processors. */
export function scheduledJobKey(queue: string, jobName: string): string {
  return `${queue}#${jobName}`;
}

/** Accepts the spellings an operator is likely to reach for in a .env file. */
export function isFlagEnabled(raw: string | undefined | null): boolean {
  if (raw === null || raw === undefined) return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

export interface SchedulePlan {
  /** Schedules whose flag (if any) is on — these get registered. */
  readonly active: readonly ScheduleDefinition[];
  /** Schedules held back by an unset flag, reported at boot so they are not silent. */
  readonly skipped: readonly ScheduleDefinition[];
}

export function planSchedules(
  schedules: readonly ScheduleDefinition[],
  readFlag: (name: string) => string | undefined,
): SchedulePlan {
  const active: ScheduleDefinition[] = [];
  const skipped: ScheduleDefinition[] = [];

  for (const schedule of schedules) {
    if (schedule.requiresFlag && !isFlagEnabled(readFlag(schedule.requiresFlag))) {
      skipped.push(schedule);
    } else {
      active.push(schedule);
    }
  }

  return { active, skipped };
}

/**
 * Two entries sharing an id on the same queue would silently overwrite each
 * other in Redis, leaving whichever registered last as the only survivor.
 */
export function findDuplicateScheduleIds(schedules: readonly ScheduleDefinition[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const schedule of schedules) {
    const key = scheduledJobKey(schedule.queue, schedule.id);
    if (seen.has(key)) duplicates.add(schedule.id);
    seen.add(key);
  }

  return [...duplicates];
}

/**
 * Schedules that would enqueue onto a queue with no consumer for their job
 * name — the failure mode that let `daily-net-worth-snapshot` survive the
 * deletion of its processor.
 */
export function findSchedulesWithoutProcessor(
  schedules: readonly ScheduleDefinition[],
  processorKeys: ReadonlySet<string>,
): ScheduleDefinition[] {
  return schedules.filter(
    (schedule) => !processorKeys.has(scheduledJobKey(schedule.queue, schedule.jobName)),
  );
}
