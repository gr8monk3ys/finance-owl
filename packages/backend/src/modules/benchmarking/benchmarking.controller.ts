import {
  Controller,
  Get,
  Put,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { BenchmarkingService } from './benchmarking.service';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpsertBenchmarkProfileDto {
  @IsString()
  @IsIn(['18-24', '25-34', '35-44', '45-54', '55-64', '65+'])
  ageRange!: string;

  @IsString()
  @IsIn([
    'under_25k',
    '25k_50k',
    '50k_75k',
    '75k_100k',
    '100k_150k',
    '150k_plus',
  ])
  incomeRange!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  householdSize?: number;

  @IsOptional()
  @IsBoolean()
  isOptedIn?: boolean;
}

@Controller('benchmarking')
export class BenchmarkingController {
  constructor(private benchmarkingService: BenchmarkingService) {}

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.benchmarkingService.getProfile(userId);
  }

  @Put('profile')
  upsertProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertBenchmarkProfileDto,
  ) {
    return this.benchmarkingService.upsertProfile(userId, dto);
  }

  @Get('comparison')
  getComparison(@CurrentUser('id') userId: string) {
    return this.benchmarkingService.getComparison(userId);
  }

  @Get('benchmarks')
  getBenchmarks(@CurrentUser('id') userId: string) {
    return this.benchmarkingService.getBenchmarks(userId);
  }
}
