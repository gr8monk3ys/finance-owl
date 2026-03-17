import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const QUEUES = {
  TRANSACTION_SYNC: 'transaction-sync',
  SUBSCRIPTION_DETECT: 'subscription-detect',
  ALERTS: 'alerts',
  BACKUP: 'backup',
} as const;

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
        defaultJobOptions: {
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUES.TRANSACTION_SYNC },
      { name: QUEUES.SUBSCRIPTION_DETECT },
      { name: QUEUES.ALERTS },
      { name: QUEUES.BACKUP },
    ),
  ],
  exports: [BullModule],
})
export class JobsModule {}
