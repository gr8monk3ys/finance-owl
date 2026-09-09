import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './queues';
import { JOBS } from './schedules';
import type { ScheduledJobHandler } from './scheduled-job-handler';
import { BillReminderService } from './bill-reminder.service';
import { WeeklyDigestService } from './weekly-digest.service';
import { BudgetAlertCheckerService } from '../notifications/budget-alert-checker.service';

/**
 * The only worker on the alerts queue.
 *
 * There used to be two — a bill-reminder worker and a weekly-digest worker —
 * each of which returned silently for job names it did not recognise. BullMQ
 * hands a job to exactly one worker, so with both running, roughly half of
 * every scheduled alert would have been dropped by the wrong listener. One
 * worker with an explicit dispatch table cannot lose a job that way, and an
 * unknown name is logged rather than swallowed.
 */
@Processor(QUEUES.ALERTS)
export class AlertsProcessor extends WorkerHost implements ScheduledJobHandler {
  private readonly logger = new Logger(AlertsProcessor.name);

  readonly handles = {
    queue: QUEUES.ALERTS,
    jobNames: [JOBS.BILL_REMINDER, JOBS.WEEKLY_DIGEST, JOBS.BUDGET_UTILIZATION],
  } as const;

  constructor(
    private readonly billReminders: BillReminderService,
    private readonly weeklyDigest: WeeklyDigestService,
    private readonly budgetAlerts: BudgetAlertCheckerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOBS.BILL_REMINDER:
        await this.billReminders.run();
        return;
      case JOBS.WEEKLY_DIGEST:
        await this.weeklyDigest.run();
        return;
      case JOBS.BUDGET_UTILIZATION:
        await this.budgetAlerts.checkBudgetUtilization();
        return;
      default:
        this.logger.warn(`Ignoring unknown job "${job.name}" on the ${QUEUES.ALERTS} queue`);
    }
  }
}
