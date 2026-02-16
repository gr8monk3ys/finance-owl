import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface AllocationSlice {
  type: string;
  value: number;
  percentage: number;
}

export interface RebalancingSuggestion {
  securityType: string;
  currentPercent: number;
  targetPercent: number;
  action: 'buy' | 'sell';
  amount: number;
}

const DEFAULT_TARGET_ALLOCATION: Record<string, number> = {
  equity: 60,
  bond: 30,
  other: 10,
};

@Injectable()
export class AllocationService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getCurrentAllocation(userId: string): Promise<AllocationSlice[]> {
    const rows = await this.db
      .select({
        type: schema.securities.type,
        quantity: schema.investmentHoldings.quantity,
        institutionValue: schema.investmentHoldings.institutionValue,
        closePrice: schema.securities.closePrice,
      })
      .from(schema.investmentHoldings)
      .innerJoin(
        schema.securities,
        eq(schema.investmentHoldings.securityId, schema.securities.id),
      )
      .where(eq(schema.investmentHoldings.userId, userId));

    const typeValues = new Map<string, number>();
    let totalValue = 0;

    for (const row of rows) {
      const value =
        row.institutionValue ?? row.quantity * (row.closePrice ?? 0);
      const type = this.normalizeType(row.type);
      typeValues.set(type, (typeValues.get(type) ?? 0) + value);
      totalValue += value;
    }

    if (totalValue === 0) return [];

    return Array.from(typeValues.entries())
      .map(([type, value]) => ({
        type,
        value,
        percentage: (value / totalValue) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }

  getTargetAllocation(): Record<string, number> {
    return { ...DEFAULT_TARGET_ALLOCATION };
  }

  async getRebalancingSuggestions(
    userId: string,
  ): Promise<RebalancingSuggestion[]> {
    const currentAllocation = await this.getCurrentAllocation(userId);
    const targetAllocation = this.getTargetAllocation();

    if (currentAllocation.length === 0) return [];

    const totalValue = currentAllocation.reduce(
      (sum, slice) => sum + slice.value,
      0,
    );

    // Build current percentages map (all types)
    const currentMap = new Map<string, number>();
    for (const slice of currentAllocation) {
      currentMap.set(slice.type, slice.percentage);
    }

    // Collect all types from both current and target
    const allTypes = new Set([
      ...currentMap.keys(),
      ...Object.keys(targetAllocation),
    ]);

    const suggestions: RebalancingSuggestion[] = [];

    for (const type of allTypes) {
      const currentPercent = currentMap.get(type) ?? 0;
      const targetPercent = targetAllocation[type] ?? 0;
      const drift = currentPercent - targetPercent;

      // Only suggest rebalancing if drift exceeds 5%
      if (Math.abs(drift) <= 5) continue;

      const amount = Math.abs((drift / 100) * totalValue);

      suggestions.push({
        securityType: type,
        currentPercent: Math.round(currentPercent * 10) / 10,
        targetPercent,
        action: drift > 0 ? 'sell' : 'buy',
        amount: Math.round(amount * 100) / 100,
      });
    }

    return suggestions.sort(
      (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
    );
  }

  private normalizeType(type: string | null): string {
    if (!type) return 'other';
    const normalized = type.toLowerCase();

    if (normalized === 'equity' || normalized === 'stock') return 'equity';
    if (normalized === 'etf' || normalized === 'exchange traded fund')
      return 'etf';
    if (normalized === 'mutual fund') return 'mutual fund';
    if (
      normalized === 'fixed income' ||
      normalized === 'bond'
    )
      return 'bond';
    if (normalized === 'cash' || normalized === 'cash equivalent')
      return 'cash';

    return normalized;
  }
}
