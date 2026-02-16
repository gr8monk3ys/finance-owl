import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './jobs.module';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { DetectionService } from '../subscriptions/detection.service';

export interface SubscriptionDetectJobData {
  userId?: string;
}

@Processor(QUEUES.SUBSCRIPTION_DETECT)
export class SubscriptionDetectProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscriptionDetectProcessor.name);

  constructor(
    private detectionService: DetectionService,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {
    super();
  }

  async process(job: Job<SubscriptionDetectJobData>): Promise<void> {
    const { userId } = job.data;

    if (userId) {
      this.logger.log(`Running subscription detection for user ${userId}`);
      const detected = await this.detectionService.detectForUser(userId);
      this.logger.log(
        `Subscription detection complete for user ${userId}: ${detected.length} found`,
      );
      return;
    }

    // Run for all users
    this.logger.log('Running subscription detection for all users');
    const users = await this.db
      .select({ id: schema.users.id })
      .from(schema.users);

    for (const user of users) {
      try {
        await this.detectionService.detectForUser(user.id);
      } catch (error) {
        this.logger.error(
          `Subscription detection failed for user ${user.id}: ${error}`,
        );
      }
    }

    this.logger.log(
      `Subscription detection complete for ${users.length} users`,
    );
  }
}
