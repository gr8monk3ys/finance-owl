import { Module } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController } from './account-deletion.controller';
import { EmailModule } from '../email/email.module';
import { BankSyncModule } from '../bank-sync/bank-sync.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [EmailModule, BankSyncModule, BillingModule],
  providers: [AccountDeletionService],
  controllers: [AccountDeletionController],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
