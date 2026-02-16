/**
 * Bank Aggregator Provider Interface
 *
 * Defines a unified contract for integrating with third-party bank
 * aggregation services (Plaid, MX, Finicity). Each provider adapts
 * its vendor-specific API to this common interface so the rest of
 * the application can work with any aggregator interchangeably.
 */

export type AggregatorName = 'plaid' | 'mx' | 'finicity';

export interface BankAggregatorProvider {
  /** Unique identifier for this aggregator (e.g. 'plaid', 'mx', 'finicity'). */
  readonly name: AggregatorName;

  /** Create a link token (or equivalent connect widget URL) for the frontend connection flow. */
  createLinkToken(userId: string, options?: LinkTokenOptions): Promise<LinkTokenResult>;

  /** Exchange a public/temporary token for persistent access credentials. */
  exchangeToken(publicToken: string): Promise<ExchangeResult>;

  /** Retrieve all accounts associated with a connected item/member. */
  getAccounts(accessToken: string): Promise<AggregatorAccount[]>;

  /** Retrieve transactions for a date range (one-shot fetch). */
  getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<AggregatorTransaction[]>;

  /** Sync transactions incrementally using a cursor (preferred for ongoing sync). */
  syncTransactions(
    accessToken: string,
    cursor?: string | null,
  ): Promise<TransactionSyncResult>;

  /** Retrieve investment holdings for a connected item. */
  getInvestmentHoldings(accessToken: string): Promise<AggregatorHolding[]>;

  /** Look up information about a financial institution. */
  getInstitution(institutionId: string): Promise<InstitutionInfo>;

  /** Remove/disconnect a linked item or member. */
  removeConnection(accessToken: string): Promise<void>;

  /** Check the health/status of a connection. */
  checkHealth(accessToken: string): Promise<ConnectionHealth>;
}

// ---------------------------------------------------------------------------
// Request / Option Types
// ---------------------------------------------------------------------------

export interface LinkTokenOptions {
  /** Products to request (e.g. ['transactions', 'investments']). */
  products?: string[];
  /** ISO country codes (e.g. ['US', 'CA']). */
  countryCodes?: string[];
  /** OAuth redirect URI for mobile/web flows. */
  redirectUri?: string;
  /** Pre-select a specific institution. */
  institutionId?: string;
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface LinkTokenResult {
  linkToken: string;
  expiration: string;
  /** Provider that generated this token. */
  provider: AggregatorName;
}

export interface ExchangeResult {
  accessToken: string;
  itemId: string;
  institutionId?: string | null;
  institutionName?: string | null;
  accounts: AggregatorAccount[];
  /** Provider that produced this result. */
  provider: AggregatorName;
}

export interface AggregatorAccount {
  externalId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  creditLimit: number | null;
  currency: string;
}

export interface AggregatorTransaction {
  externalId: string;
  accountExternalId: string;
  amount: number;
  name: string;
  merchantName: string | null;
  description: string | null;
  date: string;
  authorizedDate: string | null;
  pending: boolean;
  category: string | null;
  personalFinanceCategory: string | null;
}

export interface TransactionSyncResult {
  added: AggregatorTransaction[];
  modified: AggregatorTransaction[];
  removed: string[];
  cursor: string | null;
  hasMore: boolean;
}

export interface AggregatorHolding {
  externalId: string;
  accountExternalId: string;
  securityId: string | null;
  securityName: string | null;
  securityTicker: string | null;
  quantity: number;
  costBasis: number | null;
  marketValue: number | null;
  currency: string;
}

export interface InstitutionInfo {
  institutionId: string;
  name: string;
  url: string | null;
  logo: string | null;
  primaryColor: string | null;
  /** Which aggregators support this institution. */
  supportedProviders: AggregatorName[];
}

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'error' | 'login_required';
  lastSuccessfulSync: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Injection Token
// ---------------------------------------------------------------------------

/**
 * Injection token used to provide the list of available aggregator
 * providers via NestJS DI.
 */
export const BANK_AGGREGATOR_PROVIDERS = Symbol('BANK_AGGREGATOR_PROVIDERS');
