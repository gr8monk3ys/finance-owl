import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { QUEUES } from './jobs.module';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import type { TransactionSyncJobData } from './transaction-sync.processor';

@Injectable()
export class TransactionSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(TransactionSyncScheduler.name);

  constructor(
    @InjectQueue(QUEUES.TRANSACTION_SYNC)
    private syncQueue: Queue<TransactionSyncJobData>,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {}

  async onModuleInit() {
    // Add repeatable job for periodic sync (every 4 hours)
    await this.syncQueue.upsertJobScheduler(
      'periodic-transaction-sync',
      { pattern: '0 */4 * * *' },
      {
        name: 'periodic-sync',
        data: { plaidItemId: '', userId: '', trigger: 'cron' as const },
      },
    );

    this.logger.log('Transaction sync scheduler initialized (every 4 hours)');
  }

  async queueSyncForItem(
    plaidItemId: string,
    userId: string,
    trigger: TransactionSyncJobData['trigger'] = 'manual',
  ) {
    await this.syncQueue.add(
      `sync-${plaidItemId}`,
      { plaidItemId, userId, trigger },
      {
        jobId: `sync-${plaidItemId}-${Date.now()}`,
        // Deduplicate: don't queue if same item is already waiting
        deduplication: {
          id: `sync-${plaidItemId}`,
        },
      },
    );
  }

  async queueSyncForPlaidItemId(
    externalPlaidItemId: string,
    trigger: TransactionSyncJobData['trigger'] = 'webhook',
  ) {
    // Look up the internal item by Plaid's item_id
    const [item] = await this.db
      .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.plaidItemId, externalPlaidItemId))
      .limit(1);

    if (!item) {
      this.logger.warn(`No Plaid item found for external ID ${externalPlaidItemId}`);
      return;
    }

    await this.queueSyncForItem(item.id, item.userId, trigger);
  }

  async queueSyncForAllActiveItems() {
    const items = await this.db
      .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.status, 'active'));

    this.logger.log(`Queueing sync for ${items.length} active Plaid items`);

    for (const item of items) {
      await this.queueSyncForItem(item.id, item.userId, 'cron');
    }
  }
}
