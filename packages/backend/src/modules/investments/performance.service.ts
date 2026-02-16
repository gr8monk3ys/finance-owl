import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

type Period = '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';

interface PeriodDataPoint {
  date: string;
  value: number;
}

export interface PerformanceResult {
  totalReturn: number;
  totalReturnPercent: number;
  periodData: PeriodDataPoint[];
}

@Injectable()
export class PerformanceService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getPerformance(
    userId: string,
    period: Period,
  ): Promise<PerformanceResult> {
    const { startDate, endDate } = this.getDateRange(period);

    // Get all holdings for the user
    const holdings = await this.db
      .select({
        securityId: schema.investmentHoldings.securityId,
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

    if (holdings.length === 0) {
      return { totalReturn: 0, totalReturnPercent: 0, periodData: [] };
    }

    // Get current total value and cost basis
    let currentTotalValue = 0;
    let totalCostBasis = 0;
    const securityIds = new Set<string>();

    for (const holding of holdings) {
      const value =
        holding.institutionValue ??
        holding.quantity * (holding.closePrice ?? 0);
      currentTotalValue += value;
      totalCostBasis += holding.costBasis ?? 0;
      securityIds.add(holding.securityId);
    }

    const totalReturn = currentTotalValue - totalCostBasis;
    const totalReturnPercent =
      totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0;

    // Get price history for the period
    const priceHistory = await this.db
      .select({
        securityId: schema.securityPrices.securityId,
        price: schema.securityPrices.price,
        date: schema.securityPrices.date,
      })
      .from(schema.securityPrices)
      .where(
        and(
          gte(schema.securityPrices.date, startDate),
          lte(schema.securityPrices.date, endDate),
        ),
      )
      .orderBy(asc(schema.securityPrices.date));

    // Filter to only securities the user holds
    const relevantPrices = priceHistory.filter((p) =>
      securityIds.has(p.securityId),
    );

    // Build quantity map for portfolio value calculation
    const quantityMap = new Map<string, number>();
    for (const holding of holdings) {
      const current = quantityMap.get(holding.securityId) ?? 0;
      quantityMap.set(holding.securityId, current + holding.quantity);
    }

    // Group prices by date and calculate portfolio value
    const dateValues = new Map<string, number>();
    for (const price of relevantPrices) {
      const quantity = quantityMap.get(price.securityId) ?? 0;
      const existing = dateValues.get(price.date) ?? 0;
      dateValues.set(price.date, existing + quantity * price.price);
    }

    const periodData = Array.from(dateValues.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Add current value as the last data point if not already present
    const today = new Date().toISOString().split('T')[0];
    const lastPoint = periodData[periodData.length - 1];
    if (!lastPoint || lastPoint.date !== today) {
      periodData.push({ date: today, value: currentTotalValue });
    }

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
      periodData,
    };
  }

  async getHoldingPerformance(
    userId: string,
    holdingId: string,
  ): Promise<PerformanceResult> {
    const [holding] = await this.db
      .select({
        securityId: schema.investmentHoldings.securityId,
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
      .where(
        and(
          eq(schema.investmentHoldings.id, holdingId),
          eq(schema.investmentHoldings.userId, userId),
        ),
      )
      .limit(1);

    if (!holding) {
      return { totalReturn: 0, totalReturnPercent: 0, periodData: [] };
    }

    const currentValue =
      holding.institutionValue ??
      holding.quantity * (holding.closePrice ?? 0);
    const costBasis = holding.costBasis ?? 0;
    const totalReturn = currentValue - costBasis;
    const totalReturnPercent =
      costBasis > 0 ? (totalReturn / costBasis) * 100 : 0;

    // Get all price history for this security
    const priceHistory = await this.db
      .select({
        price: schema.securityPrices.price,
        date: schema.securityPrices.date,
      })
      .from(schema.securityPrices)
      .where(eq(schema.securityPrices.securityId, holding.securityId))
      .orderBy(asc(schema.securityPrices.date));

    const periodData = priceHistory.map((p) => ({
      date: p.date,
      value: holding.quantity * p.price,
    }));

    return {
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
      periodData,
    };
  }

  private getDateRange(period: Period): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const start = new Date(now);

    switch (period) {
      case '1M':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3M':
        start.setMonth(start.getMonth() - 3);
        break;
      case '6M':
        start.setMonth(start.getMonth() - 6);
        break;
      case '1Y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'YTD':
        start.setMonth(0, 1);
        break;
      case 'ALL':
        start.setFullYear(2000);
        break;
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate,
    };
  }
}
