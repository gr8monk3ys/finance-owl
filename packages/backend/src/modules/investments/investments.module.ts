import { Module } from '@nestjs/common';
import { InvestmentSyncService } from './investment-sync.service';
import { HoldingsService } from './holdings.service';
import { AllocationService } from './allocation.service';
import { PerformanceService } from './performance.service';
import { FeeAnalyzerService } from './fee-analyzer.service';
import { InvestmentsController } from './investments.controller';
import { InvestmentSyncProcessor } from '../jobs/investment-sync.processor';
import { InvestmentSyncScheduler } from '../jobs/investment-sync.scheduler';
import { BankSyncModule } from '../bank-sync/bank-sync.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [BankSyncModule, JobsModule],
  providers: [
    InvestmentSyncService,
    HoldingsService,
    AllocationService,
    PerformanceService,
    FeeAnalyzerService,
    InvestmentSyncProcessor,
    InvestmentSyncScheduler,
  ],
  controllers: [InvestmentsController],
  exports: [
    HoldingsService,
    AllocationService,
    PerformanceService,
    FeeAnalyzerService,
    InvestmentSyncScheduler,
  ],
})
export class InvestmentsModule {}
