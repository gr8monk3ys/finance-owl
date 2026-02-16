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
 * Unit.co BaaS Provider
 *
 * Integrates with the Unit.co API for opening deposit accounts,
 * initiating ACH transfers, and retrieving balances/transactions.
 *
 * Requires the following environment variables:
 * - UNIT_API_TOKEN
 * - UNIT_ORG_ID
 *
 * All methods gracefully handle missing API keys by logging a
 * warning and throwing descriptive errors.
 */
@Injectable()
export class UnitProvider implements BaaSProvider {
  readonly name: BaaSProviderName = 'unit';

  private readonly logger = new Logger(UnitProvider.name);
  private readonly apiToken: string | undefined;
  private readonly orgId: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('UNIT_API_TOKEN');
    this.orgId = this.configService.get<string>('UNIT_ORG_ID');
    this.baseUrl = this.configService.get<string>(
      'UNIT_API_URL',
      'https://api.s.unit.sh',
    );

    if (!this.apiToken || !this.orgId) {
      this.logger.warn(
        'Unit.co API credentials not configured. Set UNIT_API_TOKEN and UNIT_ORG_ID in your environment. ' +
          'Banking features via Unit will return errors until credentials are provided.',
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

    // 1. Create (or locate) a customer/application in Unit
    const customerId = await this.findOrCreateCustomer(userId, data);

    // 2. Create the deposit account
    const accountType =
      type === 'checking' ? 'depositAccount' : 'depositAccount';
    const body = {
      data: {
        type: 'depositAccount',
        attributes: {
          depositProduct: type === 'checking' ? 'checking' : 'savings',
          tags: { userId, accountType: type },
        },
        relationships: {
          customer: { data: { type: 'customer', id: customerId } },
        },
      },
    };

    const response = await this.request('POST', '/accounts', body);
    return this.mapAccount(response.data);
  }

  async getAccount(externalAccountId: string): Promise<BaaSAccount> {
    this.ensureConfigured();

    const response = await this.request(
      'GET',
      `/accounts/${externalAccountId}`,
    );
    return this.mapAccount(response.data);
  }

  async getBalance(externalAccountId: string): Promise<BaaSBalance> {
    this.ensureConfigured();

    const response = await this.request(
      'GET',
      `/accounts/${externalAccountId}`,
    );
    const attrs = response.data.attributes;

    return {
      available: attrs.available ?? 0,
      pending: (attrs.balance ?? 0) - (attrs.available ?? 0),
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

    // Determine transfer type: book transfer (internal) vs ACH (external)
    const isBook = from.type === 'internal' && to.type === 'internal';

    let body: Record<string, unknown>;

    if (isBook) {
      body = {
        data: {
          type: 'bookPayment',
          attributes: {
            amount,
            description: memo || 'Internal transfer',
          },
          relationships: {
            account: {
              data: { type: 'depositAccount', id: from.accountId },
            },
            counterpartyAccount: {
              data: { type: 'depositAccount', id: to.accountId },
            },
          },
        },
      };
    } else {
      body = {
        data: {
          type: 'achPayment',
          attributes: {
            amount,
            direction: 'Credit',
            description: memo || 'ACH transfer',
            counterparty: {
              routingNumber: to.routingNumber,
              accountNumber: to.accountNumber,
              accountType: 'Checking',
              name: 'External Account',
            },
          },
          relationships: {
            account: {
              data: { type: 'depositAccount', id: from.accountId },
            },
          },
        },
      };
    }

    const endpoint = isBook ? '/payments' : '/payments';
    const response = await this.request('POST', endpoint, body);
    return this.mapTransfer(response.data);
  }

  async getTransferStatus(transferId: string): Promise<BaaSTransfer> {
    this.ensureConfigured();

    const response = await this.request('GET', `/payments/${transferId}`);
    return this.mapTransfer(response.data);
  }

  async getInterestRate(
    accountType: 'checking' | 'savings',
  ): Promise<InterestRate> {
    this.ensureConfigured();

    // Unit doesn't have a dedicated rates endpoint; rates are
    // configured per deposit product in the dashboard.
    // Return the configured/default rates.
    const defaultRates: Record<string, number> = {
      checking: 0.001, // 0.1% APY
      savings: 0.045, // 4.5% APY
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
      'filter[accountId]': externalAccountId,
      'filter[since]': startDate,
      'filter[until]': endDate,
      'page[limit]': '100',
    });

    const response = await this.request(
      'GET',
      `/transactions?${params.toString()}`,
    );

    return (response.data || []).map(
      (tx: Record<string, unknown>) => this.mapTransaction(tx),
    );
  }

  async closeAccount(
    externalAccountId: string,
    reason: string,
  ): Promise<void> {
    this.ensureConfigured();

    await this.request('POST', `/accounts/${externalAccountId}/close`, {
      data: {
        type: 'accountClose',
        attributes: {
          reason,
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private ensureConfigured(): void {
    if (!this.apiToken || !this.orgId) {
      throw new Error(
        'Unit.co is not configured. Please set UNIT_API_TOKEN and UNIT_ORG_ID environment variables.',
      );
    }
  }

  private async findOrCreateCustomer(
    userId: string,
    data: AccountOpenData,
  ): Promise<string> {
    // In a real implementation we would search for an existing customer
    // by userId tag and create one if not found via the applications endpoint.
    const body = {
      data: {
        type: 'individualApplication',
        attributes: {
          fullName: { first: data.fullName.split(' ')[0], last: data.fullName.split(' ').slice(1).join(' ') || data.fullName },
          dateOfBirth: data.dateOfBirth,
          ssn: data.ssn,
          email: data.email,
          phone: { countryCode: '1', number: data.phone || '' },
          address: {
            street: data.address.street,
            city: data.address.city,
            state: data.address.state,
            postalCode: data.address.postalCode,
            country: data.address.country,
          },
          tags: { userId },
        },
      },
    };

    const response = await this.request('POST', '/applications', body);
    // The application may auto-approve and return a customer relationship
    const customerId =
      response.data?.relationships?.customer?.data?.id ||
      response.data?.id;

    return customerId;
  }

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/vnd.api+json',
    };

    const init: RequestInit = { method, headers };
    if (body) {
      init.body = JSON.stringify(body);
    }

    this.logger.debug(`Unit API ${method} ${path}`);

    const res = await fetch(url, init);

    if (!res.ok) {
      const errorBody = await res.text();
      this.logger.error(`Unit API error ${res.status}: ${errorBody}`);
      throw new Error(
        `Unit API request failed (${res.status}): ${errorBody}`,
      );
    }

    if (res.status === 204) {
      return {};
    }

    return res.json();
  }

  private mapAccount(data: Record<string, any>): BaaSAccount {
    const attrs = data.attributes || {};
    return {
      externalAccountId: data.id,
      type: attrs.depositProduct === 'savings' ? 'savings' : 'checking',
      status: this.mapAccountStatus(attrs.status),
      routingNumber: attrs.routingNumber || '',
      accountNumberMask: attrs.accountNumber
        ? String(attrs.accountNumber).slice(-4)
        : '****',
      balance: attrs.balance ?? 0,
      apy: attrs.depositProduct === 'savings' ? 0.045 : 0.001,
      fdicInsured: true,
      bankName: 'Unit Bank Partner',
      createdAt: attrs.createdAt || new Date().toISOString(),
    };
  }

  private mapAccountStatus(
    status: string,
  ): 'pending' | 'active' | 'frozen' | 'closed' {
    const statusMap: Record<string, 'pending' | 'active' | 'frozen' | 'closed'> = {
      Open: 'active',
      Frozen: 'frozen',
      Closed: 'closed',
    };
    return statusMap[status] || 'pending';
  }

  private mapTransfer(data: Record<string, any>): BaaSTransfer {
    const attrs = data.attributes || {};
    return {
      transferId: data.id,
      status: this.mapTransferStatus(attrs.status),
      amount: attrs.amount ?? 0,
      memo: attrs.description || null,
      estimatedArrival: attrs.expectedCompletionDate || null,
      createdAt: attrs.createdAt || new Date().toISOString(),
      completedAt: attrs.completedAt || null,
    };
  }

  private mapTransferStatus(
    status: string,
  ): 'pending' | 'processing' | 'completed' | 'failed' | 'returned' {
    const statusMap: Record<
      string,
      'pending' | 'processing' | 'completed' | 'failed' | 'returned'
    > = {
      Pending: 'pending',
      PendingReview: 'pending',
      Clearing: 'processing',
      Sent: 'processing',
      Completed: 'completed',
      Rejected: 'failed',
      Returned: 'returned',
    };
    return statusMap[status] || 'pending';
  }

  private mapTransaction(data: Record<string, any>): BaaSTransaction {
    const attrs = data.attributes || {};
    const amount = attrs.amount ?? 0;
    return {
      externalId: data.id,
      amount,
      type: amount >= 0 ? 'credit' : 'debit',
      description: attrs.summary || attrs.description || '',
      date: attrs.createdAt || new Date().toISOString(),
      pending: attrs.status === 'Pending',
      category: attrs.tags?.category || null,
    };
  }
}
