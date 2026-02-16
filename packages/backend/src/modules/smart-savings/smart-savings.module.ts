import { Module } from '@nestjs/common';
import { SmartSavingsService } from './smart-savings.service';
import { SmartSavingsController } from './smart-savings.controller';
import { RoundUpService } from './roundup.service';
import { RoundUpController } from './roundup.controller';

@Module({
  providers: [SmartSavingsService, RoundUpService],
  controllers: [SmartSavingsController, RoundUpController],
  exports: [SmartSavingsService, RoundUpService],
})
export class SmartSavingsModule {}
