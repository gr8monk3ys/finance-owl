import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './jobs.module';
import { PlaidSyncService } from '../bank-sync/plaid-sync.service';

export interface TransactionSyncJobData {
  plaidItemId: string; // internal DB id
  userId: string;
  trigger: 'webhook' | 'cron' | 'manual';
}

@Processor(QUEUES.TRANSACTION_SYNC)
export class TransactionSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionSyncProcessor.name);

  constructor(private plaidSyncService: PlaidSyncService) {
    super();
  }

  async process(job: Job<TransactionSyncJobData>): Promise<void> {
    const { plaidItemId, userId, trigger } = job.data;
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
