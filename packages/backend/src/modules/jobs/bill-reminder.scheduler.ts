import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './jobs.module';

@Injectable()
export class BillReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillReminderScheduler.name);

  constructor(
    @InjectQueue(QUEUES.ALERTS) private alertsQueue: Queue,
  ) {}

  async onModuleInit() {
    // Daily bill reminder check at 9:00 AM
    await this.alertsQueue.upsertJobScheduler(
      'daily-bill-reminder',
      { pattern: '0 9 * * *' },
      {
        name: 'daily-bill-reminder',
        data: {},
      },
    );

    this.logger.log(
      'Bill reminder scheduler initialized (daily at 9:00 AM)',
    );
  }
}
