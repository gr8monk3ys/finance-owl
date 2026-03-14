export interface TransactionFilters {
  search?: string;
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  page?: string | number | null;
}

export function formatTransactionDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getTransactionDateGroupLabel(dateStr: string, now = new Date()): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
    return 'This Month';
  }

  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getMerchantInitials(name: string): string {
  if (!name) return '?';

  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getMerchantColor(name: string): string {
  if (!name) return '#64748b';

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1',
  ];

  return colors[Math.abs(hash) % colors.length];
}

export function isIncomeTransaction(
  amount: number,
  accountType: string | null | undefined,
): boolean {
  const adjustedAmount = ['credit_card', 'loan', 'mortgage'].includes(accountType || 'checking')
    ? -amount
    : amount;

  return adjustedAmount < 0;
}

export function buildTransactionSearchParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams();

  const search = filters.search?.trim();

  if (search) params.set('search', search);
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.page !== undefined && filters.page !== null && filters.page !== '') {
    params.set('page', String(filters.page));
  }

  return params;
}
