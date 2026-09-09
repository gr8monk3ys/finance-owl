/**
 * Display formatting for money, numbers and dates.
 *
 * This module is the single source of truth for how amounts and dates are
 * rendered across the web app and mobile. It is deliberately dependency-free
 * and framework-free so both clients (and the backend, for e-mail and export
 * rendering) can import it.
 *
 * Every currency formatter takes the currency and locale explicitly. That is
 * the whole point: before this module existed the app carried ~60 hand-rolled
 * `Intl.NumberFormat('en-US', { currency: 'USD' })` copies, which hardcoded
 * USD everywhere and made the currency preference screen purely cosmetic.
 */

import { DEFAULT_CURRENCY } from './constants.js';

/** Locale used when a caller does not supply one. */
export const DEFAULT_LOCALE = 'en-US';

/**
 * The one placeholder for "there is no value here".
 *
 * Call sites used to disagree — `--`, `-`, `N/A`, `Never`, `Unknown` — which
 * read as five different states to a user. Pass `fallback` explicitly when a
 * screen genuinely needs different wording (e.g. "Never" for a last-login).
 */
export const EMPTY_PLACEHOLDER = '--';

export interface CurrencyFormatOptions {
  /** ISO 4217 code, e.g. `USD`, `EUR`, `JPY`. Case-insensitive. */
  currency?: string;
  /** BCP 47 locale tag, e.g. `en-US`, `de-DE`. */
  locale?: string;
  /** Render as `$1.2K` instead of `$1,234.00`. */
  compact?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Returned when the value is null, undefined or not finite. */
  fallback?: string;
}

export interface NumberFormatOptions {
  locale?: string;
  compact?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

export interface DateFormatOptions {
  locale?: string;
  /** Returned when the value is null, undefined or unparseable. */
  fallback?: string;
  /** IANA time zone; defaults to the runtime's zone. */
  timeZone?: string;
}

/** Anything a call site realistically has in hand for a date. */
export type DateInput = Date | string | number | null | undefined;

function isRenderableNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Format an amount as money in an explicit currency.
 *
 * Defaults keep the pre-existing `en-US`/`USD` behaviour for call sites that
 * have no currency in hand yet, so migrating a screen is a pure refactor.
 */
export function formatCurrency(
  amount: number | null | undefined,
  options: CurrencyFormatOptions = {},
): string {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    compact = false,
    minimumFractionDigits,
    maximumFractionDigits,
    fallback = EMPTY_PLACEHOLDER,
  } = options;

  if (!isRenderableNumber(amount)) return fallback;

  const intlOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currency.toUpperCase(),
  };
  if (compact) {
    intlOptions.notation = 'compact';
    intlOptions.maximumFractionDigits = maximumFractionDigits ?? 1;
  } else if (maximumFractionDigits !== undefined) {
    intlOptions.maximumFractionDigits = maximumFractionDigits;
  }
  if (minimumFractionDigits !== undefined) {
    intlOptions.minimumFractionDigits = minimumFractionDigits;
  }

  return new Intl.NumberFormat(locale, intlOptions).format(amount);
}

/**
 * Money with the cents dropped — for headline figures and chart axes where
 * `$1,234` reads better than `$1,234.00`.
 */
export function formatCurrencyWhole(
  amount: number | null | undefined,
  options: CurrencyFormatOptions = {},
): string {
  return formatCurrency(amount, {
    ...options,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  });
}

/** Money in compact notation — `$1.2K`, `$3.4M`. */
export function formatCurrencyCompact(
  amount: number | null | undefined,
  options: CurrencyFormatOptions = {},
): string {
  return formatCurrency(amount, { ...options, compact: true });
}

/** A plain number, locale-aware, with no currency symbol. */
export function formatNumber(
  value: number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  const {
    locale = DEFAULT_LOCALE,
    compact = false,
    minimumFractionDigits,
    maximumFractionDigits,
    fallback = EMPTY_PLACEHOLDER,
  } = options;

  if (!isRenderableNumber(value)) return fallback;

  const intlOptions: Intl.NumberFormatOptions = {};
  if (compact) {
    intlOptions.notation = 'compact';
    intlOptions.maximumFractionDigits = maximumFractionDigits ?? 1;
  } else if (maximumFractionDigits !== undefined) {
    intlOptions.maximumFractionDigits = maximumFractionDigits;
  }
  if (minimumFractionDigits !== undefined) {
    intlOptions.minimumFractionDigits = minimumFractionDigits;
  }

  return new Intl.NumberFormat(locale, intlOptions).format(value);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Turn whatever a call site holds into a `Date`, or `null` if it cannot.
 *
 * A bare `YYYY-MM-DD` (how the API returns transaction and bill dates) is
 * parsed at *local* midnight. `new Date('2024-03-01')` parses as UTC, which
 * renders as February 29th for anyone west of Greenwich — the off-by-one day
 * bug that call sites used to dodge by hand-appending `'T00:00:00'`.
 */
export function parseDateInput(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  const raw = DATE_ONLY.test(value) ? `${value}T00:00:00` : value;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWith(
  value: DateInput,
  intlOptions: Intl.DateTimeFormatOptions,
  options: DateFormatOptions,
): string {
  const { locale = DEFAULT_LOCALE, fallback = EMPTY_PLACEHOLDER, timeZone } = options;
  const date = parseDateInput(value);
  if (!date) return fallback;
  return date.toLocaleDateString(locale, timeZone ? { ...intlOptions, timeZone } : intlOptions);
}

/**
 * Escape hatch for a one-off date shape (a weekday header, a calendar title).
 *
 * It still routes through the shared parsing and the shared placeholder, so a
 * screen with an unusual layout does not have to reintroduce its own
 * `new Date(x + 'T00:00:00')` dance. Prefer a named formatter above when one
 * fits — reach for this only when the shape is genuinely used once.
 */
export function formatDateWith(
  value: DateInput,
  intlOptions: Intl.DateTimeFormatOptions,
  options: DateFormatOptions = {},
): string {
  return formatWith(value, intlOptions, options);
}

/** `Mar 1, 2024` — the default date rendering across the app. */
export function formatDate(value: DateInput, options: DateFormatOptions = {}): string {
  return formatWith(value, { month: 'short', day: 'numeric', year: 'numeric' }, options);
}

/** `Mar 1` — for dense lists and calendars where the year is implied. */
export function formatDateShort(value: DateInput, options: DateFormatOptions = {}): string {
  return formatWith(value, { month: 'short', day: 'numeric' }, options);
}

/** `March 1, 2024` — for documents and letters. */
export function formatDateLong(value: DateInput, options: DateFormatOptions = {}): string {
  return formatWith(value, { month: 'long', day: 'numeric', year: 'numeric' }, options);
}

/** `March 2024` — month headers. */
export function formatMonthYear(value: DateInput, options: DateFormatOptions = {}): string {
  return formatWith(value, { month: 'long', year: 'numeric' }, options);
}

/** `Mar '24` style — `Mar 24` — for chart axes. */
export function formatMonthYearShort(value: DateInput, options: DateFormatOptions = {}): string {
  return formatWith(value, { month: 'short', year: '2-digit' }, options);
}

/** `Mar 1, 2024, 3:04 PM`. */
export function formatDateTime(value: DateInput, options: DateFormatOptions = {}): string {
  const { locale = DEFAULT_LOCALE, fallback = EMPTY_PLACEHOLDER, timeZone } = options;
  const date = parseDateInput(value);
  if (!date) return fallback;
  const intlOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  return date.toLocaleString(locale, timeZone ? { ...intlOptions, timeZone } : intlOptions);
}
