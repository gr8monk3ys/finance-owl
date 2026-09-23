import { describe, expect, it } from 'vitest';
import { formatDecimal, formatFileSize, formatPercent } from './format';

describe('formatPercent', () => {
  it('formats a value already in percent units', () => {
    expect(formatPercent(12.345, 1)).toBe('12.3%');
    expect(formatPercent(40)).toBe('40%');
  });

  it('adds an explicit sign when asked, matching the old "+" prefix', () => {
    expect(formatPercent(3.456, 2, { signed: true })).toBe('+3.46%');
    expect(formatPercent(-3.456, 2, { signed: true })).toBe('-3.46%');
    expect(formatPercent(0, 1, { signed: true })).toBe('+0.0%');
  });
});

describe('formatDecimal', () => {
  it('pads to a fixed precision and groups thousands', () => {
    expect(formatDecimal(1234.5, 2)).toBe('1,234.50');
    expect(formatDecimal(0.123456, 6)).toBe('0.123456');
  });
});

describe('formatFileSize', () => {
  it('renders KB and MB with a non-breaking space', () => {
    expect(formatFileSize(1536, 'kilobyte', 1)).toBe('1.5 kB');
    expect(formatFileSize(2.5 * 1024 * 1024, 'megabyte', 2)).toBe('2.50 MB');
  });
});
