import { Module } from '@nestjs/common';
import { DebtPayoffService } from './debt-payoff.service';
import { DebtPayoffController } from './debt-payoff.controller';

@Module({
  providers: [DebtPayoffService],
  controllers: [DebtPayoffController],
  exports: [DebtPayoffService],
})
export class DebtPayoffModule {}
