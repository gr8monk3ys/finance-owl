import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { FeatureGateService } from './feature-gate.service';
import { BillingPlanGuard, BillingFeatureGuard } from './billing.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    BillingService,
    FeatureGateService,
    BillingPlanGuard,
    BillingFeatureGuard,
  ],
  controllers: [BillingController],
  exports: [
    BillingService,
    FeatureGateService,
    BillingPlanGuard,
    BillingFeatureGuard,
  ],
})
export class BillingModule {}
