import { DEFAULT_LOCALE } from '@finance-owl/shared';

/**
 * Locale-aware number formats the shared module does not cover: percents,
 * fixed-precision decimals and file sizes. They replace hand-rolled
 * `value.toFixed(n) + '%'` strings, which hardcode the decimal mark, the
 * percent position and the sign. The locale is pinned to the app default so
 * the server render and the hydrated client always agree.
 */

/** A value already in percent units: `12.5` → `12.5%`. */
export function formatPercent(
  value: number,
  digits = 0,
  options: { signed?: boolean } = {},
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: options.signed ? 'always' : 'auto',
  }).format(value / 100);
}

/** A number with exactly `digits` decimals and grouping: `1234.5` → `1,234.50`. */
export function formatDecimal(value: number, digits: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** A byte count in KB or MB, with a non-breaking space before the unit. */
export function formatFileSize(
  bytes: number,
  unit: 'kilobyte' | 'megabyte',
  digits: number,
): string {
  const value = unit === 'megabyte' ? bytes / 1024 / 1024 : bytes / 1024;
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(value)
    .replace(' ', ' ');
}
