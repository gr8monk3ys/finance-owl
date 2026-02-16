import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionSplitService } from './transaction-split.service';
import { TransactionsController } from './transactions.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [TransactionsService, TransactionSplitService],
  controllers: [TransactionsController],
  exports: [TransactionsService, TransactionSplitService],
})
export class TransactionsModule {}
