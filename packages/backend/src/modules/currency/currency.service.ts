import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

export interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
}

export interface ExchangeRateEntry {
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  source: string;
  fetchedAt: string;
}

export interface ExchangeRatesResponse {
  base: string;
  rates: ExchangeRateEntry[];
  lastUpdated: Date | null;
  source: 'live' | 'cached' | 'fallback';
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

/** Hardcoded fallback exchange rates relative to USD (ECB-approximate) */
const FALLBACK_RATES: Record<string, number> = {
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

const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';

/** 6 hours in milliseconds */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Timeout for API requests in milliseconds */
const API_TIMEOUT_MS = 10_000;

@Injectable()
export class CurrencyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyService.name);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  // ── Lifecycle ───────────────────────────────────────────────────

  onModuleInit() {
    // Refresh rates on startup (non-blocking), then every 6 hours
    this.refreshRates().catch((err) =>
      this.logger.error('Initial currency rate refresh failed', err),
    );

    this.refreshTimer = setInterval(() => {
      this.refreshRates().catch((err) =>
        this.logger.error('Scheduled currency rate refresh failed', err),
      );
    }, REFRESH_INTERVAL_MS);

    // Allow the Node process to exit even if the interval is still active
    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }

    this.logger.log('Currency rate refresh scheduler started (6 h interval)');
  }

  onModuleDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.logger.log('Currency rate refresh scheduler stopped');
  }

  // ── Public API ──────────────────────────────────────────────────

  async getExchangeRates(base: string = 'USD'): Promise<ExchangeRatesResponse> {
    const cacheKey = `currency:rates:${base.toUpperCase()}`;
    return this.cacheService.wrap(cacheKey, 3600, () =>
      this._getExchangeRates(base),
    );
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

  /**
   * Fetch live exchange rates from the Frankfurter API and persist them
   * to the database. Falls back to hardcoded rates on API failure.
   */
  async refreshRates(): Promise<{
    base: string;
    ratesCount: number;
    source: 'live' | 'fallback';
  }> {
    let rates: Record<string, number>;
    let source: 'live' | 'fallback';

    try {
      rates = await this.fetchLiveRates();
      source = 'live';
      this.logger.log(
        `Fetched ${Object.keys(rates).length} live exchange rates from Frankfurter API`,
      );
    } catch (err) {
      this.logger.warn(
        `Frankfurter API call failed, falling back to hardcoded rates: ${(err as Error).message}`,
      );
      rates = FALLBACK_RATES;
      source = 'fallback';
    }

    const now = new Date().toISOString();

    for (const [target, rate] of Object.entries(rates)) {
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
          .set({ rate, fetchedAt: now, source })
          .where(eq(schema.exchangeRates.id, existing[0].id));
      } else {
        await this.db.insert(schema.exchangeRates).values({
          baseCurrency: 'USD',
          targetCurrency: target,
          rate,
          source,
          fetchedAt: now,
        });
      }
    }

    // Invalidate all cached exchange rates
    await this.cacheService.delPattern('currency:rates:*');

    return { base: 'USD', ratesCount: Object.keys(rates).length, source };
  }

  // ── Private helpers ─────────────────────────────────────────────

  private async _getExchangeRates(base: string = 'USD'): Promise<ExchangeRatesResponse> {
    const rates = await this.db
      .select()
      .from(schema.exchangeRates)
      .where(eq(schema.exchangeRates.baseCurrency, base.toUpperCase()))
      .orderBy(schema.exchangeRates.targetCurrency);

    if (rates.length > 0) {
      // Determine source and lastUpdated from the stored rates
      const mostRecent = rates.reduce((latest, r) =>
        r.fetchedAt > latest.fetchedAt ? r : latest,
      );
      const dbSource = mostRecent.source;
      const rateSource: 'live' | 'cached' | 'fallback' =
        dbSource === 'live' ? 'cached' : 'fallback';

      return {
        base: base.toUpperCase(),
        rates: rates.map((r) => ({
          baseCurrency: r.baseCurrency,
          targetCurrency: r.targetCurrency,
          rate: r.rate,
          source: r.source ?? 'unknown',
          fetchedAt: r.fetchedAt,
        })),
        lastUpdated: new Date(mostRecent.fetchedAt),
        source: rateSource,
      };
    }

    // No rates in DB -- return fallback stubs
    return this.getFallbackRates(base.toUpperCase());
  }

  /**
   * Call the Frankfurter API and return a map of currency -> rate (base USD).
   */
  private async fetchLiveRates(): Promise<Record<string, number>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(FRANKFURTER_API_URL, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Frankfurter API returned ${response.status}: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        base: string;
        date: string;
        rates: Record<string, number>;
      };

      return data.rates;
    } finally {
      clearTimeout(timeout);
    }
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

    // Fall back to hardcoded rates
    if (from === 'USD' && FALLBACK_RATES[to]) return FALLBACK_RATES[to];
    if (to === 'USD' && FALLBACK_RATES[from]) return 1 / FALLBACK_RATES[from];

    return 1;
  }

  private getFallbackRates(base: string): ExchangeRatesResponse {
    if (base === 'USD') {
      const rates = Object.entries(FALLBACK_RATES).map(([target, rate]) => ({
        baseCurrency: 'USD',
        targetCurrency: target,
        rate,
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
      }));
      return { base: 'USD', rates, lastUpdated: null, source: 'fallback' };
    }

    // Convert fallback USD rates to the requested base
    const baseToUsd = FALLBACK_RATES[base];
    if (!baseToUsd) {
      return { base, rates: [], lastUpdated: null, source: 'fallback' };
    }

    const rates = Object.entries(FALLBACK_RATES)
      .filter(([target]) => target !== base)
      .map(([target, usdToTarget]) => ({
        baseCurrency: base,
        targetCurrency: target,
        rate: Math.round((usdToTarget / baseToUsd) * 10000) / 10000,
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
      }));

    // Add USD as a target
    rates.push({
      baseCurrency: base,
      targetCurrency: 'USD',
      rate: Math.round((1 / baseToUsd) * 10000) / 10000,
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
    });

    return { base, rates, lastUpdated: null, source: 'fallback' };
  }
}
