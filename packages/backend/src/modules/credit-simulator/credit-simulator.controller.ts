import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CreditSimulatorService, type SimulationScenario } from './credit-simulator.service';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpsertProfileDto {
  @IsNumber()
  @Type(() => Number)
  @Min(300)
  @Max(850)
  currentScore!: number;

  @IsString()
  scoreDate!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  paymentHistory!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  creditUtilization!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  accountAge!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  totalAccounts!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  hardInquiries!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  derogatoryMarks!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  totalDebt!: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  availableCredit!: number;
}

class SimulateDto {
  @IsString()
  @IsIn([
    'pay_debt',
    'open_card',
    'close_card',
    'hard_inquiry',
    'on_time_payments',
    'increase_limit',
  ])
  type!: string;

  @IsObject()
  parameters!: Record<string, number>;
}

@Controller('credit-simulator')
export class CreditSimulatorController {
  constructor(private creditSimulatorService: CreditSimulatorService) {}

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.creditSimulatorService.getProfile(userId);
  }

  @Put('profile')
  upsertProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpsertProfileDto,
  ) {
    return this.creditSimulatorService.upsertProfile(userId, dto);
  }

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  simulate(
    @CurrentUser('id') userId: string,
    @Body() dto: SimulateDto,
  ) {
    const scenario: SimulationScenario = {
      type: dto.type as SimulationScenario['type'],
      parameters: dto.parameters,
    };
    return this.creditSimulatorService.simulate(userId, scenario);
  }

  @Get('simulations')
  getSimulations(@CurrentUser('id') userId: string) {
    return this.creditSimulatorService.getSimulationHistory(userId);
  }
}
