import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { FinancialHealthService } from './financial-health.service';
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class CreateGoalDto {
  @IsString()
  @IsIn(['savings', 'debt', 'spending', 'investment', 'emergency'])
  category!: string;

  @IsNumber()
  @Type(() => Number)
  targetValue!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentValue?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

class UpdateGoalDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentValue?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAchieved?: boolean;
}

@Controller('financial-health')
export class FinancialHealthController {
  constructor(private financialHealthService: FinancialHealthService) {}

  @Get('score')
  getLatestScore(@CurrentUser('id') userId: string) {
    return this.financialHealthService.getLatestScore(userId);
  }

  @Get('score/history')
  getScoreHistory(@CurrentUser('id') userId: string) {
    return this.financialHealthService.getScoreHistory(userId);
  }

  @Post('score/calculate')
  @HttpCode(HttpStatus.OK)
  calculateScore(@CurrentUser('id') userId: string) {
    return this.financialHealthService.calculateScore(userId);
  }

  @Get('goals')
  getGoals(@CurrentUser('id') userId: string) {
    return this.financialHealthService.getGoals(userId);
  }

  @Post('goals')
  createGoal(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.financialHealthService.createGoal(userId, dto);
  }

  @Patch('goals/:id')
  updateGoal(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.financialHealthService.updateGoal(userId, id, dto);
  }
}
