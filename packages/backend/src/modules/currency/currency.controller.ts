import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { CurrencyService } from './currency.service';
import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class ConvertQueryDto {
  @IsNumber()
  @Type(() => Number)
  amount!: number;

  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  @IsIn(['symbol', 'code', 'name'])
  displayFormat?: string;
}

@Controller('currency')
export class CurrencyController {
  constructor(private currencyService: CurrencyService) {}

  @Get('rates')
  getRates(@Query('base') base?: string) {
    return this.currencyService.getExchangeRates(base ?? 'USD');
  }

  @Get('convert')
  convert(
    @Query('amount') amount: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.currencyService.convert(
      parseFloat(amount) || 0,
      from ?? 'USD',
      to ?? 'EUR',
    );
  }

  @Get('preferences')
  getPreferences(@CurrentUser('id') userId: string) {
    return this.currencyService.getUserPreference(userId);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.currencyService.setUserPreference(userId, dto);
  }

  @Get('supported')
  getSupported() {
    return this.currencyService.getSupportedCurrencies();
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshRates() {
    return this.currencyService.refreshRates();
  }
}
