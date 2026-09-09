import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '@nestjs/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, type QueueName } from './queues';
import {
  SCHEDULES,
  findDuplicateScheduleIds,
  findSchedulesWithoutProcessor,
  planSchedules,
  type ScheduleDefinition,
} from './schedules';
import { collectProcessorKeys } from './scheduled-job-handler';

/**
 * Registers every entry in `SCHEDULES` with BullMQ, once, at boot.
 *
 * This replaces four near-identical `OnModuleInit` classes that each upserted
 * a single repeatable job. Beyond the deduplication it adds the check none of
 * them could make on its own: a schedule whose job name has no processor on
 * its queue aborts startup instead of quietly filling Redis forever.
 */
@Injectable()
export class ScheduleRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ScheduleRegistrar.name);

  private readonly queues: Record<QueueName, Queue>;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.TRANSACTION_SYNC) transactionSync: Queue,
    @InjectQueue(QUEUES.SUBSCRIPTION_DETECT) subscriptionDetect: Queue,
    @InjectQueue(QUEUES.ALERTS) alerts: Queue,
    @InjectQueue(QUEUES.BACKUP) backup: Queue,
  ) {
    this.queues = {
      [QUEUES.TRANSACTION_SYNC]: transactionSync,
      [QUEUES.SUBSCRIPTION_DETECT]: subscriptionDetect,
      [QUEUES.ALERTS]: alerts,
      [QUEUES.BACKUP]: backup,
    };
  }

  async onModuleInit(): Promise<void> {
    await this.register(SCHEDULES);
  }

  /** Exposed for tests; production always registers the module-level table. */
  async register(schedules: readonly ScheduleDefinition[]): Promise<void> {
    const duplicates = findDuplicateScheduleIds(schedules);
    if (duplicates.length > 0) {
      throw new Error(
        `Duplicate schedule id(s) in SCHEDULES: ${duplicates.join(', ')}. ` +
          'Ids are BullMQ upsert keys, so duplicates overwrite each other silently.',
      );
    }

    const { active, skipped } = planSchedules(schedules, (name) => this.config.get<string>(name));

    const processorKeys = collectProcessorKeys(
      this.discovery.getProviders().map((wrapper) => wrapper.instance),
    );

    const orphans = findSchedulesWithoutProcessor(active, processorKeys);
    if (orphans.length > 0) {
      const detail = orphans
        .map((schedule) => `${schedule.id} (${schedule.queue} -> "${schedule.jobName}")`)
        .join(', ');
      throw new Error(
        `Scheduled job(s) with no registered processor: ${detail}. ` +
          'Add a processor that declares the job name in `handles`, or remove the schedule.',
      );
    }

    for (const schedule of active) {
      await this.queues[schedule.queue].upsertJobScheduler(
        schedule.id,
        { pattern: schedule.pattern },
        // No payload: a scheduled job addresses every user, and baking a
        // per-entity id in here is what made `periodic-transaction-sync`
        // retry `syncTransactionsForItem('', '')` every four hours.
        { name: schedule.jobName, data: {} },
      );

      this.logger.log(
        `Scheduled "${schedule.id}" on ${schedule.queue} at "${schedule.pattern}" — ${schedule.description}`,
      );
    }

    for (const schedule of skipped) {
      this.logger.warn(
        `Schedule "${schedule.id}" is off: set ${schedule.requiresFlag}=true to enable — ${schedule.description}`,
      );
    }
  }
}
