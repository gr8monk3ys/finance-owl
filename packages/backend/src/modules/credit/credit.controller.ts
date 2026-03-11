import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CreditService } from './credit.service';
import { AddScoreDto } from './dto/add-score.dto';
import { SimulateDto } from './dto/simulate.dto';
import { IsOptional, IsNumber, IsString, IsIn, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  months?: number;
}

class FileDisputeDto {
  @IsString()
  accountId!: string;

  @IsString()
  @IsIn(['not_mine', 'incorrect_balance', 'incorrect_status', 'incorrect_date', 'other'])
  reason!: 'not_mine' | 'incorrect_balance' | 'incorrect_status' | 'incorrect_date' | 'other';

  @IsString()
  explanation!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportingDocuments?: string[];
}

@Controller('credit')
export class CreditController {
  constructor(private creditService: CreditService) {}

  @Get('score')
  getCurrentScore(@CurrentUser('id') userId: string) {
    return this.creditService.getCurrentScore(userId);
  }

  @Get('latest')
  getLatestScore(@CurrentUser('id') userId: string) {
    return this.creditService.getCurrentScore(userId);
  }

  @Get('report')
  getCreditReport(@CurrentUser('id') userId: string) {
    return this.creditService.getCreditReport(userId);
  }

  @Get('factors')
  getFactors(@CurrentUser('id') userId: string) {
    return this.creditService.getFactors(userId);
  }

  @Get('history')
  getScoreHistory(
    @CurrentUser('id') userId: string,
    @Query() dto: HistoryQueryDto,
  ) {
    return this.creditService.getScoreHistory(userId, dto.months || 12);
  }

  @Post('score')
  addScore(
    @CurrentUser('id') userId: string,
    @Body() dto: AddScoreDto,
  ) {
    return this.creditService.addScore(userId, dto);
  }

  // ---------------------------------------------------------------------------
  // Disputes
  // ---------------------------------------------------------------------------

  @Post('disputes')
  fileDispute(
    @CurrentUser('id') userId: string,
    @Body() dto: FileDisputeDto,
  ) {
    return this.creditService.fileDispute(userId, dto);
  }

  @Get('disputes')
  getDisputes(@CurrentUser('id') userId: string) {
    return this.creditService.getDisputes(userId);
  }

  @Get('disputes/:id')
  getDisputeById(@Param('id') disputeId: string) {
    return this.creditService.getDisputeById(disputeId);
  }

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------

  @Get('alerts')
  getAlerts(@CurrentUser('id') userId: string) {
    return this.creditService.getAlerts(userId);
  }

  @Patch('alerts/:id/read')
  markAlertRead(
    @CurrentUser('id') userId: string,
    @Param('id') alertId: string,
  ) {
    return this.creditService.markAlertRead(userId, alertId);
  }

  // ---------------------------------------------------------------------------
  // Monitoring
  // ---------------------------------------------------------------------------

  @Post('monitoring')
  setupMonitoring(@CurrentUser('id') userId: string) {
    return this.creditService.setupMonitoring(userId);
  }

  // ---------------------------------------------------------------------------
  // Simulator
  // ---------------------------------------------------------------------------

  @Post('simulate')
  simulate(
    @CurrentUser('id') userId: string,
    @Body() dto: SimulateDto,
  ) {
    return this.creditService.simulateScoreChange(userId, dto);
  }
}
