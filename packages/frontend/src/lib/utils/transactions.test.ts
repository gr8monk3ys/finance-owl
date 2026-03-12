import { describe, expect, it } from 'vitest';
import {
  buildTransactionSearchParams,
  formatTransactionDate,
  getMerchantColor,
  getMerchantInitials,
  getTransactionDateGroupLabel,
  isIncomeTransaction,
} from './transactions';

describe('transaction utils', () => {
  it('formats transaction dates for display', () => {
    expect(formatTransactionDate('2026-03-10')).toBe('Mar 10, 2026');
  });

  it('groups recent dates into human-readable buckets', () => {
    const now = new Date('2026-03-12T10:00:00Z');

    expect(getTransactionDateGroupLabel('2026-03-12', now)).toBe('Today');
    expect(getTransactionDateGroupLabel('2026-03-11', now)).toBe('Yesterday');
    expect(getTransactionDateGroupLabel('2026-03-08', now)).toBe('This Week');
    expect(getTransactionDateGroupLabel('2026-03-02', now)).toBe('This Month');
    expect(getTransactionDateGroupLabel('2026-02-10', now)).toBe('February 2026');
  });

  it('derives merchant initials and stable avatar colors', () => {
    expect(getMerchantInitials('Whole Foods')).toBe('WF');
    expect(getMerchantInitials('Target')).toBe('TA');
    expect(getMerchantInitials('')).toBe('?');

    expect(getMerchantColor('Coffee Shop')).toBe(getMerchantColor('Coffee Shop'));
    expect(getMerchantColor('')).toBe('#64748b');
  });

  it('detects income across normal and liability accounts', () => {
    expect(isIncomeTransaction(-1200, 'checking')).toBe(true);
    expect(isIncomeTransaction(42.5, 'checking')).toBe(false);
    expect(isIncomeTransaction(1200, 'credit_card')).toBe(true);
    expect(isIncomeTransaction(-42.5, 'credit_card')).toBe(false);
  });

  it('builds search params from non-empty filters only', () => {
    const params = buildTransactionSearchParams({
      search: ' payroll ',
      accountId: 'acc_1',
      categoryId: '',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      page: 2,
    });

    expect(params.toString()).toBe(
      'search=payroll&accountId=acc_1&startDate=2026-03-01&endDate=2026-03-31&page=2',
    );
  });
});
