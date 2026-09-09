import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationTriggerService } from './notification-trigger.service';
import { BudgetAlertCheckerService } from './budget-alert-checker.service';

@Module({
  imports: [EmailModule],
  providers: [NotificationsService, NotificationTriggerService, BudgetAlertCheckerService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationTriggerService, BudgetAlertCheckerService],
})
export class NotificationsModule {}
