import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { QUEUES } from './jobs.module';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import type { InvestmentSyncJobData } from './investment-sync.processor';

@Injectable()
export class InvestmentSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(InvestmentSyncScheduler.name);

  constructor(
    @InjectQueue(QUEUES.INVESTMENT_SYNC)
    private syncQueue: Queue<InvestmentSyncJobData>,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {}

  async onModuleInit() {
    // Daily investment sync at 6 PM Mon-Fri (after market close)
    await this.syncQueue.upsertJobScheduler(
      'daily-investment-sync',
      { pattern: '0 18 * * 1-5' },
      {
        name: 'daily-sync',
        data: { plaidItemId: '', trigger: 'cron' as const },
      },
    );

    this.logger.log(
      'Investment sync scheduler initialized (weekdays at 6 PM)',
    );
  }

  async queueSyncForItem(
    plaidItemId: string,
    trigger: InvestmentSyncJobData['trigger'] = 'manual',
  ): Promise<void> {
    await this.syncQueue.add(
      `investment-sync-${plaidItemId}`,
      { plaidItemId, trigger },
      {
        jobId: `investment-sync-${plaidItemId}-${Date.now()}`,
        deduplication: {
          id: `investment-sync-${plaidItemId}`,
        },
      },
    );
  }

  async queueSyncForAllItems(): Promise<void> {
    const items = await this.db
      .select({ id: schema.plaidItems.id })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.status, 'active'));

    this.logger.log(
      `Queueing investment sync for ${items.length} active Plaid items`,
    );

    for (const item of items) {
      await this.queueSyncForItem(item.id, 'cron');
    }
  }
}
