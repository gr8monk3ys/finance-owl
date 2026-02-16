import { Module } from '@nestjs/common';
import { CalculatorsService } from './calculators.service';
import { CalculatorsController } from './calculators.controller';

@Module({
  providers: [CalculatorsService],
  controllers: [CalculatorsController],
  exports: [CalculatorsService],
})
export class CalculatorsModule {}
