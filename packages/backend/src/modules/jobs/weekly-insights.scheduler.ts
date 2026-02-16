import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './jobs.module';

@Injectable()
export class WeeklyInsightsScheduler implements OnModuleInit {
  private readonly logger = new Logger(WeeklyInsightsScheduler.name);

  constructor(
    @InjectQueue(QUEUES.AI_CATEGORIZE) private aiQueue: Queue,
  ) {}

  async onModuleInit() {
    // Mondays at 8 AM
    await this.aiQueue.upsertJobScheduler(
      'weekly-insights',
      { pattern: '0 8 * * 1' },
      {
        name: 'weekly-insights',
        data: {},
      },
    );

    this.logger.log('Weekly insights scheduler initialized (Mondays at 8 AM)');
  }
}
