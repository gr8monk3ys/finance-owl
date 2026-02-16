import { Module } from '@nestjs/common';
import { BankSyncService } from './bank-sync.service';
import { BankSyncController } from './bank-sync.controller';
import { PlaidProvider } from './plaid.provider';
import { MxProvider } from './mx.provider';
import { FinicityProvider } from './finicity.provider';
import { AggregatorFactory } from './aggregator.factory';
import { PlaidSyncService } from './plaid-sync.service';
import { PlaidSandboxService } from './plaid-sandbox.service';
import { WebhookController } from './webhook.controller';
import { JobsModule } from '../jobs/jobs.module';
import { TransactionSyncProcessor } from '../jobs/transaction-sync.processor';
import { TransactionSyncScheduler } from '../jobs/transaction-sync.scheduler';

@Module({
  imports: [JobsModule],
  providers: [
    BankSyncService,
    PlaidProvider,
    MxProvider,
    FinicityProvider,
    AggregatorFactory,
    PlaidSyncService,
    PlaidSandboxService,
    TransactionSyncProcessor,
    TransactionSyncScheduler,
  ],
  controllers: [BankSyncController, WebhookController],
  exports: [
    BankSyncService,
    PlaidProvider,
    PlaidSyncService,
    PlaidSandboxService,
    AggregatorFactory,
    TransactionSyncScheduler,
  ],
})
export class BankSyncModule {}
