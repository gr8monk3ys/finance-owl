import { Module } from '@nestjs/common';
import { CreditSimulatorService } from './credit-simulator.service';
import { CreditSimulatorController } from './credit-simulator.controller';

@Module({
  providers: [CreditSimulatorService],
  controllers: [CreditSimulatorController],
  exports: [CreditSimulatorService],
})
export class CreditSimulatorModule {}
