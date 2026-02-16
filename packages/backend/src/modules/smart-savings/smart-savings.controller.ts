import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { SmartSavingsService } from './smart-savings.service';
import { CreateRuleDto, UpdateRuleDto } from './dto';

@Controller('smart-savings')
export class SmartSavingsController {
  constructor(private smartSavingsService: SmartSavingsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser('id') userId: string) {
    return this.smartSavingsService.getDashboard(userId);
  }

  @Get('analysis')
  getAnalysis(@CurrentUser('id') userId: string) {
    return this.smartSavingsService.getLatestAnalysis(userId);
  }

  @Post('analyze')
  triggerAnalysis(@CurrentUser('id') userId: string) {
    return this.smartSavingsService.analyzeSpendingPatterns(userId);
  }

  @Get('rules')
  getRules(@CurrentUser('id') userId: string) {
    return this.smartSavingsService.getRules(userId);
  }

  @Post('rules')
  createRule(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRuleDto,
  ) {
    return this.smartSavingsService.createRule(userId, dto);
  }

  @Patch('rules/:id')
  updateRule(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.smartSavingsService.updateRule(userId, id, dto);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.smartSavingsService.deleteRule(userId, id);
  }

  @Get('projected')
  getProjectedSavings(
    @CurrentUser('id') userId: string,
    @Query('months') months: string = '12',
  ) {
    return this.smartSavingsService.getProjectedSavings(
      userId,
      parseInt(months, 10) || 12,
    );
  }

  @Get('history')
  getSavingsHistory(
    @CurrentUser('id') userId: string,
    @Query('months') months: string = '6',
  ) {
    return this.smartSavingsService.getSavingsHistory(
      userId,
      parseInt(months, 10) || 6,
    );
  }
}
