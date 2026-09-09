import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  EMPTY_PLACEHOLDER,
  formatCurrency,
  formatCurrencyCompact,
  formatCurrencyWhole,
  formatDate,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatDateWith,
  formatMonthYear,
  formatMonthYearShort,
  formatNumber,
  parseDateInput,
} from './format';
import { DEFAULT_CURRENCY } from './constants';

// Intl output contains non-breaking and narrow-no-break spaces; comparing on
// those makes the tests brittle across ICU versions, so normalise them away.
const normalize = (value: string) => value.replace(/[  ]/g, ' ');

describe('formatCurrency', () => {
  it('defaults to en-US / USD so untouched call sites render identically', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(DEFAULT_LOCALE).toBe('en-US');
    expect(DEFAULT_CURRENCY).toBe('USD');
  });

  it('honours a non-USD currency', () => {
    expect(normalize(formatCurrency(1234.5, { currency: 'EUR', locale: 'de-DE' }))).toBe(
      '1.234,50 €',
    );
    expect(normalize(formatCurrency(1234.5, { currency: 'GBP', locale: 'en-GB' }))).toBe(
      '£1,234.50',
    );
    // Zero-decimal currency: Intl must not invent cents.
    expect(normalize(formatCurrency(1234, { currency: 'JPY', locale: 'ja-JP' }))).toBe('￥1,234');
  });

  it('is not silently pinned to USD when only the currency changes', () => {
    // This is the regression that made the currency settings page cosmetic:
    // every call site hardcoded USD, so changing the preference did nothing.
    const usd = formatCurrency(10, { currency: 'USD' });
    const eur = formatCurrency(10, { currency: 'EUR' });
    expect(usd).not.toBe(eur);
    expect(eur).toContain('€');
  });

  it('accepts a lowercase currency code', () => {
    expect(formatCurrency(10, { currency: 'eur', locale: 'en-US' })).toBe(
      formatCurrency(10, { currency: 'EUR', locale: 'en-US' }),
    );
  });

  it('formats negative amounts and zero', () => {
    expect(formatCurrency(-42)).toBe('-$42.00');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('returns the shared placeholder for missing or non-finite values', () => {
    expect(formatCurrency(null)).toBe(EMPTY_PLACEHOLDER);
    expect(formatCurrency(undefined)).toBe(EMPTY_PLACEHOLDER);
    expect(formatCurrency(Number.NaN)).toBe(EMPTY_PLACEHOLDER);
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe(EMPTY_PLACEHOLDER);
  });

  it('lets a caller override the placeholder', () => {
    expect(formatCurrency(null, { fallback: 'Never' })).toBe('Never');
  });

  it('respects explicit fraction digits', () => {
    expect(formatCurrency(1234.56, { maximumFractionDigits: 0 })).toBe('$1,235');
    expect(formatCurrency(1234, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe(
      '$1,234',
    );
  });
});

describe('formatCurrencyWhole', () => {
  it('drops the cents', () => {
    expect(formatCurrencyWhole(1234.56)).toBe('$1,235');
    expect(formatCurrencyWhole(0)).toBe('$0');
  });

  it('still honours a non-USD currency', () => {
    expect(normalize(formatCurrencyWhole(1234.56, { currency: 'EUR', locale: 'de-DE' }))).toBe(
      '1.235 €',
    );
  });

  it('falls back like formatCurrency', () => {
    expect(formatCurrencyWhole(null)).toBe(EMPTY_PLACEHOLDER);
  });
});

describe('formatCurrencyCompact', () => {
  it('abbreviates large amounts', () => {
    expect(formatCurrencyCompact(1234)).toBe('$1.2K');
    expect(formatCurrencyCompact(1_500_000)).toBe('$1.5M');
  });

  it('still honours a non-USD currency', () => {
    expect(formatCurrencyCompact(1_500_000, { currency: 'GBP', locale: 'en-GB' })).toContain('£');
  });
});

describe('formatNumber', () => {
  it('groups without a currency symbol', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1234.5678, { maximumFractionDigits: 2 })).toBe('1,234.57');
  });

  it('supports compact notation and a fallback', () => {
    expect(formatNumber(1234, { compact: true })).toBe('1.2K');
    expect(formatNumber(undefined)).toBe(EMPTY_PLACEHOLDER);
  });

  it('follows the locale', () => {
    expect(formatNumber(1234567, { locale: 'de-DE' })).toBe('1.234.567');
  });
});

describe('parseDateInput', () => {
  it('reads a bare YYYY-MM-DD at local midnight, not UTC', () => {
    // `new Date('2024-03-01')` is UTC midnight, which is Feb 29 in the
    // Americas. Every date-only string must stay on the day it names.
    const parsed = parseDateInput('2024-03-01');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2024);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(1);
    expect(parsed?.getHours()).toBe(0);
  });

  it('passes through Dates, timestamps and full ISO strings', () => {
    const date = new Date('2024-03-01T12:00:00Z');
    expect(parseDateInput(date)).toBe(date);
    expect(parseDateInput(date.getTime())?.getTime()).toBe(date.getTime());
    expect(parseDateInput('2024-03-01T12:00:00Z')?.getTime()).toBe(date.getTime());
  });

  it('returns null for anything unusable', () => {
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('not a date')).toBeNull();
    expect(parseDateInput(new Date('nope'))).toBeNull();
  });
});

describe('date formatters', () => {
  it('render the shapes the app uses', () => {
    expect(formatDate('2024-03-01')).toBe('Mar 1, 2024');
    expect(formatDateShort('2024-03-01')).toBe('Mar 1');
    expect(formatDateLong('2024-03-01')).toBe('March 1, 2024');
    expect(formatMonthYear('2024-03-01')).toBe('March 2024');
    expect(formatMonthYearShort('2024-03-01')).toBe('Mar 24');
    expect(normalize(formatDateTime('2024-03-01T15:04:00'))).toBe('Mar 1, 2024, 3:04 PM');
  });

  it('follow the locale', () => {
    expect(formatDate('2024-03-01', { locale: 'de-DE' })).toBe('1. März 2024');
    expect(formatMonthYear('2024-03-01', { locale: 'fr-FR' })).toBe('mars 2024');
  });

  it('use one placeholder for missing dates, overridable per call site', () => {
    expect(formatDate(null)).toBe(EMPTY_PLACEHOLDER);
    expect(formatDateShort(undefined)).toBe(EMPTY_PLACEHOLDER);
    expect(formatDateTime('')).toBe(EMPTY_PLACEHOLDER);
    expect(formatDate(null, { fallback: 'Never' })).toBe('Never');
  });

  it('let a one-off shape share the parsing and the placeholder', () => {
    expect(formatDateWith('2024-03-01', { weekday: 'short', month: 'short', day: 'numeric' })).toBe(
      'Fri, Mar 1',
    );
    expect(formatDateWith(null, { weekday: 'short' })).toBe(EMPTY_PLACEHOLDER);
  });

  it('honour an explicit time zone', () => {
    expect(formatDate('2024-03-01T23:30:00Z', { timeZone: 'UTC' })).toBe('Mar 1, 2024');
    expect(formatDate('2024-03-01T23:30:00Z', { timeZone: 'Asia/Tokyo' })).toBe('Mar 2, 2024');
  });
});
