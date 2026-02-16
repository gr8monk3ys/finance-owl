import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { DetectionService } from './detection.service';
import { CancellationService } from './cancellation.service';
import { CancellationController } from './cancellation.controller';
import { CancellationProvidersService } from './cancellation-providers.service';
import { CancellationEnhancedController } from './cancellation-enhanced.controller';
import { SubscriptionDetectProcessor } from '../jobs/subscription-detect.processor';
import { SubscriptionDetectScheduler } from '../jobs/subscription-detect.scheduler';

@Module({
  imports: [JobsModule],
  providers: [
    SubscriptionsService,
    DetectionService,
    CancellationService,
    CancellationProvidersService,
    SubscriptionDetectProcessor,
    SubscriptionDetectScheduler,
  ],
  controllers: [
    CancellationController,
    CancellationEnhancedController,
    SubscriptionsController,
  ],
  exports: [
    SubscriptionsService,
    DetectionService,
    CancellationService,
    CancellationProvidersService,
  ],
})
export class SubscriptionsModule {}
