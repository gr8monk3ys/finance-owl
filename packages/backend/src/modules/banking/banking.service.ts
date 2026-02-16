import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import {
  bankingAccounts,
  bankingTransfers,
  interestPayments,
} from './banking.schema';
import type {
  BaaSProvider,
  AccountOpenData,
  TransferParty,
} from './providers/baas.interface';
import { BAAS_PROVIDERS } from './providers/baas.interface';

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    @Inject(BAAS_PROVIDERS) private providers: BaaSProvider[],
  ) {}

  // ---------------------------------------------------------------------------
  // Account Operations
  // ---------------------------------------------------------------------------

  /**
   * Open a new checking or savings account via a BaaS provider.
   * Includes a KYC verification stub (in production this would
   * trigger actual identity checks before account creation).
   */
  async openAccount(
    userId: string,
    type: 'checking' | 'savings',
    data: AccountOpenData,
    providerName?: string,
  ) {
    const provider = this.getProvider(providerName);

    // KYC verification stub - in production this would:
    // 1. Check user identity via the provider's KYC flow
    // 2. Run OFAC/sanctions screening
    // 3. Verify SSN and address
    this.logger.log(
      `KYC verification stub for user ${userId} (provider: ${provider.name})`,
    );

    // Open account with the provider
    const baasAccount = await provider.openAccount(userId, type, data);

    // Persist locally
    const [account] = await this.db
      .insert(bankingAccounts)
      .values({
        userId,
        provider: provider.name,
        externalAccountId: baasAccount.externalAccountId,
        type,
        routingNumber: baasAccount.routingNumber,
        accountNumberMask: baasAccount.accountNumberMask,
        balance: baasAccount.balance,
        interestRate: baasAccount.apy,
        apy: baasAccount.apy,
        status: baasAccount.status,
        fdicInsured: baasAccount.fdicInsured,
        bankName: baasAccount.bankName,
      })
      .returning();

    this.logger.log(
      `Account opened: ${account.id} (${type}) via ${provider.name} for user ${userId}`,
    );

    return account;
  }

  /**
   * List all banking accounts for a user.
   */
  async listAccounts(userId: string) {
    return this.db
      .select()
      .from(bankingAccounts)
      .where(eq(bankingAccounts.userId, userId))
      .orderBy(desc(bankingAccounts.createdAt));
  }

  /**
   * Get a single banking account by ID (must belong to user).
   */
  async getAccount(userId: string, accountId: string) {
    const [account] = await this.db
      .select()
      .from(bankingAccounts)
      .where(
        and(
          eq(bankingAccounts.id, accountId),
          eq(bankingAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!account) {
      throw new NotFoundException('Banking account not found');
    }

    // Refresh balance from provider
    try {
      const provider = this.getProvider(account.provider);
      const balance = await provider.getBalance(account.externalAccountId);

      await this.db
        .update(bankingAccounts)
        .set({
          balance: balance.available,
          updatedAt: new Date(),
        })
        .where(eq(bankingAccounts.id, accountId));

      return { ...account, balance: balance.available };
    } catch (err) {
      this.logger.warn(
        `Failed to refresh balance for account ${accountId}: ${err}`,
      );
      return account;
    }
  }

  /**
   * Get aggregated balance across all active banking accounts.
   */
  async getAggregatedBalance(userId: string) {
    const accounts = await this.db
      .select()
      .from(bankingAccounts)
      .where(
        and(
          eq(bankingAccounts.userId, userId),
          eq(bankingAccounts.status, 'active'),
        ),
      );

    const checking = accounts.filter((a) => a.type === 'checking');
    const savings = accounts.filter((a) => a.type === 'savings');

    return {
      totalBalance:
        accounts.reduce((sum, a) => sum + (a.balance || 0), 0),
      checkingBalance:
        checking.reduce((sum, a) => sum + (a.balance || 0), 0),
      savingsBalance:
        savings.reduce((sum, a) => sum + (a.balance || 0), 0),
      accountCount: accounts.length,
      checkingCount: checking.length,
      savingsCount: savings.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Transfer Operations
  // ---------------------------------------------------------------------------

  /**
   * Initiate a transfer between accounts or to an external account.
   */
  async initiateTransfer(
    userId: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    memo?: string,
    transferType: 'internal' | 'external' = 'internal',
    routingNumber?: string,
    accountNumber?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Transfer amount must be positive');
    }

    // Verify source account
    const [fromAccount] = await this.db
      .select()
      .from(bankingAccounts)
      .where(
        and(
          eq(bankingAccounts.id, fromAccountId),
          eq(bankingAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!fromAccount) {
      throw new NotFoundException('Source account not found');
    }

    if (fromAccount.status !== 'active') {
      throw new BadRequestException('Source account is not active');
    }

    // Build transfer parties
    const from: TransferParty = {
      accountId: fromAccount.externalAccountId,
      type: 'internal',
    };

    let to: TransferParty;
    let localToAccountId: string | null = null;

    if (transferType === 'internal') {
      const [toAccount] = await this.db
        .select()
        .from(bankingAccounts)
        .where(
          and(
            eq(bankingAccounts.id, toAccountId),
            eq(bankingAccounts.userId, userId),
          ),
        )
        .limit(1);

      if (!toAccount) {
        throw new NotFoundException('Destination account not found');
      }

      to = {
        accountId: toAccount.externalAccountId,
        type: 'internal',
      };
      localToAccountId = toAccount.id;
    } else {
      if (!routingNumber || !accountNumber) {
        throw new BadRequestException(
          'Routing number and account number are required for external transfers',
        );
      }
      to = {
        accountId: toAccountId,
        routingNumber,
        accountNumber,
        type: 'external',
      };
    }

    const provider = this.getProvider(fromAccount.provider);
    const baasTransfer = await provider.initiateTransfer(
      from,
      to,
      amount,
      memo,
    );

    // Persist transfer locally
    const [transfer] = await this.db
      .insert(bankingTransfers)
      .values({
        userId,
        fromAccountId: fromAccount.id,
        toAccountId: localToAccountId,
        amount,
        memo: memo || null,
        status: baasTransfer.status,
        externalTransferId: baasTransfer.transferId,
        estimatedArrival: baasTransfer.estimatedArrival,
      })
      .returning();

    this.logger.log(
      `Transfer initiated: ${transfer.id} ($${(amount / 100).toFixed(2)}) for user ${userId}`,
    );

    return transfer;
  }

  /**
   * List transfers for a user, optionally filtered by status.
   */
  async listTransfers(userId: string, status?: string) {
    const conditions = [eq(bankingTransfers.userId, userId)];
    if (status) {
      conditions.push(eq(bankingTransfers.status, status));
    }

    return this.db
      .select()
      .from(bankingTransfers)
      .where(and(...conditions))
      .orderBy(desc(bankingTransfers.createdAt));
  }

  /**
   * Get a single transfer by ID with live status from the provider.
   */
  async getTransfer(userId: string, transferId: string) {
    const [transfer] = await this.db
      .select()
      .from(bankingTransfers)
      .where(
        and(
          eq(bankingTransfers.id, transferId),
          eq(bankingTransfers.userId, userId),
        ),
      )
      .limit(1);

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Refresh status from provider if the transfer has an external ID
    if (transfer.externalTransferId && transfer.fromAccountId) {
      try {
        const [fromAccount] = await this.db
          .select()
          .from(bankingAccounts)
          .where(eq(bankingAccounts.id, transfer.fromAccountId))
          .limit(1);

        if (fromAccount) {
          const provider = this.getProvider(fromAccount.provider);
          const baasTransfer = await provider.getTransferStatus(
            transfer.externalTransferId,
          );

          if (baasTransfer.status !== transfer.status) {
            await this.db
              .update(bankingTransfers)
              .set({
                status: baasTransfer.status,
                completedAt:
                  baasTransfer.status === 'completed'
                    ? new Date()
                    : null,
              })
              .where(eq(bankingTransfers.id, transferId));

            return { ...transfer, status: baasTransfer.status };
          }
        }
      } catch (err) {
        this.logger.warn(
          `Failed to refresh transfer status for ${transferId}: ${err}`,
        );
      }
    }

    return transfer;
  }

  // ---------------------------------------------------------------------------
  // Interest Tracking
  // ---------------------------------------------------------------------------

  /**
   * Get interest earned summary across all banking accounts for a user.
   */
  async getInterestSummary(userId: string) {
    // Get all banking accounts for the user
    const accounts = await this.db
      .select()
      .from(bankingAccounts)
      .where(eq(bankingAccounts.userId, userId));

    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return {
        totalEarned: 0,
        thisMonth: 0,
        thisYear: 0,
        payments: [],
        byAccount: [],
      };
    }

    // Get all interest payments for these accounts
    const payments = await this.db
      .select()
      .from(interestPayments)
      .where(
        sql`${interestPayments.bankingAccountId} IN (${sql.join(
          accountIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(desc(interestPayments.createdAt));

    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisYearPrefix = `${now.getFullYear()}`;

    const totalEarned = payments.reduce((sum, p) => sum + p.amount, 0);
    const thisMonth = payments
      .filter((p) => p.period.startsWith(thisMonthPrefix))
      .reduce((sum, p) => sum + p.amount, 0);
    const thisYear = payments
      .filter((p) => p.period.startsWith(thisYearPrefix))
      .reduce((sum, p) => sum + p.amount, 0);

    // Group by account
    const byAccount = accounts.map((account) => {
      const accountPayments = payments.filter(
        (p) => p.bankingAccountId === account.id,
      );
      return {
        accountId: account.id,
        accountType: account.type,
        apy: account.apy,
        totalEarned: accountPayments.reduce((sum, p) => sum + p.amount, 0),
      };
    });

    return {
      totalEarned,
      thisMonth,
      thisYear,
      payments: payments.slice(0, 20), // last 20 payments
      byAccount,
    };
  }

  // ---------------------------------------------------------------------------
  // Interest Rates
  // ---------------------------------------------------------------------------

  /**
   * Get current interest rates from all configured providers.
   */
  async getCurrentRates() {
    const rates: Array<{
      provider: string;
      checking: { apy: number; isVariable: boolean };
      savings: { apy: number; isVariable: boolean };
    }> = [];

    for (const provider of this.providers) {
      try {
        const [checkingRate, savingsRate] = await Promise.all([
          provider.getInterestRate('checking'),
          provider.getInterestRate('savings'),
        ]);

        rates.push({
          provider: provider.name,
          checking: {
            apy: checkingRate.apy,
            isVariable: checkingRate.isVariable,
          },
          savings: {
            apy: savingsRate.apy,
            isVariable: savingsRate.isVariable,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to fetch rates from ${provider.name}: ${err}`,
        );
      }
    }

    // If no providers are configured, return default competitive rates
    if (rates.length === 0) {
      rates.push({
        provider: 'default',
        checking: { apy: 0.001, isVariable: true },
        savings: { apy: 0.045, isVariable: true },
      });
    }

    return rates;
  }

  // ---------------------------------------------------------------------------
  // FDIC Disclosures
  // ---------------------------------------------------------------------------

  /**
   * Get FDIC disclosure information for user's accounts.
   */
  getFdicDisclosure() {
    return {
      insured: true,
      maxCoverage: 250_000_00, // $250,000 in cents
      maxCoverageFormatted: '$250,000',
      disclosure:
        'Deposits are FDIC insured up to $250,000 per depositor, per insured bank, for each account ownership category. ' +
        'FinanceOwl is not a bank. Banking services are provided by our partner banks, Members FDIC.',
      learnMoreUrl: 'https://www.fdic.gov/resources/deposit-insurance/',
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  /**
   * Get a provider by name, falling back to the first available.
   */
  private getProvider(name?: string): BaaSProvider {
    if (this.providers.length === 0) {
      throw new BadRequestException(
        'No BaaS providers are configured. Please contact support.',
      );
    }

    if (name) {
      const provider = this.providers.find((p) => p.name === name);
      if (!provider) {
        throw new BadRequestException(
          `BaaS provider "${name}" is not available. Available providers: ${this.providers.map((p) => p.name).join(', ')}`,
        );
      }
      return provider;
    }

    // Default to first provider
    return this.providers[0];
  }
}
