import { Module } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { AdaptiveBudgetService } from './adaptive-budget.service';
import { AdaptiveBudgetController } from './adaptive-budget.controller';

@Module({
  providers: [BudgetsService, AdaptiveBudgetService],
  controllers: [AdaptiveBudgetController, BudgetsController],
  exports: [BudgetsService, AdaptiveBudgetService],
})
export class BudgetsModule {}
