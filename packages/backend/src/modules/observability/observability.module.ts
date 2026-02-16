import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './logging.interceptor';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { SentryModule } from '../../common/sentry';

@Module({
  imports: [SentryModule],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class ObservabilityModule {}
