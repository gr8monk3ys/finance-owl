import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './jobs.module';
import { NetWorthService } from '../analytics/net-worth.service';

@Processor(QUEUES.ALERTS)
export class NetWorthSnapshotProcessor extends WorkerHost {
  private readonly logger = new Logger(NetWorthSnapshotProcessor.name);

  constructor(private netWorthService: NetWorthService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'net-worth-snapshot') return;

    this.logger.log('Running daily net worth snapshot for all users');
    await this.netWorthService.snapshotAllUsers();
    this.logger.log('Net worth snapshot complete');
  }
}
