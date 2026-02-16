import { Module } from '@nestjs/common';
import { FinancialHealthService } from './financial-health.service';
import { FinancialHealthController } from './financial-health.controller';

@Module({
  providers: [FinancialHealthService],
  controllers: [FinancialHealthController],
  exports: [FinancialHealthService],
})
export class FinancialHealthModule {}
