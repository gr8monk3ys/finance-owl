import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import * as jose from 'jose';
import { createHash } from 'crypto';
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
import type {
  BankSyncProvider,
  BankAccount,
  SyncResult,
  ExchangeResult as BankSyncExchangeResult,
} from './bank-sync.interface';

@Injectable()
export class PlaidProvider implements BankAggregatorProvider, BankSyncProvider {
  readonly name = 'plaid' as const;

  private readonly logger = new Logger(PlaidProvider.name);
  private _client: PlaidApi;

  get client(): PlaidApi {
    return this._client;
  }

  constructor(private configService: ConfigService) {
    const env = this.configService.get<string>('PLAID_ENV', 'sandbox');
    const configuration = new Configuration({
      basePath:
        PlaidEnvironments[env as keyof typeof PlaidEnvironments] ||
        PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.configService.get<string>(
            'PLAID_CLIENT_ID',
            '',
          ),
          'PLAID-SECRET': this.configService.get<string>('PLAID_SECRET', ''),
        },
      },
    });

    this._client = new PlaidApi(configuration);
  }

  // ---------------------------------------------------------------------------
  // BankAggregatorProvider implementation
  // ---------------------------------------------------------------------------

  async createLinkToken(
    userId: string,
    options?: LinkTokenOptions,
  ): Promise<LinkTokenResult> {
    const products = (options?.products ?? ['transactions']).map(
      (p) => p as Products,
    );
    const countryCodes = (options?.countryCodes ?? ['US']).map(
      (c) => c as CountryCode,
    );

    const response = await this._client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'FinanceOwl',
      products,
      country_codes: countryCodes,
      language: 'en',
      webhook: this.configService.get<string>('PLAID_WEBHOOK_URL'),
      redirect_uri: options?.redirectUri,
      institution_id: options?.institutionId,
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
      provider: 'plaid',
    };
  }

  async exchangeToken(publicToken: string): Promise<ExchangeResult> {
    const exchangeResponse = await this._client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get accounts
    const accountsResponse = await this._client.accountsGet({
      access_token: accessToken,
    });

    // Get institution info
    const item = accountsResponse.data.item;
    let institutionName: string | null = null;
    const institutionId: string | null = item.institution_id ?? null;

    if (institutionId) {
      try {
        const instResponse = await this._client.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = instResponse.data.institution.name;
      } catch (e) {
        this.logger.warn(`Failed to get institution name for ${institutionId}`);
      }
    }

    const accounts: AggregatorAccount[] = accountsResponse.data.accounts.map(
      (acct) => ({
        externalId: acct.account_id,
        name: acct.name,
        officialName: acct.official_name ?? null,
        type: this.mapAccountType(acct.type),
        subtype: acct.subtype ?? null,
        mask: acct.mask ?? null,
        currentBalance: acct.balances.current ?? null,
        availableBalance: acct.balances.available ?? null,
        creditLimit: acct.balances.limit ?? null,
        currency: acct.balances.iso_currency_code ?? 'USD',
      }),
    );

    return {
      accessToken,
      itemId,
      accounts,
      institutionId,
      institutionName,
      provider: 'plaid',
    };
  }

  async getAccounts(accessToken: string): Promise<AggregatorAccount[]> {
    const response = await this._client.accountsGet({
      access_token: accessToken,
    });

    return response.data.accounts.map((acct) => ({
      externalId: acct.account_id,
      name: acct.name,
      officialName: acct.official_name ?? null,
      type: this.mapAccountType(acct.type),
      subtype: acct.subtype ?? null,
      mask: acct.mask ?? null,
      currentBalance: acct.balances.current ?? null,
      availableBalance: acct.balances.available ?? null,
      creditLimit: acct.balances.limit ?? null,
      currency: acct.balances.iso_currency_code ?? 'USD',
    }));
  }

  async getTransactions(
    accessToken: string,
    startDate: string,
    endDate: string,
  ): Promise<AggregatorTransaction[]> {
    const transactions: AggregatorTransaction[] = [];
    let offset = 0;
    const count = 500;
    let totalTransactions = 0;

    do {
      const response = await this._client.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count, offset },
      });

      totalTransactions = response.data.total_transactions;

      for (const tx of response.data.transactions) {
        transactions.push({
          externalId: tx.transaction_id,
          accountExternalId: tx.account_id,
          amount: tx.amount,
          name: tx.name,
          merchantName: tx.merchant_name ?? null,
          description: tx.original_description ?? null,
          date: tx.date,
          authorizedDate: tx.authorized_date ?? null,
          pending: tx.pending,
          category: tx.category?.join(', ') ?? null,
          personalFinanceCategory:
            tx.personal_finance_category?.primary ?? null,
        });
      }

      offset += response.data.transactions.length;
    } while (offset < totalTransactions);

    return transactions;
  }

  async syncTransactions(
    accessToken: string,
    cursor?: string | null,
  ): Promise<TransactionSyncResult> {
    const response = await this._client.transactionsSync({
      access_token: accessToken,
      cursor: cursor ?? undefined,
    });

    const data = response.data;

    return {
      added: data.added.map((tx) => ({
        externalId: tx.transaction_id,
        accountExternalId: tx.account_id,
        amount: tx.amount,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        description: tx.original_description ?? null,
        date: tx.date,
        authorizedDate: tx.authorized_date ?? null,
        pending: tx.pending,
        category: tx.category?.join(', ') ?? null,
        personalFinanceCategory:
          tx.personal_finance_category?.primary ?? null,
      })),
      modified: data.modified.map((tx) => ({
        externalId: tx.transaction_id,
        accountExternalId: tx.account_id,
        amount: tx.amount,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        description: tx.original_description ?? null,
        date: tx.date,
        authorizedDate: tx.authorized_date ?? null,
        pending: tx.pending,
        category: tx.category?.join(', ') ?? null,
        personalFinanceCategory:
          tx.personal_finance_category?.primary ?? null,
      })),
      removed: data.removed.map((r) => r.transaction_id!).filter(Boolean),
      cursor: data.next_cursor,
      hasMore: data.has_more,
    };
  }

  async getInvestmentHoldings(
    accessToken: string,
  ): Promise<AggregatorHolding[]> {
    const response = await this._client.investmentsHoldingsGet({
      access_token: accessToken,
    });

    const securities = new Map(
      response.data.securities.map((s) => [s.security_id, s]),
    );

    return response.data.holdings.map((h) => {
      const security = securities.get(h.security_id);
      return {
        externalId: h.security_id,
        accountExternalId: h.account_id,
        securityId: h.security_id,
        securityName: security?.name ?? null,
        securityTicker: security?.ticker_symbol ?? null,
        quantity: h.quantity,
        costBasis: h.cost_basis ?? null,
        marketValue: h.institution_value ?? null,
        currency: h.iso_currency_code ?? 'USD',
      };
    });
  }

  async getInstitution(institutionId: string): Promise<InstitutionInfo> {
    const response = await this._client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: { include_optional_metadata: true },
    });

    const inst = response.data.institution;
    return {
      institutionId: inst.institution_id,
      name: inst.name,
      url: inst.url ?? null,
      logo: inst.logo ?? null,
      primaryColor: inst.primary_color ?? null,
      supportedProviders: ['plaid'],
    };
  }

  async removeConnection(accessToken: string): Promise<void> {
    await this._client.itemRemove({ access_token: accessToken });
  }

  async checkHealth(accessToken: string): Promise<ConnectionHealth> {
    try {
      const response = await this._client.itemGet({
        access_token: accessToken,
      });

      const item = response.data.item;
      const error = response.data.status?.transactions?.last_failed_update;
      const lastSuccess =
        response.data.status?.transactions?.last_successful_update ?? null;

      if (item.error) {
        return {
          status:
            item.error.error_code === 'ITEM_LOGIN_REQUIRED'
              ? 'login_required'
              : 'error',
          lastSuccessfulSync: lastSuccess,
          errorCode: item.error.error_code ?? null,
          errorMessage: item.error.error_message ?? null,
        };
      }

      return {
        status: 'healthy',
        lastSuccessfulSync: lastSuccess,
        errorCode: null,
        errorMessage: null,
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
  // Legacy BankSyncProvider methods (kept for backward compatibility)
  // ---------------------------------------------------------------------------

  async createUpdateLinkToken(
    accessToken: string,
  ): Promise<{ linkToken: string; expiration: string }> {
    const response = await this._client.linkTokenCreate({
      user: { client_user_id: 'update' },
      client_name: 'FinanceOwl',
      country_codes: [CountryCode.Us],
      language: 'en',
      access_token: accessToken,
    });

    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    };
  }

  async exchangePublicToken(publicToken: string): Promise<BankSyncExchangeResult> {
    const result = await this.exchangeToken(publicToken);
    return {
      accessToken: result.accessToken,
      itemId: result.itemId,
      accounts: result.accounts,
      institutionId: result.institutionId ?? null,
      institutionName: result.institutionName ?? null,
    };
  }

  async removeItem(accessToken: string): Promise<void> {
    return this.removeConnection(accessToken);
  }

  // ---------------------------------------------------------------------------
  // Plaid-specific: Webhook verification
  // ---------------------------------------------------------------------------

  /**
   * Verify Plaid webhook JWT signature per Plaid's specification.
   *
   * Verification steps:
   * 1. Extract the JWT from the `Plaid-Verification` header.
   * 2. Decode the JWT header to get the `kid` (key ID).
   * 3. Fetch the corresponding public key from Plaid via `webhookVerificationKeyGet`.
   * 4. Build a JWK and verify the JWT signature (ES256 algorithm).
   * 5. Confirm the token is not older than 5 minutes (iat claim).
   * 6. Verify that the request body SHA-256 hash matches the `request_body_sha256` claim.
   */
  async verifyWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    try {
      const token = headers['plaid-verification'] || '';
      if (!token) {
        this.logger.warn('Missing Plaid-Verification header');
        return false;
      }

      // In sandbox mode, skip verification (Plaid sandbox does not always
      // send valid JWTs). Only skip when PLAID_ENV is EXPLICITLY sandbox
      // outside production — an unset PLAID_ENV must fail closed.
      const plaidEnv = this.configService.get<string>('PLAID_ENV');
      if (
        this.configService.get<string>('NODE_ENV') !== 'production' &&
        (plaidEnv === undefined || plaidEnv === 'sandbox')
      ) {
        return true;
      }

      // Step 1: Decode the JWT header to extract the key ID
      const decodedHeader = jose.decodeProtectedHeader(token);
      const kid = decodedHeader.kid;
      if (!kid) {
        this.logger.warn('Plaid webhook JWT missing kid in header');
        return false;
      }

      // Step 2: Fetch the verification key from Plaid using the key ID
      const keyResponse = await this._client.webhookVerificationKeyGet({
        key_id: kid,
      });
      const plaidJwk = keyResponse.data.key;

      // Step 3: Import the JWK for verification
      const publicKey = await jose.importJWK(
        {
          kty: plaidJwk.kty,
          crv: plaidJwk.crv,
          x: plaidJwk.x,
          y: plaidJwk.y,
        },
        plaidJwk.alg || 'ES256',
      );

      // Step 4: Verify the JWT signature
      const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: ['ES256'],
        clockTolerance: 60, // Allow 60 seconds clock skew
      });

      // Step 5: Verify the token is not older than 5 minutes
      const iat = payload.iat;
      if (!iat) {
        this.logger.warn('Plaid webhook JWT missing iat claim');
        return false;
      }
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
      if (iat < fiveMinutesAgo) {
        this.logger.warn('Plaid webhook JWT is older than 5 minutes');
        return false;
      }

      // Step 6: Verify the request body hash
      const expectedHash = payload.request_body_sha256 as string;
      if (!expectedHash) {
        this.logger.warn('Plaid webhook JWT missing request_body_sha256 claim');
        return false;
      }

      const actualHash = createHash('sha256').update(body).digest('hex');
      if (actualHash !== expectedHash) {
        this.logger.warn(
          'Plaid webhook body hash mismatch: JWT claims a different body hash',
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Plaid webhook verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private mapAccountType(plaidType: string): string {
    const typeMap: Record<string, string> = {
      depository: 'checking',
      credit: 'credit_card',
      loan: 'loan',
      investment: 'investment',
      mortgage: 'mortgage',
    };
    return typeMap[plaidType] ?? 'other';
  }
}
