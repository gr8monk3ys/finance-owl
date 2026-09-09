import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { BillingPlanGuard, BillingFeatureGuard } from './billing.guard';
import { stripeProvider } from './stripe.provider';

@Module({
  imports: [ConfigModule],
  providers: [stripeProvider, BillingService, BillingPlanGuard, BillingFeatureGuard],
  controllers: [BillingController],
  exports: [BillingService, BillingPlanGuard, BillingFeatureGuard],
})
export class BillingModule {}
