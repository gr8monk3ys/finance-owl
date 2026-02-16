import {
  Controller,
  Get,
  Put,
  Post,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { RoundUpService } from './roundup.service';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateRoundUpConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsIn([1, 5, 10])
  roundTo?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  multiplier?: number;

  @IsOptional()
  @IsString()
  savingsGoalId?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxDailyRoundUp?: number | null;

  @IsOptional()
  @IsString()
  accountId?: string | null;
}

@Controller('round-ups')
export class RoundUpController {
  constructor(private roundUpService: RoundUpService) {}

  @Get('config')
  getConfig(@CurrentUser('id') userId: string) {
    return this.roundUpService.getRoundUpConfig(userId);
  }

  @Put('config')
  updateConfig(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRoundUpConfigDto,
  ) {
    return this.roundUpService.configureRoundUp(userId, dto);
  }

  @Get('pending')
  getPending(@CurrentUser('id') userId: string) {
    return this.roundUpService.calculatePendingRoundUps(userId);
  }

  @Post('process')
  processRoundUps(@CurrentUser('id') userId: string) {
    return this.roundUpService.processRoundUps(userId);
  }

  @Get('stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.roundUpService.getRoundUpStats(userId);
  }
}
