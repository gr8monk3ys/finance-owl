import { Controller, Get, Post, Query, Param, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { SpendingAnalyticsService } from './spending-analytics.service';
import { NetWorthService } from './net-worth.service';
import { SafeToSpendService } from './safe-to-spend.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsForecastingService } from './forecasting.service';
import { InsightsService } from './insights.service';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// -- DTOs -------------------------------------------------------------------

class DateRangeDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2025-01-01' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2025-12-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}

class SpendingByCategoryDto extends DateRangeDto {}

class SpendingByMerchantDto extends DateRangeDto {
  @ApiPropertyOptional({ description: 'Max number of merchants to return', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

class SpendingOverTimeDto extends DateRangeDto {
  @ApiPropertyOptional({
    description: 'Time granularity for the series',
    enum: ['day', 'week', 'month'],
    default: 'month',
  })
  @IsOptional()
  @IsString()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';
}

class MonthsQueryDto {
  @ApiPropertyOptional({ description: 'Number of months to look back', minimum: 1, maximum: 24, default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(24)
  months?: number;
}

class DaysQueryDto {
  @ApiPropertyOptional({ description: 'Number of days to look back', minimum: 1, maximum: 365, default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;
}

class ForecastDto {
  @ApiPropertyOptional({ description: 'Number of days to forecast ahead', minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(365)
  daysAhead?: number;
}

class CanIAffordDto {
  @ApiProperty({ description: 'Amount to check affordability for', minimum: 0, example: 250.00 })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  amount!: number;
}

// -- Controller -------------------------------------------------------------

@ApiTags('Analytics')
@ApiBearerAuth('bearer')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private spendingService: SpendingAnalyticsService,
    private netWorthService: NetWorthService,
    private safeToSpendService: SafeToSpendService,
    private analyticsService: AnalyticsService,
    private forecastingService: AnalyticsForecastingService,
    private insightsService: InsightsService,
  ) {}

  // -- Legacy endpoints (kept for backwards compatibility) ------------------

  @ApiOperation({ summary: 'Get dashboard summary (income, expenses, savings rate)' })
  @ApiResponse({ status: 200, description: 'Dashboard analytics summary' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('dashboard')
  getDashboard(@CurrentUser('id') userId: string) {
    return this.spendingService.getDashboardSummary(userId);
  }

  @ApiOperation({ summary: 'Get spending breakdown by category' })
  @ApiResponse({ status: 200, description: 'Category spending breakdown' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('spending/categories')
  getCategoryBreakdown(
    @CurrentUser('id') userId: string,
    @Query() dto: DateRangeDto,
  ) {
    const now = new Date();
    const startDate =
      dto.startDate ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = dto.endDate || now.toISOString().split('T')[0];
    return this.spendingService.getCategoryBreakdown(
      userId,
      startDate,
      endDate,
    );
  }

  @ApiOperation({ summary: 'Get monthly spending trend' })
  @ApiResponse({ status: 200, description: 'Monthly spending trend data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('spending/trend')
  getMonthlyTrend(
    @CurrentUser('id') userId: string,
    @Query() dto: MonthsQueryDto,
  ) {
    return this.spendingService.getMonthlyTrend(userId, dto.months || 6);
  }

  @ApiOperation({ summary: 'Get top merchants by spending' })
  @ApiResponse({ status: 200, description: 'Top merchants list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('spending/merchants')
  getTopMerchants(
    @CurrentUser('id') userId: string,
    @Query() dto: DateRangeDto,
  ) {
    const now = new Date();
    const startDate =
      dto.startDate ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = dto.endDate || now.toISOString().split('T')[0];
    return this.spendingService.getTopMerchants(userId, startDate, endDate);
  }

  @ApiOperation({ summary: 'Get net worth history over time' })
  @ApiResponse({ status: 200, description: 'Net worth history data points' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('net-worth/history')
  getNetWorthHistory(
    @CurrentUser('id') userId: string,
    @Query() dto: DaysQueryDto,
  ) {
    return this.netWorthService.getHistory(userId, dto.days || 90);
  }

  @ApiOperation({ summary: 'Take a snapshot of current net worth' })
  @ApiResponse({ status: 200, description: 'Net worth snapshot created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('net-worth/snapshot')
  async takeSnapshot(@CurrentUser('id') userId: string) {
    return this.netWorthService.snapshotNetWorth(userId);
  }

  @ApiOperation({ summary: 'Calculate safe-to-spend amount based on budgets and upcoming bills' })
  @ApiResponse({ status: 200, description: 'Safe-to-spend calculation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('safe-to-spend')
  getSafeToSpend(@CurrentUser('id') userId: string) {
    return this.safeToSpendService.calculate(userId);
  }

  @ApiOperation({ summary: 'Get daily spending allowance' })
  @ApiResponse({ status: 200, description: 'Daily allowance amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('daily-allowance')
  getDailyAllowance(@CurrentUser('id') userId: string) {
    return this.safeToSpendService.getDailyAllowance(userId);
  }

  @ApiOperation({ summary: 'Check if a purchase is affordable given current budget' })
  @ApiResponse({ status: 201, description: 'Affordability check result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('can-i-afford')
  canIAfford(
    @CurrentUser('id') userId: string,
    @Body() dto: CanIAffordDto,
  ) {
    return this.safeToSpendService.canIAfford(userId, dto.amount);
  }

  // -- New analytics endpoints ----------------------------------------------

  @ApiOperation({ summary: 'Get spending aggregated by category for a date range' })
  @ApiResponse({ status: 200, description: 'Spending by category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('spending/by-category')
  getSpendingByCategory(
    @CurrentUser('id') userId: string,
    @Query() dto: SpendingByCategoryDto,
  ) {
    const { startDate, endDate } = resolveDefaultDateRange(dto);
    return this.analyticsService.getSpendingByCategory(userId, startDate, endDate);
  }

  @ApiOperation({ summary: 'Get spending aggregated by merchant for a date range' })
  @ApiResponse({ status: 200, description: 'Spending by merchant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('spending/by-merchant')
  getSpendingByMerchant(
    @CurrentUser('id') userId: string,
    @Query() dto: SpendingByMerchantDto,
  ) {
    const { startDate, endDate } = resolveDefaultDateRange(dto);
    return this.analyticsService.getSpendingByMerchant(
      userId,
      startDate,
      endDate,
      dto.limit || 10,
    );
  }

  @ApiOperation({ summary: 'Get spending over time as a time series' })
  @ApiResponse({ status: 200, description: 'Spending time series' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('spending/over-time')
  getSpendingOverTime(
    @CurrentUser('id') userId: string,
    @Query() dto: SpendingOverTimeDto,
  ) {
    const { startDate, endDate } = resolveDefaultDateRange(dto);
    return this.analyticsService.getSpendingOverTime(
      userId,
      startDate,
      endDate,
      dto.granularity || 'month',
    );
  }

  @ApiOperation({ summary: 'Get income vs expenses (cash flow) over time' })
  @ApiResponse({ status: 200, description: 'Cash flow data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('cash-flow')
  getCashFlow(
    @CurrentUser('id') userId: string,
    @Query() dto: DateRangeDto,
  ) {
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const startDate = dto.startDate || sixMonthsAgo.toISOString().split('T')[0];
    const endDate = dto.endDate || now.toISOString().split('T')[0];
    return this.analyticsService.getIncomeVsExpenses(userId, startDate, endDate);
  }

  @ApiOperation({ summary: 'Get spending trends per category over recent months' })
  @ApiResponse({ status: 200, description: 'Category trends data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('category-trends')
  getCategoryTrends(
    @CurrentUser('id') userId: string,
    @Query() dto: MonthsQueryDto,
  ) {
    return this.analyticsService.getCategoryTrends(userId, dto.months || 6);
  }

  @ApiOperation({ summary: 'Get daily average spending over a period' })
  @ApiResponse({ status: 200, description: 'Daily average spend amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('daily-average')
  getDailyAverage(
    @CurrentUser('id') userId: string,
    @Query() dto: DaysQueryDto,
  ) {
    return this.analyticsService.getDailyAverageSpend(userId, dto.days || 30);
  }

  @ApiOperation({ summary: 'Forecast cash flow for upcoming days' })
  @ApiResponse({ status: 200, description: 'Cash flow forecast' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('forecast')
  getForecast(
    @CurrentUser('id') userId: string,
    @Query() dto: ForecastDto,
  ) {
    return this.forecastingService.forecastCashFlow(
      userId,
      dto.daysAhead || 30,
    );
  }

  @ApiOperation({ summary: 'Predict end-of-month balance' })
  @ApiResponse({ status: 200, description: 'End-of-month balance projection' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('forecast/end-of-month')
  getEndOfMonthProjection(@CurrentUser('id') userId: string) {
    return this.forecastingService.predictEndOfMonthBalance(userId);
  }

  @ApiOperation({ summary: 'Identify overdraft risk in upcoming days' })
  @ApiResponse({ status: 200, description: 'Overdraft risk assessment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('forecast/overdraft-risk')
  getOverdraftRisk(
    @CurrentUser('id') userId: string,
    @Query() dto: ForecastDto,
  ) {
    return this.forecastingService.identifyOverdraftRisk(
      userId,
      dto.daysAhead || 30,
    );
  }

  @ApiOperation({ summary: 'Project savings goal completion date' })
  @ApiParam({ name: 'goalId', description: 'Savings goal ID' })
  @ApiResponse({ status: 200, description: 'Savings goal projection' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Savings goal not found' })
  @Get('forecast/savings-goal/:goalId')
  getSavingsGoalProjection(
    @CurrentUser('id') userId: string,
    @Param('goalId') goalId: string,
  ) {
    return this.forecastingService.projectSavingsGoal(userId, goalId);
  }

  @ApiOperation({ summary: 'Generate AI-powered financial insights' })
  @ApiResponse({ status: 200, description: 'List of financial insights' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('insights')
  getInsights(@CurrentUser('id') userId: string) {
    return this.insightsService.generateInsights(userId);
  }
}

// -- Helper -----------------------------------------------------------------

function resolveDefaultDateRange(dto: { startDate?: string; endDate?: string }) {
  const now = new Date();
  const startDate =
    dto.startDate ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = dto.endDate || now.toISOString().split('T')[0];
  return { startDate, endDate };
}
