// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'loan'
  | 'mortgage'
  | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institutionName: string | null;
  currentBalance: number;
  currency: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorth {
  netWorth: number;
  assets: number;
  liabilities: number;
  accountCount: number;
}

// ── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  accountId: string;
  accountName?: string;
  accountType?: AccountType;
  amount: number;
  name: string;
  merchantName: string | null;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  pending: boolean;
  notes: string | null;
  isManual: boolean;
  categorizationSource: string | null;
  splitTransactionId: string | null;
  createdAt: string;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  pending?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateTransactionRequest {
  accountId: string;
  amount: number;
  name: string;
  merchantName?: string;
  description?: string;
  categoryId?: string;
  date: string;
  pending?: boolean;
  notes?: string;
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string | null;
  categoryColor: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  period: BudgetPeriod;
  rollover: boolean;
  rolloverAmount: number;
  createdAt: string;
}

export interface BudgetSummary {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  percentUsed: number;
}

export interface CreateBudgetRequest {
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  rollover?: boolean;
}

export interface UpdateBudgetRequest {
  amount?: number;
  period?: BudgetPeriod;
  rollover?: boolean;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardData {
  recentTransactions: Transaction[];
  currentMonthSpending: number;
  lastMonthSpending: number;
  spendingChange: number;
  categoryBreakdown: CategorySpending[];
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  percentage: number;
}

// ── Financial Health ─────────────────────────────────────────────────────────

export interface HealthScore {
  overallScore: number;
  breakdown: {
    savings: number;
    debt: number;
    spending: number;
    investment: number;
    emergency: number;
  };
  updatedAt: string;
}
