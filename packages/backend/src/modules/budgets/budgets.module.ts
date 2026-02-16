import { Module } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { EnvelopesService } from './envelopes.service';
import { EnvelopesController } from './envelopes.controller';
import { AdaptiveBudgetService } from './adaptive-budget.service';
import { AdaptiveBudgetController } from './adaptive-budget.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [BudgetsService, EnvelopesService, AdaptiveBudgetService],
  controllers: [AdaptiveBudgetController, BudgetsController, EnvelopesController],
  exports: [BudgetsService, EnvelopesService, AdaptiveBudgetService],
})
export class BudgetsModule {}
