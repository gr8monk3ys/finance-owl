import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PlaidProvider } from './plaid.provider';
import type { BankTransaction } from './bank-sync.interface';
import * as schema from '../../database/schema';

interface SyncStats {
  added: number;
  modified: number;
  removed: number;
}

@Injectable()
export class PlaidSyncService {
  private readonly logger = new Logger(PlaidSyncService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private plaidProvider: PlaidProvider,
    private cryptoService: CryptoService,
  ) {}

  async syncTransactionsForItem(
    plaidItemId: string,
    userId: string,
  ): Promise<SyncStats> {
    // Get the Plaid item with encrypted access token
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(
        and(
          eq(schema.plaidItems.id, plaidItemId),
          eq(schema.plaidItems.userId, userId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(`Plaid item ${plaidItemId} not found`);
    }

    const accessToken = this.cryptoService.decrypt(item.accessToken);

    // Build a map of plaidAccountId -> internal accountId
    const accountRows = await this.db
      .select({
        id: schema.accounts.id,
        plaidAccountId: schema.accounts.plaidAccountId,
      })
      .from(schema.accounts)
      .where(eq(schema.accounts.plaidItemId, plaidItemId));

    const accountMap = new Map<string, string>();
    for (const row of accountRows) {
      if (row.plaidAccountId) {
        accountMap.set(row.plaidAccountId, row.id);
      }
    }

    let cursor = item.cursor;
    const stats: SyncStats = { added: 0, modified: 0, removed: 0 };

    // Paginate through all sync results
    let hasMore = true;
    while (hasMore) {
      const result = await this.plaidProvider.syncTransactions(
        accessToken,
        cursor,
      );

      // Process added transactions
      for (const tx of result.added) {
        const accountId = accountMap.get(tx.accountExternalId);
        if (!accountId) {
          this.logger.warn(
            `No account found for Plaid account ${tx.accountExternalId}, skipping transaction`,
          );
          continue;
        }
        await this.upsertTransaction(userId, accountId, tx);
        stats.added++;
      }

      // Process modified transactions
      for (const tx of result.modified) {
        const accountId = accountMap.get(tx.accountExternalId);
        if (!accountId) continue;
        await this.upsertTransaction(userId, accountId, tx);
        stats.modified++;
      }

      // Process removed transactions
      for (const externalId of result.removed) {
        await this.db
          .delete(schema.transactions)
          .where(eq(schema.transactions.plaidTransactionId, externalId));
        stats.removed++;
      }

      cursor = result.cursor;
      hasMore = result.hasMore;
    }

    // Update cursor on the Plaid item
    await this.db
      .update(schema.plaidItems)
      .set({
        cursor,
        updatedAt: new Date(),
      })
      .where(eq(schema.plaidItems.id, plaidItemId));

    return stats;
  }

  private async upsertTransaction(
    userId: string,
    accountId: string,
    tx: BankTransaction,
  ) {
    // Check if transaction already exists
    const existing = await this.db
      .select({ id: schema.transactions.id, categorizationSource: schema.transactions.categorizationSource })
      .from(schema.transactions)
      .where(eq(schema.transactions.plaidTransactionId, tx.externalId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing transaction, but preserve user-set category
      const preserveCategory =
        existing[0].categorizationSource === 'user' ||
        existing[0].categorizationSource === 'rule';

      const updateData: Record<string, unknown> = {
        amount: tx.amount,
        name: tx.name,
        merchantName: tx.merchantName,
        description: tx.description,
        date: tx.date,
        authorizedDate: tx.authorizedDate,
        pending: tx.pending,
        updatedAt: new Date(),
      };

      // Only update category if user hasn't manually set one
      if (!preserveCategory && tx.personalFinanceCategory) {
        updateData.categorizationSource = 'plaid';
      }

      await this.db
        .update(schema.transactions)
        .set(updateData)
        .where(eq(schema.transactions.id, existing[0].id));
    } else {
      // Insert new transaction
      await this.db.insert(schema.transactions).values({
        userId,
        accountId,
        plaidTransactionId: tx.externalId,
        amount: tx.amount,
        name: tx.name,
        merchantName: tx.merchantName,
        description: tx.description,
        date: tx.date,
        authorizedDate: tx.authorizedDate,
        pending: tx.pending,
        categorizationSource: tx.personalFinanceCategory ? 'plaid' : null,
        isManual: false,
      });
    }
  }
}
