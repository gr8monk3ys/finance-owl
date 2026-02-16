import { Module } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';
import { ForecastingController } from './forecasting.controller';

@Module({
  providers: [ForecastingService],
  controllers: [ForecastingController],
  exports: [ForecastingService],
})
export class ForecastingModule {}
