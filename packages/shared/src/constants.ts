export const APP_NAME = 'FinanceOwl';

export const DEFAULT_CURRENCY = 'USD';

export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit_card',
  'investment',
  'loan',
  'mortgage',
  'other',
] as const;

export const BUDGET_PERIODS = ['monthly', 'quarterly', 'yearly'] as const;

export const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;
