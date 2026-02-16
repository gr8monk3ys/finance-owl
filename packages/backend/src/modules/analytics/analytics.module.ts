import { Module } from '@nestjs/common';
import { SpendingAnalyticsService } from './spending-analytics.service';
import { NetWorthService } from './net-worth.service';
import { SafeToSpendService } from './safe-to-spend.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsForecastingService } from './forecasting.service';
import { InsightsService } from './insights.service';
import { AnalyticsController } from './analytics.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { JobsModule } from '../jobs/jobs.module';
import { NetWorthSnapshotProcessor } from '../jobs/net-worth-snapshot.processor';
import { NetWorthSnapshotScheduler } from '../jobs/net-worth-snapshot.scheduler';

@Module({
  imports: [AccountsModule, JobsModule],
  providers: [
    SpendingAnalyticsService,
    NetWorthService,
    SafeToSpendService,
    AnalyticsService,
    AnalyticsForecastingService,
    InsightsService,
    NetWorthSnapshotProcessor,
    NetWorthSnapshotScheduler,
  ],
  controllers: [AnalyticsController],
  exports: [
    SpendingAnalyticsService,
    NetWorthService,
    SafeToSpendService,
    AnalyticsService,
    AnalyticsForecastingService,
    InsightsService,
  ],
})
export class AnalyticsModule {}
