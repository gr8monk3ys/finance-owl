import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AggregatorFactory } from './aggregator.factory';
import { PlaidProvider } from './plaid.provider';
import type { AggregatorName } from './aggregator.interface';
import * as schema from '../../database/schema';

@Injectable()
export class BankSyncService {
  private readonly logger = new Logger(BankSyncService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private aggregatorFactory: AggregatorFactory,
    private plaidProvider: PlaidProvider,
    private cryptoService: CryptoService,
  ) {}

  // ---------------------------------------------------------------------------
  // Aggregator-aware endpoints
  // ---------------------------------------------------------------------------

  async createLinkToken(userId: string, providerName?: string) {
    const provider = providerName
      ? this.aggregatorFactory.getProvider(providerName)
      : this.aggregatorFactory.getDefaultProvider();

    return provider.createLinkToken(userId);
  }

  async createUpdateLinkToken(userId: string, plaidItemId: string) {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(and(eq(schema.plaidItems.id, plaidItemId), eq(schema.plaidItems.userId, userId)))
      .limit(1);

    if (!item) throw new NotFoundException('Plaid item not found');

    const accessToken = this.cryptoService.decrypt(item.accessToken);
    return this.plaidProvider.createUpdateLinkToken(accessToken);
  }

  async exchangeAndStore(userId: string, publicToken: string, providerName?: string) {
    const provider = providerName
      ? this.aggregatorFactory.getProvider(providerName)
      : this.aggregatorFactory.getDefaultProvider();

    const result = await provider.exchangeToken(publicToken);

    // Encrypt the access token before storing
    const encryptedToken = this.cryptoService.encrypt(result.accessToken);

    // Store the Plaid item (table is shared across providers; the provider
    // name is tracked so we know which aggregator to use on subsequent calls)
    const [plaidItem] = await this.db
      .insert(schema.plaidItems)
      .values({
        userId,
        plaidItemId: result.itemId,
        accessToken: encryptedToken,
        institutionId: result.institutionId,
        institutionName: result.institutionName,
      })
      .returning();

    // Store linked accounts
    const createdAccounts = [];
    for (const acct of result.accounts) {
      const [created] = await this.db
        .insert(schema.accounts)
        .values({
          userId,
          plaidItemId: plaidItem.id,
          plaidAccountId: acct.externalId,
          name: acct.officialName || acct.name,
          officialName: acct.officialName,
          type: acct.type,
          subtype: acct.subtype,
          institutionName: result.institutionName,
          mask: acct.mask,
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          creditLimit: acct.creditLimit,
          currency: acct.currency,
          isManual: false,
        })
        .returning();
      createdAccounts.push(created);
    }

    this.logger.log(
      `Linked ${createdAccounts.length} accounts from ${result.institutionName} via ${result.provider} for user ${userId}`,
    );

    return {
      plaidItem,
      accounts: createdAccounts,
      provider: result.provider,
    };
  }

  async refreshBalances(userId: string, plaidItemId: string) {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(and(eq(schema.plaidItems.id, plaidItemId), eq(schema.plaidItems.userId, userId)))
      .limit(1);

    if (!item) throw new NotFoundException('Plaid item not found');

    const accessToken = this.cryptoService.decrypt(item.accessToken);

    // Use the provider that was used to create this connection.
    // For now, we default to the factory's default provider since the
    // plaidItems table doesn't yet have a "provider" column. In production
    // you would read item.provider here.
    const provider = this.aggregatorFactory.getDefaultProvider();
    const bankAccounts = await provider.getAccounts(accessToken);

    for (const bankAcct of bankAccounts) {
      await this.db
        .update(schema.accounts)
        .set({
          currentBalance: bankAcct.currentBalance,
          availableBalance: bankAcct.availableBalance,
          creditLimit: bankAcct.creditLimit,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.accounts.plaidAccountId, bankAcct.externalId),
            eq(schema.accounts.userId, userId),
          ),
        );
    }

    return bankAccounts.length;
  }

  async unlinkItem(userId: string, plaidItemId: string) {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(and(eq(schema.plaidItems.id, plaidItemId), eq(schema.plaidItems.userId, userId)))
      .limit(1);

    if (!item) throw new NotFoundException('Plaid item not found');

    try {
      const accessToken = this.cryptoService.decrypt(item.accessToken);
      const provider = this.aggregatorFactory.getDefaultProvider();
      await provider.removeConnection(accessToken);
    } catch (e) {
      this.logger.warn(`Failed to remove item remotely: ${e}`);
    }

    // Delete accounts linked to this item
    await this.db.delete(schema.accounts).where(eq(schema.accounts.plaidItemId, plaidItemId));

    await this.db.delete(schema.plaidItems).where(eq(schema.plaidItems.id, plaidItemId));
  }

  async getPlaidItems(userId: string) {
    return this.db
      .select({
        id: schema.plaidItems.id,
        institutionName: schema.plaidItems.institutionName,
        institutionId: schema.plaidItems.institutionId,
        status: schema.plaidItems.status,
        errorCode: schema.plaidItems.errorCode,
        createdAt: schema.plaidItems.createdAt,
      })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.userId, userId));
  }

  async updateItemStatus(plaidItemId: string, status: string, errorCode?: string) {
    await this.db
      .update(schema.plaidItems)
      .set({
        status,
        errorCode: errorCode ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.plaidItems.plaidItemId, plaidItemId));
  }

  getDecryptedAccessToken(encryptedToken: string): string {
    return this.cryptoService.decrypt(encryptedToken);
  }

  /**
   * Retrieve a raw Plaid item row (including the encrypted access token).
   * Used internally by sandbox helpers and sync triggers.
   */
  async getPlaidItemRaw(userId: string, plaidItemId: string) {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(and(eq(schema.plaidItems.id, plaidItemId), eq(schema.plaidItems.userId, userId)))
      .limit(1);

    if (!item) throw new NotFoundException('Plaid item not found');
    return item;
  }

  // ---------------------------------------------------------------------------
  // Provider discovery
  // ---------------------------------------------------------------------------

  /**
   * Return the list of aggregator providers currently available.
   */
  getAvailableProviders(): { name: string; isDefault: boolean }[] {
    const defaultName = this.aggregatorFactory.getDefaultProviderName();
    return this.aggregatorFactory.getAvailableProviders().map((p) => ({
      name: p.name,
      isDefault: p.name === defaultName,
    }));
  }
}
