import { Module } from '@nestjs/common';
import { BillNegotiationService } from './bill-negotiation.service';
import { BillNegotiationController } from './bill-negotiation.controller';

@Module({
  providers: [BillNegotiationService],
  controllers: [BillNegotiationController],
  exports: [BillNegotiationService],
})
export class BillNegotiationModule {}
