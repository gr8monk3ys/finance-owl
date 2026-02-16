import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type RemovedTransaction,
  type Transaction as PlaidTransaction,
} from 'plaid';
import { AxiosError } from 'axios';
import { eq, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import * as jose from 'jose';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CryptoService } from '../../common/crypto/crypto.service';
import * as schema from '../../database/schema';

/**
 * Metadata received from Plaid Link after user completes the connection flow.
 * The frontend sends this alongside the public_token.
 */
export interface PlaidLinkMetadata {
  institution?: {
    institution_id: string;
    name: string;
  };
  accounts?: Array<{
    id: string;
    name: string;
    mask: string | null;
    type: string;
    subtype: string | null;
  }>;
}

export interface SyncStats {
  added: number;
  modified: number;
  removed: number;
}

interface PlaidWebhookBody {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
  consent_expiration_time?: string;
}

/** Plaid API error shape (from AxiosError response data). */
interface PlaidErrorData {
  error_type?: string;
  error_code?: string;
  error_message?: string;
  display_message?: string;
}

@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private readonly client: PlaidApi;
  private readonly webhookUrl: string | undefined;

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private configService: ConfigService,
    private cryptoService: CryptoService,
  ) {
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

    this.client = new PlaidApi(configuration);
    this.webhookUrl = this.configService.get<string>('PLAID_WEBHOOK_URL');
  }

  // ---------------------------------------------------------------------------
  // Link Token
  // ---------------------------------------------------------------------------

  /**
   * Create a Plaid Link token for a user to initiate the bank connection flow.
   * The token is short-lived and scoped to the user + requested products.
   */
  async createLinkToken(userId: string): Promise<{
    linkToken: string;
    expiration: string;
  }> {
    try {
      const response = await this.client.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'FinanceOwl',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: this.webhookUrl,
      });

      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error) {
      throw this.handlePlaidError(error, 'createLinkToken');
    }
  }

  // ---------------------------------------------------------------------------
  // Exchange Public Token
  // ---------------------------------------------------------------------------

  /**
   * Exchange a Plaid Link public_token for a persistent access_token.
   * The access_token is AES-256-GCM encrypted before storage.
   *
   * Steps:
   *   1. Exchange public_token -> access_token + item_id via Plaid API
   *   2. Fetch accounts from Plaid
   *   3. Resolve institution name
   *   4. Encrypt access_token and store plaid_item row
   *   5. Upsert linked accounts
   *   6. Return created records
   */
  async exchangePublicToken(
    userId: string,
    publicToken: string,
    metadata?: PlaidLinkMetadata,
  ) {
    try {
      // Step 1: Exchange for access token
      const exchangeResponse = await this.client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = exchangeResponse.data.access_token;
      const plaidItemId = exchangeResponse.data.item_id;

      // Step 2: Fetch accounts from Plaid
      const accountsResponse = await this.client.accountsGet({
        access_token: accessToken,
      });

      // Step 3: Resolve institution info
      const item = accountsResponse.data.item;
      const institutionId = item.institution_id ?? metadata?.institution?.institution_id ?? null;
      let institutionName = metadata?.institution?.name ?? null;

      if (institutionId && !institutionName) {
        try {
          const instResponse = await this.client.institutionsGetById({
            institution_id: institutionId,
            country_codes: [CountryCode.Us],
          });
          institutionName = instResponse.data.institution.name;
        } catch {
          this.logger.warn(
            `Failed to fetch institution name for ${institutionId}`,
          );
        }
      }

      // Step 4: Encrypt token and store Plaid item
      const encryptedToken = this.cryptoService.encrypt(accessToken);

      const [plaidItem] = await this.db
        .insert(schema.plaidItems)
        .values({
          userId,
          plaidItemId,
          accessToken: encryptedToken,
          institutionId,
          institutionName,
          status: 'active',
        })
        .returning();

      // Step 5: Upsert accounts
      const createdAccounts = [];
      for (const acct of accountsResponse.data.accounts) {
        const [created] = await this.db
          .insert(schema.accounts)
          .values({
            userId,
            plaidItemId: plaidItem.id,
            plaidAccountId: acct.account_id,
            name: acct.official_name || acct.name,
            officialName: acct.official_name ?? null,
            type: this.mapAccountType(acct.type),
            subtype: acct.subtype ?? null,
            institutionName,
            mask: acct.mask ?? null,
            currentBalance: acct.balances.current ?? 0,
            availableBalance: acct.balances.available ?? null,
            creditLimit: acct.balances.limit ?? null,
            currency: acct.balances.iso_currency_code ?? 'USD',
            isManual: false,
          })
          .returning();
        createdAccounts.push(created);
      }

      this.logger.log(
        `Linked ${createdAccounts.length} accounts from ${institutionName ?? 'unknown'} for user ${userId}`,
      );

      return {
        plaidItem,
        accounts: createdAccounts,
      };
    } catch (error) {
      throw this.handlePlaidError(error, 'exchangePublicToken');
    }
  }

  // ---------------------------------------------------------------------------
  // Transaction Sync (cursor-based)
  // ---------------------------------------------------------------------------

  /**
   * Sync transactions for a Plaid item using the /transactions/sync endpoint.
   * This is cursor-based: it resumes from where the last sync left off.
   *
   * Handles:
   *   - Added transactions (insert)
   *   - Modified transactions (update, preserving user categorization)
   *   - Removed transactions (delete)
   *   - Pagination (has_more flag)
   *   - Cursor persistence between syncs
   *   - Initial historical sync (first call with no cursor fetches up to 2 years)
   */
  async syncTransactions(itemId: string): Promise<SyncStats> {
    const item = await this.getItemById(itemId);
    const accessToken = this.cryptoService.decrypt(item.accessToken);

    // Build plaidAccountId -> internal accountId map
    const accountRows = await this.db
      .select({
        id: schema.accounts.id,
        plaidAccountId: schema.accounts.plaidAccountId,
      })
      .from(schema.accounts)
      .where(eq(schema.accounts.plaidItemId, itemId));

    const accountMap = new Map<string, string>();
    for (const row of accountRows) {
      if (row.plaidAccountId) {
        accountMap.set(row.plaidAccountId, row.id);
      }
    }

    let cursor = item.cursor;
    const stats: SyncStats = { added: 0, modified: 0, removed: 0 };
    let hasMore = true;

    try {
      while (hasMore) {
        const response = await this.client.transactionsSync({
          access_token: accessToken,
          cursor: cursor ?? undefined,
          count: 500,
        });

        const data = response.data;

        // Process added transactions
        for (const tx of data.added) {
          const accountId = accountMap.get(tx.account_id);
          if (!accountId) {
            this.logger.warn(
              `No local account for Plaid account ${tx.account_id}, skipping`,
            );
            continue;
          }
          await this.upsertTransaction(item.userId, accountId, tx);
          stats.added++;
        }

        // Process modified transactions
        for (const tx of data.modified) {
          const accountId = accountMap.get(tx.account_id);
          if (!accountId) continue;
          await this.upsertTransaction(item.userId, accountId, tx);
          stats.modified++;
        }

        // Process removed transactions
        for (const removed of data.removed) {
          const txId = (removed as RemovedTransaction).transaction_id;
          if (txId) {
            await this.db
              .delete(schema.transactions)
              .where(eq(schema.transactions.plaidTransactionId, txId));
            stats.removed++;
          }
        }

        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      // Persist cursor for the next sync
      await this.db
        .update(schema.plaidItems)
        .set({
          cursor,
          status: 'active',
          errorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.plaidItems.id, itemId));

      this.logger.log(
        `Sync complete for item ${itemId}: +${stats.added} ~${stats.modified} -${stats.removed}`,
      );

      return stats;
    } catch (error) {
      // If the cursor is corrupted or Plaid asks for a reset, clear cursor and retry
      if (this.isPlaidError(error, 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION')) {
        this.logger.warn(
          `Cursor invalidated for item ${itemId}, resetting cursor and retrying`,
        );
        await this.db
          .update(schema.plaidItems)
          .set({ cursor: null, updatedAt: new Date() })
          .where(eq(schema.plaidItems.id, itemId));

        // Recurse once with a fresh cursor
        return this.syncTransactions(itemId);
      }

      await this.updateItemStatusOnError(itemId, error);
      throw this.handlePlaidError(error, 'syncTransactions');
    }
  }

  // ---------------------------------------------------------------------------
  // Account Sync
  // ---------------------------------------------------------------------------

  /**
   * Fetch all accounts from Plaid for a given item and upsert them locally.
   * Updates balances, names, and metadata. Does not remove accounts that
   * Plaid no longer returns (they may be temporarily unavailable).
   */
  async syncAccounts(
    itemId: string,
  ): Promise<{ synced: number }> {
    const item = await this.getItemById(itemId);
    const accessToken = this.cryptoService.decrypt(item.accessToken);

    try {
      const response = await this.client.accountsGet({
        access_token: accessToken,
      });

      for (const acct of response.data.accounts) {
        // Check if account already exists
        const [existing] = await this.db
          .select({ id: schema.accounts.id })
          .from(schema.accounts)
          .where(
            and(
              eq(schema.accounts.plaidAccountId, acct.account_id),
              eq(schema.accounts.plaidItemId, itemId),
            ),
          )
          .limit(1);

        if (existing) {
          await this.db
            .update(schema.accounts)
            .set({
              name: acct.official_name || acct.name,
              officialName: acct.official_name ?? null,
              type: this.mapAccountType(acct.type),
              subtype: acct.subtype ?? null,
              mask: acct.mask ?? null,
              currentBalance: acct.balances.current ?? 0,
              availableBalance: acct.balances.available ?? null,
              creditLimit: acct.balances.limit ?? null,
              currency: acct.balances.iso_currency_code ?? 'USD',
              updatedAt: new Date(),
            })
            .where(eq(schema.accounts.id, existing.id));
        } else {
          await this.db.insert(schema.accounts).values({
            userId: item.userId,
            plaidItemId: itemId,
            plaidAccountId: acct.account_id,
            name: acct.official_name || acct.name,
            officialName: acct.official_name ?? null,
            type: this.mapAccountType(acct.type),
            subtype: acct.subtype ?? null,
            institutionName: item.institutionName,
            mask: acct.mask ?? null,
            currentBalance: acct.balances.current ?? 0,
            availableBalance: acct.balances.available ?? null,
            creditLimit: acct.balances.limit ?? null,
            currency: acct.balances.iso_currency_code ?? 'USD',
            isManual: false,
          });
        }
      }

      return { synced: response.data.accounts.length };
    } catch (error) {
      await this.updateItemStatusOnError(itemId, error);
      throw this.handlePlaidError(error, 'syncAccounts');
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook Handling
  // ---------------------------------------------------------------------------

  /**
   * Verify Plaid webhook JWT signature and process the event.
   *
   * Verification (production mode):
   *   1. Extract JWT from Plaid-Verification header
   *   2. Decode header to get kid
   *   3. Fetch public key from Plaid via webhookVerificationKeyGet
   *   4. Verify JWT signature (ES256)
   *   5. Check iat is within 5 minutes
   *   6. Verify SHA-256 hash of request body matches claim
   *
   * Processing:
   *   - TRANSACTIONS webhooks: queue transaction sync
   *   - ITEM webhooks: update item status
   */
  async handleWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<{ received: true; action: string }> {
    // Verify signature (skip in sandbox)
    const isSandbox =
      this.configService.get<string>('PLAID_ENV', 'sandbox') === 'sandbox';

    if (!isSandbox) {
      const isValid = await this.verifyWebhookSignature(body, headers);
      if (!isValid) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    const payload: PlaidWebhookBody = JSON.parse(body);

    this.logger.log(
      `Webhook received: ${payload.webhook_type}/${payload.webhook_code} for item ${payload.item_id}`,
    );

    let action = 'ignored';

    switch (payload.webhook_type) {
      case 'TRANSACTIONS':
        action = await this.handleTransactionWebhook(payload);
        break;

      case 'ITEM':
        action = await this.handleItemWebhook(payload);
        break;

      default:
        this.logger.log(
          `Unhandled webhook type: ${payload.webhook_type}/${payload.webhook_code}`,
        );
        action = 'unhandled';
    }

    return { received: true, action };
  }

  // ---------------------------------------------------------------------------
  // Remove Item
  // ---------------------------------------------------------------------------

  /**
   * Disconnect a Plaid item. Revokes the access_token at Plaid,
   * removes associated accounts (which cascades to transactions via FK),
   * and deletes the plaid_items row.
   */
  async removeItem(userId: string, itemId: string): Promise<void> {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(
        and(
          eq(schema.plaidItems.id, itemId),
          eq(schema.plaidItems.userId, userId),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException(`Plaid item ${itemId} not found`);
    }

    // Revoke access at Plaid (best-effort; don't fail if Plaid is unreachable)
    try {
      const accessToken = this.cryptoService.decrypt(item.accessToken);
      await this.client.itemRemove({ access_token: accessToken });
    } catch (error) {
      this.logger.warn(
        `Failed to remove item at Plaid (may already be revoked): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Delete linked accounts (cascade will handle transactions via FK)
    await this.db
      .delete(schema.accounts)
      .where(eq(schema.accounts.plaidItemId, itemId));

    // Delete the Plaid item row
    await this.db
      .delete(schema.plaidItems)
      .where(eq(schema.plaidItems.id, itemId));

    this.logger.log(
      `Removed Plaid item ${itemId} for user ${userId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Refresh Balances
  // ---------------------------------------------------------------------------

  /**
   * On-demand balance refresh. Fetches latest balances from Plaid
   * and updates the local accounts table.
   */
  async refreshBalances(
    itemId: string,
  ): Promise<{ refreshed: number }> {
    const item = await this.getItemById(itemId);
    const accessToken = this.cryptoService.decrypt(item.accessToken);

    try {
      const response = await this.client.accountsGet({
        access_token: accessToken,
      });

      for (const acct of response.data.accounts) {
        await this.db
          .update(schema.accounts)
          .set({
            currentBalance: acct.balances.current ?? 0,
            availableBalance: acct.balances.available ?? null,
            creditLimit: acct.balances.limit ?? null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.accounts.plaidAccountId, acct.account_id),
              eq(schema.accounts.plaidItemId, itemId),
            ),
          );
      }

      return { refreshed: response.data.accounts.length };
    } catch (error) {
      await this.updateItemStatusOnError(itemId, error);
      throw this.handlePlaidError(error, 'refreshBalances');
    }
  }

  // ---------------------------------------------------------------------------
  // List Items
  // ---------------------------------------------------------------------------

  /**
   * List all connected Plaid items for a user (without exposing access tokens).
   */
  async getItems(userId: string) {
    return this.db
      .select({
        id: schema.plaidItems.id,
        institutionId: schema.plaidItems.institutionId,
        institutionName: schema.plaidItems.institutionName,
        status: schema.plaidItems.status,
        errorCode: schema.plaidItems.errorCode,
        consentExpiresAt: schema.plaidItems.consentExpiresAt,
        createdAt: schema.plaidItems.createdAt,
        updatedAt: schema.plaidItems.updatedAt,
      })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.userId, userId));
  }

  // ---------------------------------------------------------------------------
  // Private: Webhook Processing
  // ---------------------------------------------------------------------------

  private async handleTransactionWebhook(
    payload: PlaidWebhookBody,
  ): Promise<string> {
    const internalItem = await this.findItemByPlaidItemId(payload.item_id);
    if (!internalItem) {
      this.logger.warn(
        `Webhook for unknown Plaid item_id: ${payload.item_id}`,
      );
      return 'item_not_found';
    }

    switch (payload.webhook_code) {
      case 'SYNC_UPDATES_AVAILABLE':
      case 'INITIAL_UPDATE':
      case 'HISTORICAL_UPDATE':
        this.logger.log(
          `Triggering sync for item ${internalItem.id} (${payload.webhook_code})`,
        );
        // Sync inline; in production you would typically queue this via BullMQ
        await this.syncTransactions(internalItem.id);
        return `synced_${payload.webhook_code.toLowerCase()}`;

      case 'DEFAULT_UPDATE':
        await this.syncTransactions(internalItem.id);
        return 'synced_default_update';

      case 'TRANSACTIONS_REMOVED':
        if (payload.removed_transactions?.length) {
          for (const txId of payload.removed_transactions) {
            await this.db
              .delete(schema.transactions)
              .where(eq(schema.transactions.plaidTransactionId, txId));
          }
        }
        return 'transactions_removed';

      default:
        this.logger.log(
          `Unhandled transaction webhook code: ${payload.webhook_code}`,
        );
        return 'unhandled_transaction';
    }
  }

  private async handleItemWebhook(
    payload: PlaidWebhookBody,
  ): Promise<string> {
    switch (payload.webhook_code) {
      case 'ERROR': {
        const errorCode = payload.error?.error_code;
        const status =
          errorCode === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error';

        this.logger.warn(
          `Item error for ${payload.item_id}: ${errorCode} - ${payload.error?.error_message}`,
        );

        await this.db
          .update(schema.plaidItems)
          .set({
            status,
            errorCode: errorCode ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.plaidItemId, payload.item_id));

        return `item_${status}`;
      }

      case 'LOGIN_REPAIRED':
        this.logger.log(`Login repaired for item ${payload.item_id}`);
        await this.db
          .update(schema.plaidItems)
          .set({
            status: 'active',
            errorCode: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.plaidItemId, payload.item_id));
        return 'login_repaired';

      case 'PENDING_EXPIRATION':
        this.logger.warn(
          `Consent expiring for item ${payload.item_id} at ${payload.consent_expiration_time}`,
        );
        await this.db
          .update(schema.plaidItems)
          .set({
            status: 'pending_expiration',
            consentExpiresAt: payload.consent_expiration_time ?? null,
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.plaidItemId, payload.item_id));
        return 'pending_expiration';

      case 'USER_PERMISSION_REVOKED':
        this.logger.warn(
          `User revoked permission for item ${payload.item_id}`,
        );
        await this.db
          .update(schema.plaidItems)
          .set({
            status: 'revoked',
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.plaidItemId, payload.item_id));
        return 'user_permission_revoked';

      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        return 'webhook_update_acknowledged';

      default:
        this.logger.log(
          `Unhandled item webhook code: ${payload.webhook_code}`,
        );
        return 'unhandled_item';
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Webhook Signature Verification
  // ---------------------------------------------------------------------------

  private async verifyWebhookSignature(
    body: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    try {
      const token = headers['plaid-verification'] || '';
      if (!token) {
        this.logger.warn('Missing Plaid-Verification header');
        return false;
      }

      // Decode JWT header to get key ID
      const decodedHeader = jose.decodeProtectedHeader(token);
      const kid = decodedHeader.kid;
      if (!kid) {
        this.logger.warn('Webhook JWT missing kid');
        return false;
      }

      // Fetch verification key from Plaid
      const keyResponse = await this.client.webhookVerificationKeyGet({
        key_id: kid,
      });
      const plaidJwk = keyResponse.data.key;

      // Import JWK for verification
      const publicKey = await jose.importJWK(
        {
          kty: plaidJwk.kty,
          crv: plaidJwk.crv,
          x: plaidJwk.x,
          y: plaidJwk.y,
        },
        plaidJwk.alg || 'ES256',
      );

      // Verify JWT signature
      const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: ['ES256'],
        clockTolerance: 60,
      });

      // Verify token freshness (within 5 minutes)
      const iat = payload.iat;
      if (!iat) {
        this.logger.warn('Webhook JWT missing iat claim');
        return false;
      }
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
      if (iat < fiveMinutesAgo) {
        this.logger.warn('Webhook JWT is older than 5 minutes');
        return false;
      }

      // Verify body hash
      const expectedHash = payload.request_body_sha256 as string;
      if (!expectedHash) {
        this.logger.warn('Webhook JWT missing request_body_sha256');
        return false;
      }

      const actualHash = createHash('sha256').update(body).digest('hex');
      if (actualHash !== expectedHash) {
        this.logger.warn('Webhook body hash mismatch');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Webhook verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Transaction Upsert
  // ---------------------------------------------------------------------------

  private async upsertTransaction(
    userId: string,
    accountId: string,
    tx: PlaidTransaction,
  ): Promise<void> {
    const [existing] = await this.db
      .select({
        id: schema.transactions.id,
        categorizationSource: schema.transactions.categorizationSource,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.plaidTransactionId, tx.transaction_id))
      .limit(1);

    if (existing) {
      // Preserve user/rule categorization
      const preserveCategory =
        existing.categorizationSource === 'user' ||
        existing.categorizationSource === 'rule';

      const updateData: Record<string, unknown> = {
        amount: tx.amount,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        description: tx.original_description ?? null,
        date: tx.date,
        authorizedDate: tx.authorized_date ?? null,
        pending: tx.pending,
        updatedAt: new Date(),
      };

      if (!preserveCategory && tx.personal_finance_category?.primary) {
        updateData.categorizationSource = 'plaid';
      }

      await this.db
        .update(schema.transactions)
        .set(updateData)
        .where(eq(schema.transactions.id, existing.id));
    } else {
      await this.db.insert(schema.transactions).values({
        userId,
        accountId,
        plaidTransactionId: tx.transaction_id,
        amount: tx.amount,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        description: tx.original_description ?? null,
        date: tx.date,
        authorizedDate: tx.authorized_date ?? null,
        pending: tx.pending,
        categorizationSource: tx.personal_finance_category?.primary
          ? 'plaid'
          : null,
        isManual: false,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Helpers
  // ---------------------------------------------------------------------------

  private async getItemById(itemId: string) {
    const [item] = await this.db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.id, itemId))
      .limit(1);

    if (!item) {
      throw new NotFoundException(`Plaid item ${itemId} not found`);
    }

    return item;
  }

  private async findItemByPlaidItemId(plaidItemId: string) {
    const [item] = await this.db
      .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.plaidItemId, plaidItemId))
      .limit(1);

    return item ?? null;
  }

  private async updateItemStatusOnError(
    itemId: string,
    error: unknown,
  ): Promise<void> {
    if (this.isPlaidError(error, 'ITEM_LOGIN_REQUIRED')) {
      await this.db
        .update(schema.plaidItems)
        .set({
          status: 'login_required',
          errorCode: 'ITEM_LOGIN_REQUIRED',
          updatedAt: new Date(),
        })
        .where(eq(schema.plaidItems.id, itemId));
    } else if (error instanceof AxiosError && error.response?.data) {
      const data = error.response.data as PlaidErrorData;
      if (data.error_code) {
        await this.db
          .update(schema.plaidItems)
          .set({
            status: 'error',
            errorCode: data.error_code,
            updatedAt: new Date(),
          })
          .where(eq(schema.plaidItems.id, itemId));
      }
    }
  }

  private isPlaidError(error: unknown, errorCode: string): boolean {
    if (error instanceof AxiosError && error.response?.data) {
      const data = error.response.data as PlaidErrorData;
      return data.error_code === errorCode;
    }
    return false;
  }

  private handlePlaidError(error: unknown, context: string): Error {
    if (error instanceof AxiosError && error.response?.data) {
      const data = error.response.data as PlaidErrorData;
      const code = data.error_code ?? 'UNKNOWN';
      const message =
        data.display_message || data.error_message || 'Unknown Plaid error';

      this.logger.error(
        `Plaid API error in ${context}: [${data.error_type}/${code}] ${message}`,
      );

      // Map specific Plaid errors to appropriate HTTP exceptions
      switch (code) {
        case 'ITEM_LOGIN_REQUIRED':
          return new BadRequestException(
            'Bank login credentials need to be updated. Please re-link your account.',
          );
        case 'INVALID_INPUT':
        case 'INVALID_REQUEST':
        case 'INVALID_RESULT':
          return new BadRequestException(message);
        case 'RATE_LIMIT_EXCEEDED':
          return new BadRequestException(
            'Too many requests. Please try again in a few minutes.',
          );
        case 'INSTITUTION_NOT_RESPONDING':
        case 'INSTITUTION_DOWN':
          return new BadRequestException(
            'Your bank is temporarily unavailable. Please try again later.',
          );
        default:
          return new InternalServerErrorException(
            `Bank connection error: ${message}`,
          );
      }
    }

    // Re-throw NestJS HTTP exceptions as-is
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException
    ) {
      return error;
    }

    this.logger.error(
      `Unexpected error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new InternalServerErrorException('An unexpected error occurred');
  }

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
