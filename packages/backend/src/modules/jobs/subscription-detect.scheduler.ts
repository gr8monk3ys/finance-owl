import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './jobs.module';
import type { SubscriptionDetectJobData } from './subscription-detect.processor';

@Injectable()
export class SubscriptionDetectScheduler implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionDetectScheduler.name);

  constructor(
    @InjectQueue(QUEUES.SUBSCRIPTION_DETECT)
    private detectQueue: Queue<SubscriptionDetectJobData>,
  ) {}

  async onModuleInit() {
    // Weekly subscription detection every Sunday at 2 AM
    await this.detectQueue.upsertJobScheduler(
      'weekly-subscription-detect',
      { pattern: '0 2 * * 0' },
      {
        name: 'weekly-detect',
        data: {},
      },
    );

    this.logger.log('Subscription detect scheduler initialized (weekly, Sunday 2 AM)');
  }

  async queueDetectionForUser(userId: string): Promise<void> {
    await this.detectQueue.add(
      `detect-${userId}`,
      { userId },
      {
        jobId: `detect-${userId}-${Date.now()}`,
        deduplication: {
          id: `detect-${userId}`,
        },
      },
    );
  }
}
