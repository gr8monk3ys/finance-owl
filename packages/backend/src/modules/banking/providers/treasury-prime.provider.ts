import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


import type {
  BaaSProvider,
  BaaSProviderName,
  AccountOpenData,
  BaaSAccount,
  BaaSBalance,
  BaaSTransfer,
  InterestRate,
  BaaSTransaction,
  TransferParty,
} from './baas.interface';

/**
 * Treasury Prime BaaS Provider
 *
 * Integrates with the Treasury Prime API for deposit account
 * management, ACH transfers, and transaction history.
 *
 * Requires the following environment variables:
 * - TREASURY_PRIME_API_KEY
 * - TREASURY_PRIME_ACCOUNT_ID  (the bank/program account)
 *
 * All methods gracefully handle missing API keys by logging a
 * warning and throwing descriptive errors.
 */
@Injectable()
export class TreasuryPrimeProvider implements BaaSProvider {
  readonly name: BaaSProviderName = 'treasury_prime';

  private readonly logger = new Logger(TreasuryPrimeProvider.name);
  private readonly apiKey: string | undefined;
  private readonly programAccountId: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TREASURY_PRIME_API_KEY');
    this.programAccountId = this.configService.get<string>(
      'TREASURY_PRIME_ACCOUNT_ID',
    );
    this.baseUrl = this.configService.get<string>(
      'TREASURY_PRIME_API_URL',
      'https://api.treasuryprime.com',
    );

    if (!this.apiKey || !this.programAccountId) {
      this.logger.warn(
        'Treasury Prime API credentials not configured. Set TREASURY_PRIME_API_KEY and TREASURY_PRIME_ACCOUNT_ID ' +
          'in your environment. Banking features via Treasury Prime will return errors until credentials are provided.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // BaaSProvider Implementation
  // -------------------------------------------------------------------------

  async openAccount(
    userId: string,
    type: 'checking' | 'savings',
    data: AccountOpenData,
  ): Promise<BaaSAccount> {
    this.ensureConfigured();

    // 1. Create or find the person (KYC entity)
    const personId = await this.createPerson(userId, data);

    // 2. Create the account
    const body = {
      person_id: personId,
      account_type: type,
      name: `${data.fullName} - ${type}`,
      userdata: { userId },
    };

    const response = await this.request('POST', '/account', body);
    return this.mapAccount(response);
  }

  async getAccount(externalAccountId: string): Promise<BaaSAccount> {
    this.ensureConfigured();

    const response = await this.request(
      'GET',
      `/account/${externalAccountId}`,
    );
    return this.mapAccount(response);
  }

  async getBalance(externalAccountId: string): Promise<BaaSBalance> {
    this.ensureConfigured();

    const response = await this.request(
      'GET',
      `/account/${externalAccountId}`,
    );

    return {
      available: (response.available_balance as number) ?? 0,
      pending: ((response.current_balance as number) ?? 0) - ((response.available_balance as number) ?? 0),
      currency: 'USD',
    };
  }

  async initiateTransfer(
    from: TransferParty,
    to: TransferParty,
    amount: number,
    memo?: string,
  ): Promise<BaaSTransfer> {
    this.ensureConfigured();

    const isBook = from.type === 'internal' && to.type === 'internal';

    let body: Record<string, unknown>;

    if (isBook) {
      body = {
        from_account_id: from.accountId,
        to_account_id: to.accountId,
        amount: this.centsToDollars(amount),
        description: memo || 'Internal transfer',
      };

      const response = await this.request('POST', '/book', body);
      return this.mapTransfer(response);
    } else {
      body = {
        account_id: from.accountId,
        amount: this.centsToDollars(amount),
        direction: 'credit',
        counterparty: {
          routing_number: to.routingNumber,
          account_number: to.accountNumber,
          account_type: 'checking',
        },
        description: memo || 'ACH transfer',
      };

      const response = await this.request('POST', '/ach', body);
      return this.mapTransfer(response);
    }
  }

  async getTransferStatus(transferId: string): Promise<BaaSTransfer> {
    this.ensureConfigured();

    // Try book transfer first, then ACH
    try {
      const response = await this.request('GET', `/book/${transferId}`);
      return this.mapTransfer(response);
    } catch {
      const response = await this.request('GET', `/ach/${transferId}`);
      return this.mapTransfer(response);
    }
  }

  async getInterestRate(
    accountType: 'checking' | 'savings',
  ): Promise<InterestRate> {
    this.ensureConfigured();

    // Treasury Prime rates are configured at the program level.
    // Return configured/default rates.
    const defaultRates: Record<string, number> = {
      checking: 0.0005, // 0.05% APY
      savings: 0.042, // 4.2% APY
    };

    return {
      accountType,
      apy: defaultRates[accountType],
      effectiveDate: new Date().toISOString(),
      isVariable: true,
    };
  }

  async getTransactions(
    externalAccountId: string,
    startDate: string,
    endDate: string,
  ): Promise<BaaSTransaction[]> {
    this.ensureConfigured();

    const params = new URLSearchParams({
      account_id: externalAccountId,
      from_date: startDate,
      to_date: endDate,
      limit: '100',
    });

    const response = await this.request(
      'GET',
      `/transaction?${params.toString()}`,
    );

    const transactions = (Array.isArray(response) ? response : (response.data as Record<string, unknown>[]) || []) as Record<string, unknown>[];
    return transactions.map((tx) => this.mapTransaction(tx));
  }

  async closeAccount(
    externalAccountId: string,
    reason: string,
  ): Promise<void> {
    this.ensureConfigured();

    await this.request('PATCH', `/account/${externalAccountId}`, {
      status: 'closed',
      close_reason: reason,
    });
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private ensureConfigured(): void {
    if (!this.apiKey || !this.programAccountId) {
      throw new Error(
        'Treasury Prime is not configured. Please set TREASURY_PRIME_API_KEY and TREASURY_PRIME_ACCOUNT_ID environment variables.',
      );
    }
  }

  private async createPerson(
    userId: string,
    data: AccountOpenData,
  ): Promise<string> {
    const nameParts = data.fullName.split(' ');
    const body = {
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || nameParts[0],
      date_of_birth: data.dateOfBirth,
      ssn: data.ssn,
      email_address: data.email,
      phone_number: data.phone || '',
      address: {
        street_line_1: data.address.street,
        city: data.address.city,
        state: data.address.state,
        postal_code: data.address.postalCode,
        country: data.address.country,
      },
      userdata: { userId },
    };

    const response = await this.request('POST', '/person', body);
    return response.id as string;
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (body) {
      init.body = JSON.stringify(body);
    }

    this.logger.debug(`Treasury Prime API ${method} ${path}`);

    const res = await fetch(url, init);

    if (!res.ok) {
      const errorBody = await res.text();
      this.logger.error(
        `Treasury Prime API error ${res.status}: ${errorBody}`,
      );
      throw new Error(
        `Treasury Prime API request failed (${res.status}): ${errorBody}`,
      );
    }

    if (res.status === 204) {
      return {};
    }

    return res.json();
  }

  private centsToDollars(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private mapAccount(data: Record<string, unknown>): BaaSAccount {
    return {
      externalAccountId: data.id as string,
      type: data.account_type === 'savings' ? 'savings' : 'checking',
      status: this.mapAccountStatus(data.status as string),
      routingNumber: (data.routing_number || data.aba_routing_number || '') as string,
      accountNumberMask: data.account_number
        ? String(data.account_number).slice(-4)
        : '****',
      balance: (data.available_balance as number) ?? 0,
      apy: data.account_type === 'savings' ? 0.042 : 0.0005,
      fdicInsured: true,
      bankName: (data.bank_name || 'Treasury Prime Bank Partner') as string,
      createdAt: (data.created_at || new Date().toISOString()) as string,
    };
  }

  private mapAccountStatus(
    status: string,
  ): 'pending' | 'active' | 'frozen' | 'closed' {
    const statusMap: Record<string, 'pending' | 'active' | 'frozen' | 'closed'> = {
      open: 'active',
      active: 'active',
      frozen: 'frozen',
      closed: 'closed',
      pending: 'pending',
    };
    return statusMap[status] || 'pending';
  }

  private mapTransfer(data: Record<string, unknown>): BaaSTransfer {
    return {
      transferId: data.id as string,
      status: this.mapTransferStatus(data.status as string),
      amount: data.amount
        ? Math.round(parseFloat(data.amount as string) * 100)
        : 0,
      memo: (data.description as string | null) || null,
      estimatedArrival: (data.estimated_settlement_date as string | null) || null,
      createdAt: (data.created_at || new Date().toISOString()) as string,
      completedAt: (data.settled_at as string | null) || null,
    };
  }

  private mapTransferStatus(
    status: string,
  ): 'pending' | 'processing' | 'completed' | 'failed' | 'returned' {
    const statusMap: Record<
      string,
      'pending' | 'processing' | 'completed' | 'failed' | 'returned'
    > = {
      pending: 'pending',
      processing: 'processing',
      settling: 'processing',
      settled: 'completed',
      completed: 'completed',
      failed: 'failed',
      returned: 'returned',
      rejected: 'failed',
    };
    return statusMap[status] || 'pending';
  }

  private mapTransaction(data: Record<string, unknown>): BaaSTransaction {
    const amount = data.amount
      ? Math.round(parseFloat(data.amount as string) * 100)
      : 0;

    return {
      externalId: data.id as string,
      amount,
      type: amount >= 0 ? 'credit' : 'debit',
      description: (data.description || data.memo || '') as string,
      date: (data.created_at || new Date().toISOString()) as string,
      pending: data.status === 'pending',
      category: (data.category as string | null) || null,
    };
  }
}
