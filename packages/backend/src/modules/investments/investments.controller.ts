import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { HoldingsService } from './holdings.service';
import { AllocationService } from './allocation.service';
import { PerformanceService } from './performance.service';
import { FeeAnalyzerService } from './fee-analyzer.service';
import { InvestmentSyncScheduler } from '../jobs/investment-sync.scheduler';
import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';

class PerformanceQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['1M', '3M', '6M', '1Y', 'YTD', 'ALL'])
  period?: string;
}

class FeeImpactQueryDto {
  @IsOptional()
  @IsNumberString()
  years?: string;
}

@Controller('investments')
export class InvestmentsController {
  constructor(
    private holdingsService: HoldingsService,
    private allocationService: AllocationService,
    private performanceService: PerformanceService,
    private feeAnalyzerService: FeeAnalyzerService,
    private investmentSyncScheduler: InvestmentSyncScheduler,
  ) {}

  @Get('holdings')
  getHoldings(@CurrentUser('id') userId: string) {
    return this.holdingsService.getHoldings(userId);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.holdingsService.getPortfolioSummary(userId);
  }

  @Get('allocation')
  getAllocation(@CurrentUser('id') userId: string) {
    return this.allocationService.getCurrentAllocation(userId);
  }

  @Get('performance')
  getPerformance(
    @CurrentUser('id') userId: string,
    @Query() dto: PerformanceQueryDto,
  ) {
    const period = (dto.period ?? '1Y') as
      | '1M'
      | '3M'
      | '6M'
      | '1Y'
      | 'YTD'
      | 'ALL';
    return this.performanceService.getPerformance(userId, period);
  }

  @Get('rebalance')
  getRebalancingSuggestions(@CurrentUser('id') userId: string) {
    return this.allocationService.getRebalancingSuggestions(userId);
  }

  // ---------- Fee Analyzer endpoints ----------

  @Get('fees')
  getFeeAnalysis(@CurrentUser('id') userId: string) {
    return this.feeAnalyzerService.analyzeExpenseRatios(userId);
  }

  @Get('fees/impact')
  getFeeImpact(
    @CurrentUser('id') userId: string,
    @Query() dto: FeeImpactQueryDto,
  ) {
    const years = dto.years ? parseInt(dto.years, 10) : 30;
    return this.feeAnalyzerService.calculateLifetimeFeeImpact(userId, years);
  }

  @Get('fees/alternatives')
  getFeeAlternatives(@CurrentUser('id') userId: string) {
    return this.feeAnalyzerService.suggestAllAlternatives(userId);
  }

  @Get('fees/summary')
  getFeeSummary(@CurrentUser('id') userId: string) {
    return this.feeAnalyzerService.getPortfolioFeeSummary(userId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async triggerSync(@CurrentUser('id') userId: string) {
    await this.investmentSyncScheduler.queueSyncForAllItems();
    return { message: 'Investment sync queued' };
  }
}
