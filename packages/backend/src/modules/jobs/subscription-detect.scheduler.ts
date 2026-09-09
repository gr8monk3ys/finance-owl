import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './queues';
import type { SubscriptionDetectJobData } from './subscription-detect.processor';

/**
 * Enqueues on-demand subscription detection. The weekly sweep is declared in
 * schedules.ts rather than registered here.
 */
@Injectable()
export class SubscriptionDetectScheduler {
  constructor(
    @InjectQueue(QUEUES.SUBSCRIPTION_DETECT)
    private detectQueue: Queue<SubscriptionDetectJobData>,
  ) {}

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
