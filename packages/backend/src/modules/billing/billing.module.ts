import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingPlanGuard, BillingFeatureGuard } from './billing.guard';

@Module({
  imports: [ConfigModule],
  providers: [BillingService, BillingPlanGuard, BillingFeatureGuard],
  controllers: [BillingController],
  exports: [BillingService, BillingPlanGuard, BillingFeatureGuard],
})
export class BillingModule {}
