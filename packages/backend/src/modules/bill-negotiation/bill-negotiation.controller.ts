import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { BillNegotiationService } from './bill-negotiation.service';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class StartNegotiationDto {
  @IsString()
  billName!: string;

  @IsString()
  provider!: string;

  @IsNumber()
  @Type(() => Number)
  currentAmount!: number;

  @IsNumber()
  @Type(() => Number)
  targetAmount!: number;

  @IsString()
  @IsIn([
    'internet',
    'cable',
    'phone',
    'insurance',
    'streaming',
    'utilities',
    'other',
  ])
  category!: string;

  @IsOptional()
  @IsString()
  @IsIn(['self_service', 'script'])
  method?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateNegotiationDto {
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'in_progress', 'success', 'failed', 'skipped'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  negotiatedAmount?: number;

  @IsOptional()
  @IsString()
  expirationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('bill-negotiation')
export class BillNegotiationController {
  constructor(private billNegotiationService: BillNegotiationService) {}

  @Get('analyze')
  analyzeBills(@CurrentUser('id') userId: string) {
    return this.billNegotiationService.analyzeBills(userId);
  }

  @Get('providers')
  getProviders() {
    return this.billNegotiationService.getProviders();
  }

  @Get('summary')
  getSavingsSummary(@CurrentUser('id') userId: string) {
    return this.billNegotiationService.getSavingsSummary(userId);
  }

  @Get('expiring')
  getExpiringRates(
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 90;
    return this.billNegotiationService.checkForRateExpiration(userId, daysNum);
  }

  @Get('script/:provider')
  getNegotiationScript(
    @Param('provider') provider: string,
    @Query('category') category?: string,
    @Query('currentAmount') currentAmount?: string,
    @Query('targetAmount') targetAmount?: string,
  ) {
    return this.billNegotiationService.getNegotiationScript(
      decodeURIComponent(provider),
      category ?? 'other',
      currentAmount ? parseFloat(currentAmount) : undefined,
      targetAmount ? parseFloat(targetAmount) : undefined,
    );
  }

  @Get('provider-info/:provider')
  getProviderInfo(@Param('provider') provider: string) {
    const info = this.billNegotiationService.getProviderInfo(
      decodeURIComponent(provider),
    );
    return info ?? { message: 'Provider not found in database' };
  }

  @Get()
  getBillNegotiations(@CurrentUser('id') userId: string) {
    return this.billNegotiationService.getBillNegotiations(userId);
  }

  @Post()
  startNegotiation(
    @CurrentUser('id') userId: string,
    @Body() dto: StartNegotiationDto,
  ) {
    return this.billNegotiationService.startNegotiation(userId, dto);
  }

  @Patch(':id')
  updateNegotiationResult(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNegotiationDto,
  ) {
    return this.billNegotiationService.updateNegotiationResult(
      userId,
      id,
      dto,
    );
  }
}
