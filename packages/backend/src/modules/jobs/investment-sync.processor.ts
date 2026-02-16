import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './jobs.module';
import { InvestmentSyncService } from '../investments/investment-sync.service';

export interface InvestmentSyncJobData {
  plaidItemId: string;
  trigger: 'cron' | 'manual';
}

@Processor(QUEUES.INVESTMENT_SYNC)
export class InvestmentSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(InvestmentSyncProcessor.name);

  constructor(private investmentSyncService: InvestmentSyncService) {
    super();
  }

  async process(job: Job<InvestmentSyncJobData>): Promise<void> {
    const { plaidItemId, trigger } = job.data;
    this.logger.log(
      `Processing investment sync for item ${plaidItemId} (trigger: ${trigger})`,
    );

    try {
      await this.investmentSyncService.syncAll(plaidItemId);
      this.logger.log(`Investment sync complete for item ${plaidItemId}`);
    } catch (error) {
      this.logger.error(
        `Investment sync failed for item ${plaidItemId}: ${error}`,
      );
      throw error;
    }
  }
}
