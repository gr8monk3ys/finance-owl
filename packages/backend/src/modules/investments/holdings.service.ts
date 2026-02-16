import { Injectable, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

interface HoldingRow {
  holdingId: string;
  accountId: string;
  accountName: string;
  institutionName: string | null;
  securityId: string;
  tickerSymbol: string | null;
  securityName: string;
  securityType: string | null;
  quantity: number;
  costBasis: number | null;
  institutionValue: number | null;
  closePrice: number | null;
}

export interface EnrichedHolding {
  holdingId: string;
  accountId: string;
  accountName: string;
  institutionName: string | null;
  securityId: string;
  tickerSymbol: string | null;
  securityName: string;
  securityType: string | null;
  quantity: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface AccountHoldings {
  accountId: string;
  accountName: string;
  institutionName: string | null;
  holdings: EnrichedHolding[];
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingCount: number;
}

@Injectable()
export class HoldingsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getHoldings(userId: string): Promise<AccountHoldings[]> {
    const rows: HoldingRow[] = await this.db
      .select({
        holdingId: schema.investmentHoldings.id,
        accountId: schema.investmentHoldings.accountId,
        accountName: schema.accounts.name,
        institutionName: schema.accounts.institutionName,
        securityId: schema.investmentHoldings.securityId,
        tickerSymbol: schema.securities.tickerSymbol,
        securityName: schema.securities.name,
        securityType: schema.securities.type,
        quantity: schema.investmentHoldings.quantity,
        costBasis: schema.investmentHoldings.costBasis,
        institutionValue: schema.investmentHoldings.institutionValue,
        closePrice: schema.securities.closePrice,
      })
      .from(schema.investmentHoldings)
      .innerJoin(
        schema.securities,
        eq(schema.investmentHoldings.securityId, schema.securities.id),
      )
      .innerJoin(
        schema.accounts,
        eq(schema.investmentHoldings.accountId, schema.accounts.id),
      )
      .where(eq(schema.investmentHoldings.userId, userId));

    const enriched = rows.map((row) => this.enrichHolding(row));

    // Group by account
    const accountMap = new Map<string, AccountHoldings>();
    for (const holding of enriched) {
      if (!accountMap.has(holding.accountId)) {
        accountMap.set(holding.accountId, {
          accountId: holding.accountId,
          accountName: holding.accountName,
          institutionName: holding.institutionName,
          holdings: [],
          totalValue: 0,
          totalCostBasis: 0,
          totalGainLoss: 0,
          totalGainLossPercent: 0,
        });
      }

      const account = accountMap.get(holding.accountId)!;
      account.holdings.push(holding);
      account.totalValue += holding.currentValue;
      account.totalCostBasis += holding.costBasis;
      account.totalGainLoss += holding.gainLoss;
    }

    // Calculate percent for each account group
    for (const account of accountMap.values()) {
      account.totalGainLossPercent =
        account.totalCostBasis > 0
          ? (account.totalGainLoss / account.totalCostBasis) * 100
          : 0;
    }

    return Array.from(accountMap.values());
  }

  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    const rows = await this.db
      .select({
        quantity: schema.investmentHoldings.quantity,
        costBasis: schema.investmentHoldings.costBasis,
        institutionValue: schema.investmentHoldings.institutionValue,
        closePrice: schema.securities.closePrice,
      })
      .from(schema.investmentHoldings)
      .innerJoin(
        schema.securities,
        eq(schema.investmentHoldings.securityId, schema.securities.id),
      )
      .where(eq(schema.investmentHoldings.userId, userId));

    let totalValue = 0;
    let totalCostBasis = 0;

    for (const row of rows) {
      const currentValue =
        row.institutionValue ?? row.quantity * (row.closePrice ?? 0);
      const costBasis = row.costBasis ?? 0;
      totalValue += currentValue;
      totalCostBasis += costBasis;
    }

    const totalGainLoss = totalValue - totalCostBasis;
    const totalGainLossPercent =
      totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

    return {
      totalValue,
      totalCostBasis,
      totalGainLoss,
      totalGainLossPercent,
      holdingCount: rows.length,
    };
  }

  private enrichHolding(row: HoldingRow): EnrichedHolding {
    const currentValue =
      row.institutionValue ?? row.quantity * (row.closePrice ?? 0);
    const costBasis = row.costBasis ?? 0;
    const gainLoss = currentValue - costBasis;
    const gainLossPercent =
      costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

    return {
      holdingId: row.holdingId,
      accountId: row.accountId,
      accountName: row.accountName,
      institutionName: row.institutionName,
      securityId: row.securityId,
      tickerSymbol: row.tickerSymbol,
      securityName: row.securityName,
      securityType: row.securityType,
      quantity: row.quantity,
      costBasis,
      currentValue,
      gainLoss,
      gainLossPercent,
    };
  }
}
