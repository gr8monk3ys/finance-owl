import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
}

const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '\u20AC' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '\u00A5' },
  { code: 'INR', name: 'Indian Rupee', symbol: '\u20B9' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '\u20A9' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'z\u0142' },
];

// Stubbed exchange rates relative to USD
const STUBBED_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.88,
  CNY: 7.24,
  INR: 83.12,
  MXN: 17.15,
  BRL: 4.97,
  KRW: 1328.5,
  SGD: 1.34,
  HKD: 7.82,
  NOK: 10.55,
  SEK: 10.42,
  DKK: 6.88,
  NZD: 1.63,
  ZAR: 18.63,
  PLN: 4.02,
};

@Injectable()
export class CurrencyService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  async getExchangeRates(base: string = 'USD') {
    const cacheKey = `currency:rates:${base.toUpperCase()}`;
    return this.cacheService.wrap(cacheKey, 3600, () =>
      this._getExchangeRates(base),
    );
  }

  private async _getExchangeRates(base: string = 'USD') {
    const rates = await this.db
      .select()
      .from(schema.exchangeRates)
      .where(eq(schema.exchangeRates.baseCurrency, base.toUpperCase()))
      .orderBy(schema.exchangeRates.targetCurrency);

    if (rates.length > 0) {
      return { base: base.toUpperCase(), rates };
    }

    // Fall back to stubbed rates if no rates exist in the database
    return this.getStubbedRates(base.toUpperCase());
  }

  async convert(
    amount: number,
    from: string,
    to: string,
  ): Promise<{ from: string; to: string; amount: number; converted: number; rate: number }> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (fromUpper === toUpper) {
      return { from: fromUpper, to: toUpper, amount, converted: amount, rate: 1 };
    }

    const rate = await this.getRate(fromUpper, toUpper);
    const converted = Math.round(amount * rate * 100) / 100;

    return { from: fromUpper, to: toUpper, amount, converted, rate };
  }

  async getUserPreference(userId: string) {
    const [pref] = await this.db
      .select()
      .from(schema.userCurrencyPreferences)
      .where(eq(schema.userCurrencyPreferences.userId, userId))
      .limit(1);

    return pref ?? { defaultCurrency: 'USD', displayFormat: 'symbol' };
  }

  async setUserPreference(
    userId: string,
    data: { defaultCurrency?: string; displayFormat?: string },
  ) {
    const existing = await this.db
      .select({ id: schema.userCurrencyPreferences.id })
      .from(schema.userCurrencyPreferences)
      .where(eq(schema.userCurrencyPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(schema.userCurrencyPreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(schema.userCurrencyPreferences.userId, userId))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(schema.userCurrencyPreferences)
      .values({
        userId,
        defaultCurrency: data.defaultCurrency ?? 'USD',
        displayFormat: data.displayFormat ?? 'symbol',
      })
      .returning();

    return created;
  }

  getSupportedCurrencies(): SupportedCurrency[] {
    return SUPPORTED_CURRENCIES;
  }

  async refreshRates(): Promise<{ base: string; ratesCount: number }> {
    // Stub implementation: insert hardcoded rates for USD base
    const now = new Date().toISOString();

    for (const [target, rate] of Object.entries(STUBBED_RATES)) {
      const existing = await this.db
        .select({ id: schema.exchangeRates.id })
        .from(schema.exchangeRates)
        .where(
          and(
            eq(schema.exchangeRates.baseCurrency, 'USD'),
            eq(schema.exchangeRates.targetCurrency, target),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(schema.exchangeRates)
          .set({ rate, fetchedAt: now, source: 'stub' })
          .where(eq(schema.exchangeRates.id, existing[0].id));
      } else {
        await this.db.insert(schema.exchangeRates).values({
          baseCurrency: 'USD',
          targetCurrency: target,
          rate,
          source: 'stub',
          fetchedAt: now,
        });
      }
    }

    // Invalidate all cached exchange rates
    await this.cacheService.delPattern('currency:rates:*');

    return { base: 'USD', ratesCount: Object.keys(STUBBED_RATES).length };
  }

  private async getRate(from: string, to: string): Promise<number> {
    // Direct rate lookup
    const [direct] = await this.db
      .select({ rate: schema.exchangeRates.rate })
      .from(schema.exchangeRates)
      .where(
        and(
          eq(schema.exchangeRates.baseCurrency, from),
          eq(schema.exchangeRates.targetCurrency, to),
        ),
      )
      .orderBy(desc(schema.exchangeRates.fetchedAt))
      .limit(1);

    if (direct) return direct.rate;

    // Try inverse rate
    const [inverse] = await this.db
      .select({ rate: schema.exchangeRates.rate })
      .from(schema.exchangeRates)
      .where(
        and(
          eq(schema.exchangeRates.baseCurrency, to),
          eq(schema.exchangeRates.targetCurrency, from),
        ),
      )
      .orderBy(desc(schema.exchangeRates.fetchedAt))
      .limit(1);

    if (inverse) return 1 / inverse.rate;

    // Cross-rate through USD
    if (from !== 'USD' && to !== 'USD') {
      const fromToUsd = await this.getRate(from, 'USD');
      const usdToTarget = await this.getRate('USD', to);
      return fromToUsd * usdToTarget;
    }

    // Fall back to stubbed rates
    if (from === 'USD' && STUBBED_RATES[to]) return STUBBED_RATES[to];
    if (to === 'USD' && STUBBED_RATES[from]) return 1 / STUBBED_RATES[from];

    return 1;
  }

  private getStubbedRates(base: string) {
    if (base === 'USD') {
      const rates = Object.entries(STUBBED_RATES).map(([target, rate]) => ({
        baseCurrency: 'USD',
        targetCurrency: target,
        rate,
        source: 'stub',
        fetchedAt: new Date().toISOString(),
      }));
      return { base: 'USD', rates };
    }

    // Convert stubbed USD rates to the requested base
    const baseToUsd = STUBBED_RATES[base];
    if (!baseToUsd) {
      return { base, rates: [] };
    }

    const rates = Object.entries(STUBBED_RATES)
      .filter(([target]) => target !== base)
      .map(([target, usdToTarget]) => ({
        baseCurrency: base,
        targetCurrency: target,
        rate: Math.round((usdToTarget / baseToUsd) * 10000) / 10000,
        source: 'stub',
        fetchedAt: new Date().toISOString(),
      }));

    // Add USD as a target
    rates.push({
      baseCurrency: base,
      targetCurrency: 'USD',
      rate: Math.round((1 / baseToUsd) * 10000) / 10000,
      source: 'stub',
      fetchedAt: new Date().toISOString(),
    });

    return { base, rates };
  }
}
