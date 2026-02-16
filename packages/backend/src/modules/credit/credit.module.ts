import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditSimulatorService } from './credit-simulator.service';
import { CreditController } from './credit.controller';
import { TransUnionProvider } from './providers/transunion.provider';
import { EquifaxProvider } from './providers/equifax.provider';
import { ExperianProvider } from './providers/experian.provider';
import { BureauFactory } from './providers/bureau.factory';

@Module({
  providers: [
    CreditService,
    CreditSimulatorService,
    TransUnionProvider,
    EquifaxProvider,
    ExperianProvider,
    BureauFactory,
  ],
  controllers: [CreditController],
  exports: [CreditService, BureauFactory],
})
export class CreditModule {}
