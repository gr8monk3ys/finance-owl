import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { ForecastingService } from './forecasting.service';

@Controller('forecasting')
export class ForecastingController {
  constructor(private forecastingService: ForecastingService) {}

  @Get('forecast')
  getForecast(
    @CurrentUser('id') userId: string,
    @Query('months') months: string = '6',
  ) {
    return this.forecastingService.getForecast(userId, {
      months: parseInt(months, 10) || 6,
    });
  }

  @Get('cash-flow')
  getRecurringCashFlow(@CurrentUser('id') userId: string) {
    return this.forecastingService.getRecurringCashFlow(userId);
  }
}
