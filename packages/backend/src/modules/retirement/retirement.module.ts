import { Module } from '@nestjs/common';
import { RetirementService } from './retirement.service';
import { RetirementController } from './retirement.controller';

@Module({
  providers: [RetirementService],
  controllers: [RetirementController],
  exports: [RetirementService],
})
export class RetirementModule {}
