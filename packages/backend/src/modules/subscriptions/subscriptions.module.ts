import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { DetectionService } from './detection.service';
import { CancellationService } from './cancellation.service';
import { CancellationController } from './cancellation.controller';
import { SubscriptionDetectProcessor } from '../jobs/subscription-detect.processor';
import { SubscriptionDetectScheduler } from '../jobs/subscription-detect.scheduler';

@Module({
  imports: [JobsModule],
  providers: [
    SubscriptionsService,
    DetectionService,
    CancellationService,
    SubscriptionDetectProcessor,
    SubscriptionDetectScheduler,
  ],
  // CancellationController is declared first: its literal `cancellations/...`
  // routes would otherwise be shadowed by SubscriptionsController's `:id`.
  controllers: [CancellationController, SubscriptionsController],
  exports: [SubscriptionsService, DetectionService, CancellationService],
})
export class SubscriptionsModule {}
