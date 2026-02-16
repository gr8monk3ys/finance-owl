import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const QUEUES = {
  TRANSACTION_SYNC: 'transaction-sync',
  AI_CATEGORIZE: 'ai-categorize',
  SUBSCRIPTION_DETECT: 'subscription-detect',
  INVESTMENT_SYNC: 'investment-sync',
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
      { name: QUEUES.AI_CATEGORIZE },
      { name: QUEUES.SUBSCRIPTION_DETECT },
      { name: QUEUES.INVESTMENT_SYNC },
      { name: QUEUES.ALERTS },
      { name: QUEUES.BACKUP },
    ),
  ],
  exports: [BullModule],
})
export class JobsModule {}
