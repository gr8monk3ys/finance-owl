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
 * MX Platform API adapter.
 *
 * Maps MX concepts to the unified BankAggregatorProvider interface:
 *   - MX "member" -> item / connection
 *   - MX "connect widget URL" -> link token
 *   - MX uses a REST API with Basic auth (client_id:api_key)
 *
 * The provider gracefully degrades when MX credentials are not configured:
 * all methods will throw a descriptive error explaining that MX is not set up.
 */
@Injectable()
export class MxProvider implements BankAggregatorProvider, OnModuleInit {
  readonly name = 'mx' as const;

  private readonly logger = new Logger(MxProvider.name);
  private readonly apiKey: string;
  private readonly clientId: string;
  private readonly baseUrl: string;
  private _available = false;

  /** Whether this provider has valid credentials and can be used. */
  get available(): boolean {
    return this._available;
  }

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('MX_API_KEY', '');
    this.clientId = this.configService.get<string>('MX_CLIENT_ID', '');

    // MX offers sandbox (int-api) and production (api) environments
    const env = this.configService.get<string>('MX_ENV', 'sandbox');
    this.baseUrl =
      env === 'production'
        ? 'https://api.mx.com'
        : 'https://int-api.mx.com';
  }

  onModuleInit() {
    if (!this.apiKey || !this.clientId) {
      this.logger.warn(
        'MX provider is not configured (MX_API_KEY / MX_CLIENT_ID missing). MX aggregation will be unavailable.',
      );
      this._available = false;
    } else {
      this._available = true;
      this.logger.log('MX provider initialized successfully');
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

    const body = {
      widget_url: {
        widget_type: 'connect_widget',
        mode: 'verification',
        color_scheme: 'light',
        include_transactions: true,
        ...(options?.institutionId && {
          current_institution_code: options.institutionId,
        }),
      },
    };

    const response = await this.request<{
      widget_url: { url: string; type: string };
    }>('POST', `/users/${userId}/widget_urls`, body);

    return {
      linkToken: response.widget_url.url,
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // MX widget URLs are valid ~10 min
      provider: 'mx',
    };
  }

  async exchangeToken(publicToken: string): Promise<ExchangeResult> {
    this.ensureAvailable();

    // In MX the "public token" from the connect widget carries user_guid and member_guid
    // parsed from the widget callback payload.
    const parsed = this.parseMxCallbackToken(publicToken);

    const memberResponse = await this.request<{
      member: { guid: string; institution_code: string; name: string };
    }>('GET', `/users/${parsed.userGuid}/members/${parsed.memberGuid}`);

    const accounts = await this.getAccounts(
      `${parsed.userGuid}:${parsed.memberGuid}`,
    );

    return {
      accessToken: `${parsed.userGuid}:${parsed.memberGuid}`,
      itemId: memberResponse.member.guid,
      institutionId: memberResponse.member.institution_code,
      institutionName: memberResponse.member.name,
      accounts,
      provider: 'mx',
    };
  }

  async getAccounts(accessToken: string): Promise<AggregatorAccount[]> {
    this.ensureAvailable();

    const { userGuid, memberGuid } = this.parseAccessToken(accessToken);

    const response = await this.request<{
      accounts: Array<{
        guid: string;
        name: string;
        type: string;
        subtype: string | null;
        account_number: string | null;
        available_balance: number | null;
        balance: number | null;
        credit_limit: number | null;
        currency_code: string;
      }>;
    }>('GET', `/users/${userGuid}/members/${memberGuid}/accounts`);

    return response.accounts.map((acct) => ({
      externalId: acct.guid,
      name: acct.name,
      officialName: null,
      type: this.mapAccountType(acct.type),
      subtype: acct.subtype ?? null,
      mask: acct.account_number?.slice(-4) ?? null,
      currentBalance: acct.balance ?? null,
      availableBalance: acct.available_balance ?? null,
      creditLimit: acct.credit_limit ?? null,
      currency: acct.currency_code ?? 'USD',
    }));
  }

  async getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<AggregatorTransaction[]> {
    this.ensureAvailable();

    const { userGuid, memberGuid } = this.parseAccessToken(accessToken);

    const transactions: AggregatorTransaction[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await this.request<{
        transactions: Array<{
          guid: string;
          account_guid: string;
          amount: number;
          description: string;
          merchant_category_code: number | null;
          original_description: string | null;
          date: string;
          posted_at: string | null;
          status: string;
          category: string | null;
          top_level_category: string | null;
        }>;
        pagination: { total_pages: number; current_page: number };
      }>(
        'GET',
        `/users/${userGuid}/members/${memberGuid}/transactions?from_date=${startDate}&to_date=${endDate}&page=${page}&records_per_page=100`,
      );

      totalPages = response.pagination.total_pages;

      for (const tx of response.transactions) {
        transactions.push({
          externalId: tx.guid,
          accountExternalId: tx.account_guid,
          amount: tx.amount,
          name: tx.description,
          merchantName: null,
          description: tx.original_description ?? null,
          date: tx.date,
          authorizedDate: tx.posted_at ?? null,
          pending: tx.status === 'PENDING',
          category: tx.category ?? null,
          personalFinanceCategory: tx.top_level_category ?? null,
        });
      }

      page++;
    }

    return transactions;
  }

  async syncTransactions(
    accessToken: string,
    cursor?: string | null,
  ): Promise<TransactionSyncResult> {
    this.ensureAvailable();

    // MX does not have a native cursor-based transaction sync like Plaid.
    // We simulate it by fetching transactions from the cursor date (or last 30 days)
    // and returning them as "added". The cursor is the ISO date of the last fetch.
    const { userGuid, memberGuid } = this.parseAccessToken(accessToken);

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

    const { userGuid, memberGuid } = this.parseAccessToken(accessToken);

    const response = await this.request<{
      holdings: Array<{
        guid: string;
        account_guid: string;
        symbol: string | null;
        description: string | null;
        quantity: number;
        cost_basis: number | null;
        market_value: number | null;
        currency_code: string;
      }>;
    }>('GET', `/users/${userGuid}/holdings`);

    return response.holdings.map((h) => ({
      externalId: h.guid,
      accountExternalId: h.account_guid,
      securityId: null,
      securityName: h.description ?? null,
      securityTicker: h.symbol ?? null,
      quantity: h.quantity,
      costBasis: h.cost_basis ?? null,
      marketValue: h.market_value ?? null,
      currency: h.currency_code ?? 'USD',
    }));
  }

  async getInstitution(institutionId: string): Promise<InstitutionInfo> {
    this.ensureAvailable();

    const response = await this.request<{
      institution: {
        code: string;
        name: string;
        url: string | null;
        medium_logo_url: string | null;
      };
    }>('GET', `/institutions/${institutionId}`);

    const inst = response.institution;
    return {
      institutionId: inst.code,
      name: inst.name,
      url: inst.url ?? null,
      logo: inst.medium_logo_url ?? null,
      primaryColor: null,
      supportedProviders: ['mx'],
    };
  }

  async removeConnection(accessToken: string): Promise<void> {
    this.ensureAvailable();

    const { userGuid, memberGuid } = this.parseAccessToken(accessToken);
    await this.request('DELETE', `/users/${userGuid}/members/${memberGuid}`);
  }

  async checkHealth(accessToken: string): Promise<ConnectionHealth> {
    this.ensureAvailable();

    try {
      const { userGuid, memberGuid } = this.parseAccessToken(accessToken);

      const response = await this.request<{
        member: {
          connection_status: string;
          successfully_aggregated_at: string | null;
          error_message: string | null;
        };
      }>('GET', `/users/${userGuid}/members/${memberGuid}/status`);

      const member = response.member;
      const statusMap: Record<string, ConnectionHealth['status']> = {
        CONNECTED: 'healthy',
        DEGRADED: 'degraded',
        DISCONNECTED: 'error',
        CHALLENGED: 'login_required',
        REJECTED: 'error',
        EXPIRED: 'login_required',
        DENIED: 'error',
      };

      return {
        status: statusMap[member.connection_status] ?? 'error',
        lastSuccessfulSync: member.successfully_aggregated_at ?? null,
        errorCode: member.connection_status !== 'CONNECTED' ? member.connection_status : null,
        errorMessage: member.error_message ?? null,
      };
    } catch (e) {
      return {
        status: 'error',
        lastSuccessfulSync: null,
        errorCode: 'CHECK_FAILED',
        errorMessage: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Internal HTTP helpers
  // ---------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const credentials = Buffer.from(
      `${this.clientId}:${this.apiKey}`,
    ).toString('base64');

    const headers: Record<string, string> = {
      Accept: 'application/vnd.mx.api.v1+json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    };

    const response = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `MX API error ${response.status}: ${errorText}`,
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
        'MX provider is not configured. Set MX_API_KEY and MX_CLIENT_ID environment variables.',
      );
    }
  }

  /**
   * MX access tokens are stored as "userGuid:memberGuid" compound strings.
   */
  private parseAccessToken(accessToken: string): {
    userGuid: string;
    memberGuid: string;
  } {
    const [userGuid, memberGuid] = accessToken.split(':');
    if (!userGuid || !memberGuid) {
      throw new Error(
        `Invalid MX access token format. Expected "userGuid:memberGuid", got "${accessToken}"`,
      );
    }
    return { userGuid, memberGuid };
  }

  /**
   * Parse the MX Connect widget callback token. The widget POSTs back a
   * payload with user_guid and member_guid which we encode as a colon-
   * separated string on the frontend.
   */
  private parseMxCallbackToken(token: string): {
    userGuid: string;
    memberGuid: string;
  } {
    return this.parseAccessToken(token);
  }

  private mapAccountType(mxType: string): string {
    const typeMap: Record<string, string> = {
      CHECKING: 'checking',
      SAVINGS: 'savings',
      CREDIT_CARD: 'credit_card',
      LOAN: 'loan',
      INVESTMENT: 'investment',
      MORTGAGE: 'mortgage',
      LINE_OF_CREDIT: 'credit_card',
      MONEY_MARKET: 'savings',
    };
    return typeMap[mxType] ?? 'other';
  }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
}
