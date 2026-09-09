import { scheduledJobKey, type JobName } from './schedules';
import type { QueueName } from './queues';

/**
 * Declared by every worker that consumes a job listed in `SCHEDULES`.
 *
 * BullMQ hands each job to exactly one worker on the queue, so a schedule is
 * only really wired up when a live processor on that queue dispatches on that
 * job name. `ScheduleRegistrar` discovers these declarations from the Nest
 * container at boot and refuses to start otherwise, which turns "the cron
 * enqueues into a queue nobody drains" from silence into a crash.
 */
export interface ScheduledJobHandler {
  readonly handles: {
    readonly queue: QueueName;
    readonly jobNames: readonly JobName[];
  };
}

export function isScheduledJobHandler(value: unknown): value is ScheduledJobHandler {
  if (typeof value !== 'object' || value === null) return false;

  const handles = (value as ScheduledJobHandler).handles;

  return (
    typeof handles === 'object' &&
    handles !== null &&
    typeof handles.queue === 'string' &&
    Array.isArray(handles.jobNames) &&
    handles.jobNames.every((name) => typeof name === 'string')
  );
}

/** The set of (queue, job name) pairs the given provider instances consume. */
export function collectProcessorKeys(instances: readonly unknown[]): Set<string> {
  const keys = new Set<string>();

  for (const instance of instances) {
    if (!isScheduledJobHandler(instance)) continue;
    for (const jobName of instance.handles.jobNames) {
      keys.add(scheduledJobKey(instance.handles.queue, jobName));
    }
  }

  return keys;
}
