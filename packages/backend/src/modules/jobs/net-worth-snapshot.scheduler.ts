import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from './jobs.module';

@Injectable()
export class NetWorthSnapshotScheduler implements OnModuleInit {
  private readonly logger = new Logger(NetWorthSnapshotScheduler.name);

  constructor(@InjectQueue(QUEUES.ALERTS) private alertsQueue: Queue) {}

  async onModuleInit() {
    // Daily net worth snapshot at 1 AM
    await this.alertsQueue.upsertJobScheduler(
      'daily-net-worth-snapshot',
      { pattern: '0 1 * * *' },
      {
        name: 'net-worth-snapshot',
        data: {},
      },
    );

    this.logger.log('Net worth snapshot scheduler initialized (daily at 1 AM)');
  }
}
