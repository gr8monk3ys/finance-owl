import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './jobs.module';

@Injectable()
export class WeeklyDigestScheduler implements OnModuleInit {
  private readonly logger = new Logger(WeeklyDigestScheduler.name);

  constructor(
    @InjectQueue(QUEUES.ALERTS) private alertsQueue: Queue,
  ) {}

  async onModuleInit() {
    // Weekly digest every Monday at 8:00 AM
    await this.alertsQueue.upsertJobScheduler(
      'weekly-digest',
      { pattern: '0 8 * * 1' },
      {
        name: 'weekly-digest',
        data: {},
      },
    );

    this.logger.log(
      'Weekly digest scheduler initialized (Mondays at 8:00 AM)',
    );
  }
}
