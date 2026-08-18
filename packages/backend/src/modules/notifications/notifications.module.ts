import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationTriggerService } from './notification-trigger.service';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Module({
  imports: [EmailModule],
  providers: [NotificationsService, NotificationTriggerService, NotificationSchedulerService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationTriggerService],
})
export class NotificationsModule {}
