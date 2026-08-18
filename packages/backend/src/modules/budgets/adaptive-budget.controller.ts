import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { AdaptiveBudgetService } from './adaptive-budget.service';
import { IsString, IsIn } from 'class-validator';

class AutoAdjustDto {
  @IsString()
  @IsIn(['conservative', 'moderate', 'aggressive'])
  sensitivity!: 'conservative' | 'moderate' | 'aggressive';
}

@Controller('budgets')
export class AdaptiveBudgetController {
  constructor(private readonly adaptiveBudgetService: AdaptiveBudgetService) {}

  @Get('suggestions')
  suggestBudgets(@CurrentUser('id') userId: string) {
    return this.adaptiveBudgetService.suggestBudgets(userId);
  }

  @Get('seasonal-patterns')
  getSeasonalPatterns(@CurrentUser('id') userId: string) {
    return this.adaptiveBudgetService.detectSeasonalPatterns(userId);
  }

  @Post('auto-adjust')
  @HttpCode(HttpStatus.OK)
  autoAdjust(@CurrentUser('id') userId: string, @Body() dto: AutoAdjustDto) {
    return this.adaptiveBudgetService.autoAdjustBudgets(userId, dto.sensitivity);
  }

  @Get('insights')
  getInsights(@CurrentUser('id') userId: string) {
    return this.adaptiveBudgetService.getBudgetInsights(userId);
  }

  @Get('predictions')
  getPredictions(@CurrentUser('id') userId: string) {
    return this.adaptiveBudgetService.predictNextMonth(userId);
  }
}
