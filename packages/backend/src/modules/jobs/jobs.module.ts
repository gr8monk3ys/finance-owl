import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUES } from './queues';
import { ScheduleRegistrar } from './schedule-registrar.service';
import { AlertsProcessor } from './alerts.processor';
import { BillReminderService } from './bill-reminder.service';
import { WeeklyDigestService } from './weekly-digest.service';

export { QUEUES, type QueueName } from './queues';

/**
 * Owns the queue connections, the alerts worker, and the one place cron
 * policy is declared (schedules.ts).
 *
 * This module previously had no `providers` array at all, so everything it
 * appeared to offer — the bill-reminder and weekly-digest workers, three
 * schedulers — was never instantiated. Anything added below must stay in
 * `providers`, or it goes back to being unreachable code that still compiles.
 */
@Module({
  imports: [
    DiscoveryModule,
    EmailModule,
    NotificationsModule,
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
  providers: [ScheduleRegistrar, AlertsProcessor, BillReminderService, WeeklyDigestService],
  exports: [BullModule],
})
export class JobsModule {}
