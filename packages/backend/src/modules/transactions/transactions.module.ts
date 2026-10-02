import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsService } from './transactions.service';
import { TransactionSplitService } from './transaction-split.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [CategoriesModule],
  providers: [TransactionsService, TransactionSplitService],
  controllers: [TransactionsController],
  exports: [TransactionsService, TransactionSplitService],
})
export class TransactionsModule {}
