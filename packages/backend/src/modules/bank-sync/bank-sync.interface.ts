export interface BankAccount {
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

export interface BankTransaction {
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

export interface SyncResult {
  added: BankTransaction[];
  modified: BankTransaction[];
  removed: string[];
  cursor: string | null;
  hasMore: boolean;
}

export interface LinkTokenResult {
  linkToken: string;
  expiration: string;
}

export interface ExchangeResult {
  accessToken: string;
  itemId: string;
  accounts: BankAccount[];
  institutionId: string | null;
  institutionName: string | null;
}

export interface BankSyncProvider {
  createLinkToken(userId: string, options?: LinkTokenOptions): Promise<LinkTokenResult>;
  createUpdateLinkToken(accessToken: string): Promise<LinkTokenResult>;
  exchangePublicToken(publicToken: string): Promise<ExchangeResult>;
  getAccounts(accessToken: string): Promise<BankAccount[]>;
  syncTransactions(
    accessToken: string,
    cursor: string | null,
  ): Promise<SyncResult>;
  removeItem(accessToken: string): Promise<void>;
}

export interface LinkTokenOptions {
  redirectUri?: string;
  products?: string[];
  countryCodes?: string[];
  institutionId?: string;
}
