import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './queues';
import { JOBS } from './schedules';
import type { ScheduledJobHandler } from './scheduled-job-handler';
import { PlaidSyncService } from '../bank-sync/plaid-sync.service';
import { TransactionSyncScheduler } from './transaction-sync.scheduler';

export interface TransactionSyncJobData {
  plaidItemId: string; // internal DB id
  userId: string;
  trigger: 'webhook' | 'cron' | 'manual';
}

@Processor(QUEUES.TRANSACTION_SYNC)
export class TransactionSyncProcessor extends WorkerHost implements ScheduledJobHandler {
  private readonly logger = new Logger(TransactionSyncProcessor.name);

  readonly handles = {
    queue: QUEUES.TRANSACTION_SYNC,
    jobNames: [JOBS.PERIODIC_TRANSACTION_SYNC],
  } as const;

  constructor(
    private plaidSyncService: PlaidSyncService,
    private syncScheduler: TransactionSyncScheduler,
  ) {
    super();
  }

  async process(job: Job<Partial<TransactionSyncJobData>>): Promise<void> {
    // The cron job addresses no particular item, so it fans out into one
    // per-item job instead of syncing anything itself. It used to carry
    // `{ plaidItemId: '', userId: '' }`, which drove syncTransactionsForItem
    // straight into a NotFoundException and three retries, every four hours,
    // forever — while queueSyncForAllActiveItems() sat here with no callers.
    if (job.name === JOBS.PERIODIC_TRANSACTION_SYNC) {
      await this.syncScheduler.queueSyncForAllActiveItems();
      return;
    }

    const { plaidItemId, userId, trigger } = job.data;

    if (!plaidItemId || !userId) {
      this.logger.error(
        `Job "${job.name}" (${job.id}) has no plaidItemId/userId; dropping instead of retrying`,
      );
      return;
    }

    this.logger.log(`Processing transaction sync for item ${plaidItemId} (trigger: ${trigger})`);

    try {
      const result = await this.plaidSyncService.syncTransactionsForItem(plaidItemId, userId);

      this.logger.log(
        `Sync complete for item ${plaidItemId}: ` +
          `${result.added} added, ${result.modified} modified, ${result.removed} removed`,
      );
    } catch (error) {
      this.logger.error(`Transaction sync failed for item ${plaidItemId}: ${error}`);
      throw error;
    }
  }
}
