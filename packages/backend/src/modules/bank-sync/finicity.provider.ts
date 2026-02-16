import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BankAggregatorProvider,
  LinkTokenOptions,
  LinkTokenResult,
  ExchangeResult,
  AggregatorAccount,
  AggregatorTransaction,
  TransactionSyncResult,
  AggregatorHolding,
  InstitutionInfo,
  ConnectionHealth,
} from './aggregator.interface';

/**
 * Mastercard Open Banking (Finicity) adapter.
 *
 * Maps Finicity concepts to the unified BankAggregatorProvider interface:
 *   - Finicity "customer" -> user
 *   - Finicity "institution login" -> item / connection
 *   - Finicity Connect URL -> link token
 *   - Finicity uses a partner token (short-lived) obtained via partner authentication
 *
 * The provider gracefully degrades when Finicity credentials are not configured.
 */
@Injectable()
export class FinicityProvider implements BankAggregatorProvider, OnModuleInit {
  readonly name = 'finicity' as const;

  private readonly logger = new Logger(FinicityProvider.name);
  private readonly appKey: string;
  private readonly partnerId: string;
  private readonly partnerSecret: string;
  private readonly baseUrl: string;
  private _available = false;
  private partnerToken: string | null = null;
  private partnerTokenExpiry = 0;

  /** Whether this provider has valid credentials and can be used. */
  get available(): boolean {
    return this._available;
  }

  constructor(private configService: ConfigService) {
    this.appKey = this.configService.get<string>('FINICITY_APP_KEY', '');
    this.partnerId = this.configService.get<string>(
      'FINICITY_PARTNER_ID',
      '',
    );
    this.partnerSecret = this.configService.get<string>(
      'FINICITY_PARTNER_SECRET',
      '',
    );

    const env = this.configService.get<string>('FINICITY_ENV', 'sandbox');
    this.baseUrl =
      env === 'production'
        ? 'https://api.finicity.com'
        : 'https://api.finicity.com'; // Finicity uses the same base; sandbox vs production is per-account
  }

  onModuleInit() {
    if (!this.appKey || !this.partnerId || !this.partnerSecret) {
      this.logger.warn(
        'Finicity provider is not configured (FINICITY_APP_KEY / FINICITY_PARTNER_ID / FINICITY_PARTNER_SECRET missing). ' +
          'Finicity aggregation will be unavailable.',
      );
      this._available = false;
    } else {
      this._available = true;
      this.logger.log('Finicity provider initialized successfully');
    }
  }

  // ---------------------------------------------------------------------------
  // BankAggregatorProvider implementation
  // ---------------------------------------------------------------------------

  async createLinkToken(
    userId: string,
    options?: LinkTokenOptions,
  ): Promise<LinkTokenResult> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    // Finicity Connect generates a URL the user opens to link accounts
    const body: Record<string, unknown> = {
      partnerId: this.partnerId,
      customerId: userId,
      type: 'aggregation',
      ...(options?.redirectUri && { redirectUri: options.redirectUri }),
      ...(options?.institutionId && {
        institutionId: Number(options.institutionId),
      }),
    };

    const response = await this.request<{
      link: string;
    }>('POST', '/connect/v2/generate', body);

    return {
      linkToken: response.link,
      expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // ~30 min validity
      provider: 'finicity',
    };
  }

  async exchangeToken(publicToken: string): Promise<ExchangeResult> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    // Finicity Connect callback carries customerId and institutionLoginId
    // encoded as "customerId:institutionLoginId" from the frontend
    const { customerId, institutionLoginId } =
      this.parseFinicityCallbackToken(publicToken);

    // Fetch accounts associated with this institution login
    const accounts = await this.getAccounts(
      `${customerId}:${institutionLoginId}`,
    );

    // Attempt to get institution info
    let institutionId: string | null = null;
    let institutionName: string | null = null;

    try {
      const loginResponse = await this.request<{
        accounts: Array<{ institutionId: number }>;
      }>('GET', `/aggregation/v1/customers/${customerId}/accounts`);

      if (loginResponse.accounts.length > 0) {
        institutionId = String(loginResponse.accounts[0].institutionId);
        try {
          const instInfo = await this.getInstitution(institutionId);
          institutionName = instInfo.name;
        } catch {
          // Non-fatal: institution name lookup failed
        }
      }
    } catch {
      // Non-fatal
    }

    return {
      accessToken: `${customerId}:${institutionLoginId}`,
      itemId: institutionLoginId,
      institutionId,
      institutionName,
      accounts,
      provider: 'finicity',
    };
  }

  async getAccounts(accessToken: string): Promise<AggregatorAccount[]> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    const { customerId, institutionLoginId } =
      this.parseAccessToken(accessToken);

    const response = await this.request<{
      accounts: Array<{
        id: string;
        name: string;
        type: string;
        number: string;
        balance: number | null;
        availableBalance: number | null;
        creditLimit: number | null;
        currency: string;
        detail?: {
          accountNumberDisplay: string | null;
        };
      }>;
    }>(
      'GET',
      `/aggregation/v1/customers/${customerId}/institutionLogins/${institutionLoginId}/accounts`,
    );

    return response.accounts.map((acct) => ({
      externalId: acct.id,
      name: acct.name,
      officialName: null,
      type: this.mapAccountType(acct.type),
      subtype: null,
      mask: acct.detail?.accountNumberDisplay?.slice(-4) ?? acct.number?.slice(-4) ?? null,
      currentBalance: acct.balance ?? null,
      availableBalance: acct.availableBalance ?? null,
      creditLimit: acct.creditLimit ?? null,
      currency: acct.currency ?? 'USD',
    }));
  }

  async getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<AggregatorTransaction[]> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    const { customerId } = this.parseAccessToken(accessToken);
    const accounts = await this.getAccounts(accessToken);

    // Finicity uses epoch timestamps
    const fromEpoch = Math.floor(new Date(startDate).getTime() / 1000);
    const toEpoch = Math.floor(new Date(endDate).getTime() / 1000);

    const transactions: AggregatorTransaction[] = [];

    for (const account of accounts) {
      let start = 1;
      let moreAvailable = true;

      while (moreAvailable) {
        const response = await this.request<{
          transactions: Array<{
            id: number;
            accountId: string;
            amount: number;
            description: string;
            memo: string | null;
            postedDate: number;
            transactionDate: number;
            status: string;
            categorization?: {
              category: string | null;
              bestRepresentation: string | null;
            };
          }>;
          moreAvailable: string;
        }>(
          'GET',
          `/aggregation/v3/customers/${customerId}/accounts/${account.externalId}/transactions?fromDate=${fromEpoch}&toDate=${toEpoch}&start=${start}&limit=1000`,
        );

        for (const tx of response.transactions) {
          transactions.push({
            externalId: String(tx.id),
            accountExternalId: String(tx.accountId),
            amount: tx.amount,
            name: tx.description,
            merchantName: null,
            description: tx.memo ?? null,
            date: new Date(tx.transactionDate * 1000).toISOString().slice(0, 10),
            authorizedDate: tx.postedDate
              ? new Date(tx.postedDate * 1000).toISOString().slice(0, 10)
              : null,
            pending: tx.status === 'pending',
            category: tx.categorization?.category ?? null,
            personalFinanceCategory:
              tx.categorization?.bestRepresentation ?? null,
          });
        }

        moreAvailable = response.moreAvailable === 'true';
        start += response.transactions.length;
      }
    }

    return transactions;
  }

  async syncTransactions(
    accessToken: string,
    cursor?: string | null,
  ): Promise<TransactionSyncResult> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    // Finicity does not have cursor-based sync. We simulate it by
    // fetching transactions from the cursor date (or last 30 days).
    const fromDate = cursor ?? this.daysAgo(30);
    const toDate = new Date().toISOString().slice(0, 10);

    const transactions = await this.getTransactions(
      accessToken,
      fromDate,
      toDate,
    );

    return {
      added: transactions,
      modified: [],
      removed: [],
      cursor: toDate,
      hasMore: false,
    };
  }

  async getInvestmentHoldings(
    accessToken: string,
  ): Promise<AggregatorHolding[]> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    // Finicity does not have a dedicated holdings endpoint like Plaid.
    // Investment data is available via account details for investment accounts.
    // We return an empty array; callers should use getAccounts for investment balances.
    this.logger.warn(
      'Finicity does not support dedicated investment holdings retrieval. Use getAccounts for investment account balances.',
    );
    return [];
  }

  async getInstitution(institutionId: string): Promise<InstitutionInfo> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    const response = await this.request<{
      institution: {
        id: number;
        name: string;
        urlHomeApp: string | null;
        urlLogonApp: string | null;
        branding?: {
          logo: string | null;
          primaryColor: string | null;
        };
      };
    }>('GET', `/institution/v2/institutions/${institutionId}`);

    const inst = response.institution;
    return {
      institutionId: String(inst.id),
      name: inst.name,
      url: inst.urlHomeApp ?? null,
      logo: inst.branding?.logo ?? null,
      primaryColor: inst.branding?.primaryColor ?? null,
      supportedProviders: ['finicity'],
    };
  }

  async removeConnection(accessToken: string): Promise<void> {
    this.ensureAvailable();
    await this.ensurePartnerToken();

    const { customerId, institutionLoginId } =
      this.parseAccessToken(accessToken);

    await this.request(
      'DELETE',
      `/aggregation/v1/customers/${customerId}/institutionLogins/${institutionLoginId}`,
    );
  }

  async checkHealth(accessToken: string): Promise<ConnectionHealth> {
    this.ensureAvailable();

    try {
      await this.ensurePartnerToken();

      const { customerId, institutionLoginId } =
        this.parseAccessToken(accessToken);

      // Attempt to fetch the accounts. If this succeeds, the connection is healthy.
      const accounts = await this.getAccounts(accessToken);

      return {
        status: accounts.length > 0 ? 'healthy' : 'degraded',
        lastSuccessfulSync: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      // Finicity returns specific error codes for authentication issues
      const isLoginRequired =
        message.includes('102') || // Invalid credentials
        message.includes('103') || // Account locked
        message.includes('108'); // User action required

      return {
        status: isLoginRequired ? 'login_required' : 'error',
        lastSuccessfulSync: null,
        errorCode: isLoginRequired ? 'LOGIN_REQUIRED' : 'CHECK_FAILED',
        errorMessage: message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Partner Authentication
  // ---------------------------------------------------------------------------

  /**
   * Finicity requires a partner authentication token for all API calls.
   * This token is valid for ~2 hours and must be refreshed.
   */
  private async ensurePartnerToken(): Promise<void> {
    // Refresh if token is expired or will expire within 5 minutes
    if (
      this.partnerToken &&
      this.partnerTokenExpiry > Date.now() + 5 * 60 * 1000
    ) {
      return;
    }

    const response = await fetch(
      `${this.baseUrl}/aggregation/v2/partners/authentication`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Finicity-App-Key': this.appKey,
        },
        body: JSON.stringify({
          partnerId: this.partnerId,
          partnerSecret: this.partnerSecret,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Finicity partner authentication failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as { token: string };
    this.partnerToken = data.token;
    // Token is valid for 2 hours
    this.partnerTokenExpiry = Date.now() + 2 * 60 * 60 * 1000;

    this.logger.debug('Finicity partner token refreshed');
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP helper
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.ensurePartnerToken();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Finicity-App-Key': this.appKey,
      'Finicity-App-Token': this.partnerToken!,
    };

    const response = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Finicity API error ${response.status}: ${errorText}`,
      );
    }

    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private ensureAvailable(): void {
    if (!this._available) {
      throw new Error(
        'Finicity provider is not configured. Set FINICITY_APP_KEY, FINICITY_PARTNER_ID, and FINICITY_PARTNER_SECRET environment variables.',
      );
    }
  }

  /**
   * Finicity access tokens are stored as "customerId:institutionLoginId".
   */
  private parseAccessToken(accessToken: string): {
    customerId: string;
    institutionLoginId: string;
  } {
    const [customerId, institutionLoginId] = accessToken.split(':');
    if (!customerId || !institutionLoginId) {
      throw new Error(
        `Invalid Finicity access token format. Expected "customerId:institutionLoginId", got "${accessToken}"`,
      );
    }
    return { customerId, institutionLoginId };
  }

  private parseFinicityCallbackToken(token: string): {
    customerId: string;
    institutionLoginId: string;
  } {
    return this.parseAccessToken(token);
  }

  private mapAccountType(finicityType: string): string {
    const typeMap: Record<string, string> = {
      checking: 'checking',
      savings: 'savings',
      creditCard: 'credit_card',
      loan: 'loan',
      mortgage: 'mortgage',
      investmentTaxDeferred: 'investment',
      investment: 'investment',
      lineOfCredit: 'credit_card',
      moneyMarket: 'savings',
      cd: 'savings',
    };
    return typeMap[finicityType] ?? 'other';
  }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
}
