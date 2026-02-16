import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CryptoService } from '../../common/crypto/crypto.service';
import { PlaidProvider } from '../bank-sync/plaid.provider';
import * as schema from '../../database/schema';

@Injectable()
export class InvestmentSyncService {
  private readonly logger = new Logger(InvestmentSyncService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private plaidProvider: PlaidProvider,
    private cryptoService: CryptoService,
  ) {}

  async syncAll(plaidItemId: string): Promise<void> {
    await this.syncHoldings(plaidItemId);
    await this.syncInvestmentTransactions(plaidItemId);
  }

  async syncHoldings(plaidItemId: string): Promise<void> {
    const { accessToken, accountMap, userId } =
      await this.getItemContext(plaidItemId);

    const response =
      await this.plaidProvider.client.investmentsHoldingsGet({
        access_token: accessToken,
      });

    const { securities: plaidSecurities, holdings } = response.data;

    // Upsert securities
    const securityMap = new Map<string, string>();
    for (const sec of plaidSecurities ?? []) {
      const securityId = await this.upsertSecurity({
        plaidSecurityId: sec.security_id,
        tickerSymbol: sec.ticker_symbol ?? null,
        name: sec.name ?? sec.ticker_symbol ?? 'Unknown',
        type: sec.type ?? null,
        closePrice: sec.close_price ?? null,
        closePriceAsOf: sec.close_price_as_of ?? null,
        isin: sec.isin ?? null,
        cusip: sec.cusip ?? null,
      });
      securityMap.set(sec.security_id, securityId);
    }

    // Upsert holdings
    for (const holding of holdings) {
      const accountId = accountMap.get(holding.account_id);
      const securityId = securityMap.get(holding.security_id);
      if (!accountId || !securityId) continue;

      await this.upsertHolding({
        userId,
        accountId,
        securityId,
        quantity: holding.quantity,
        costBasis: holding.cost_basis ?? null,
        institutionValue: holding.institution_value ?? null,
      });
    }

    // Record security prices
    const today = new Date().toISOString().split('T')[0];
    for (const sec of plaidSecurities ?? []) {
      if (sec.close_price == null) continue;
      const securityId = securityMap.get(sec.security_id);
      if (!securityId) continue;

      await this.recordSecurityPrice(
        securityId,
        sec.close_price,
        sec.close_price_as_of ?? today,
      );
    }

    this.logger.log(
      `Synced ${holdings.length} holdings with ${plaidSecurities?.length ?? 0} securities for item ${plaidItemId}`,
    );
  }

  async syncInvestmentTransactions(plaidItemId: string): Promise<void> {
    const { accessToken, accountMap, userId } =
      await this.getItemContext(plaidItemId);

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];

    const response =
      await this.plaidProvider.client.investmentsTransactionsGet({
        access_token: accessToken,
        start_date: startDateStr,
        end_date: endDate,
      });

    const { investment_transactions: txns, securities: plaidSecurities } =
      response.data;

    // Ensure securities exist
    const securityMap = new Map<string, string>();
    for (const sec of plaidSecurities ?? []) {
      const securityId = await this.upsertSecurity({
        plaidSecurityId: sec.security_id,
        tickerSymbol: sec.ticker_symbol ?? null,
        name: sec.name ?? sec.ticker_symbol ?? 'Unknown',
        type: sec.type ?? null,
        closePrice: sec.close_price ?? null,
        closePriceAsOf: sec.close_price_as_of ?? null,
        isin: sec.isin ?? null,
        cusip: sec.cusip ?? null,
      });
      securityMap.set(sec.security_id, securityId);
    }

    let upsertCount = 0;
    for (const tx of txns) {
      const accountId = accountMap.get(tx.account_id);
      if (!accountId) continue;

      const securityId = tx.security_id
        ? securityMap.get(tx.security_id) ?? null
        : null;

      const existing = await this.db
        .select({ id: schema.investmentTransactions.id })
        .from(schema.investmentTransactions)
        .where(
          eq(
            schema.investmentTransactions.plaidInvestmentTransactionId,
            tx.investment_transaction_id,
          ),
        )
        .limit(1);

      const values = {
        userId,
        accountId,
        securityId,
        plaidInvestmentTransactionId: tx.investment_transaction_id,
        type: tx.type ?? 'other',
        name: tx.name ?? 'Investment Transaction',
        amount: tx.amount,
        quantity: tx.quantity,
        price: tx.price,
        fees: tx.fees ?? null,
        date: tx.date,
      };

      if (existing.length > 0) {
        await this.db
          .update(schema.investmentTransactions)
          .set(values)
          .where(eq(schema.investmentTransactions.id, existing[0].id));
      } else {
        await this.db.insert(schema.investmentTransactions).values(values);
      }
      upsertCount++;
    }

    this.logger.log(
      `Synced ${upsertCount} investment transactions for item ${plaidItemId}`,
    );
  }

  private async getItemContext(plaidItemId: string): Promise<{
    accessToken: string;
    accountMap: Map<string, string>;
    userId: string;
  }> {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.id, plaidItemId))
      .limit(1);

    if (!item) {
      throw new Error(`Plaid item ${plaidItemId} not found`);
    }

    const accessToken = this.cryptoService.decrypt(item.accessToken);

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

    return { accessToken, accountMap, userId: item.userId };
  }

  private async upsertSecurity(data: {
    plaidSecurityId: string;
    tickerSymbol: string | null;
    name: string;
    type: string | null;
    closePrice: number | null;
    closePriceAsOf: string | null;
    isin: string | null;
    cusip: string | null;
  }): Promise<string> {
    const existing = await this.db
      .select({ id: schema.securities.id })
      .from(schema.securities)
      .where(eq(schema.securities.plaidSecurityId, data.plaidSecurityId))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(schema.securities)
        .set({
          tickerSymbol: data.tickerSymbol,
          name: data.name,
          type: data.type,
          closePrice: data.closePrice,
          closePriceAsOf: data.closePriceAsOf,
          isin: data.isin,
          cusip: data.cusip,
          updatedAt: new Date(),
        })
        .where(eq(schema.securities.id, existing[0].id));
      return existing[0].id;
    }

    const [inserted] = await this.db
      .insert(schema.securities)
      .values({
        plaidSecurityId: data.plaidSecurityId,
        tickerSymbol: data.tickerSymbol,
        name: data.name,
        type: data.type,
        closePrice: data.closePrice,
        closePriceAsOf: data.closePriceAsOf,
        isin: data.isin,
        cusip: data.cusip,
      })
      .returning({ id: schema.securities.id });

    return inserted.id;
  }

  private async upsertHolding(data: {
    userId: string;
    accountId: string;
    securityId: string;
    quantity: number;
    costBasis: number | null;
    institutionValue: number | null;
  }): Promise<void> {
    const existing = await this.db
      .select({ id: schema.investmentHoldings.id })
      .from(schema.investmentHoldings)
      .where(
        and(
          eq(schema.investmentHoldings.accountId, data.accountId),
          eq(schema.investmentHoldings.securityId, data.securityId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(schema.investmentHoldings)
        .set({
          quantity: data.quantity,
          costBasis: data.costBasis,
          institutionValue: data.institutionValue,
          updatedAt: new Date(),
        })
        .where(eq(schema.investmentHoldings.id, existing[0].id));
    } else {
      await this.db.insert(schema.investmentHoldings).values(data);
    }
  }

  private async recordSecurityPrice(
    securityId: string,
    price: number,
    date: string,
  ): Promise<void> {
    const existing = await this.db
      .select({ id: schema.securityPrices.id })
      .from(schema.securityPrices)
      .where(
        and(
          eq(schema.securityPrices.securityId, securityId),
          eq(schema.securityPrices.date, date),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(schema.securityPrices)
        .set({ price })
        .where(eq(schema.securityPrices.id, existing[0].id));
    } else {
      await this.db
        .insert(schema.securityPrices)
        .values({ securityId, price, date });
    }
  }
}
