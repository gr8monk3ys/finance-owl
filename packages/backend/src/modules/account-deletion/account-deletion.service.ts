import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { EmailService } from '../email/email.service';
import { BankSyncService } from '../bank-sync/bank-sync.service';
import { BillingService } from '../billing/billing.service';
import { dataDeletionRequests } from './account-deletion.schema';
import { users, sessions, webauthnCredentials } from '../../database/schema/users';
import { accounts, plaidItems } from '../../database/schema/accounts';
import { transactions, transactionSplits } from '../../database/schema/transactions';
import {
  budgets,
  budgetPeriods,
  budgetAlerts,
  recurringTransactions,
} from '../../database/schema/budgets';
import { savingsGoals, savingsContributions } from '../savings-goals/savings-goals.schema';
import { notificationPreferences } from '../notifications/notification-preferences.schema';
import {
  auditLog,
  userPreferences,
  notifications,
  netWorthHistory,
} from '../../database/schema/audit';
import {
  billingCustomers,
  userSubscriptions,
  invoices,
  usageTracking,
} from '../billing/billing.schema';
import {
  categories,
  categorizationRules,
  categorizationCorrections,
} from '../../database/schema/categories';

/** Grace period before actual deletion: 14 days. */
const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

export interface DeletionStatus {
  status: 'none' | 'pending_deletion' | 'cancelled' | 'processing' | 'completed';
  scheduledAt?: string | null;
  requestedAt?: string | null;
  daysRemaining?: number;
}

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private emailService: EmailService,
    private configService: ConfigService,
    private bankSyncService: BankSyncService,
    private billingService: BillingService,
  ) {}

  /**
   * Request account deletion. Starts a 14-day grace period.
   */
  async requestDeletion(userId: string, reason?: string): Promise<DeletionStatus> {
    // Check for existing pending deletion
    const [existing] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(
        and(eq(dataDeletionRequests.userId, userId), eq(dataDeletionRequests.status, 'pending')),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('A deletion request is already pending for this account');
    }

    // Verify user exists
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const scheduledAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();

    const [request] = await this.db
      .insert(dataDeletionRequests)
      .values({
        userId,
        reason,
        status: 'pending',
        scheduledAt,
      })
      .returning();

    // Send confirmation email
    await this.emailService.sendEmail(
      user.email,
      'Account Deletion Requested - FinanceOwl',
      `<h2>Account Deletion Requested</h2>
      <p>We've received your request to delete your FinanceOwl account.</p>
      <p>Your account and all associated data will be permanently deleted on <strong>${new Date(scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.</p>
      <p>During the 14-day grace period, you can cancel this request at any time from your <a href="${this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')}/settings/data">Settings > Data page</a>.</p>
      <h3>What will be deleted:</h3>
      <ul>
        <li>Your user profile and login credentials</li>
        <li>All linked bank accounts and Plaid connections</li>
        <li>All transaction history</li>
        <li>Budgets, savings goals, and financial data</li>
        <li>Notification preferences and history</li>
        <li>Subscription and billing information</li>
      </ul>
      <p>If you did not request this, please log in and cancel the deletion immediately, then change your password.</p>`,
      `Account Deletion Requested\n\nYour FinanceOwl account will be permanently deleted on ${new Date(scheduledAt).toLocaleDateString()}.\n\nYou can cancel this request within 14 days from Settings > Data.`,
    );

    this.logger.log(`Account deletion requested for user ${userId}, scheduled for ${scheduledAt}`);

    const daysRemaining = Math.ceil(
      (new Date(scheduledAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );

    return {
      status: 'pending_deletion',
      scheduledAt,
      requestedAt: request.createdAt.toISOString(),
      daysRemaining,
    };
  }

  /**
   * Cancel a pending deletion during the grace period.
   */
  async cancelDeletion(userId: string): Promise<DeletionStatus> {
    const [pending] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(
        and(eq(dataDeletionRequests.userId, userId), eq(dataDeletionRequests.status, 'pending')),
      )
      .orderBy(desc(dataDeletionRequests.createdAt))
      .limit(1);

    if (!pending) {
      throw new NotFoundException('No pending deletion request found');
    }

    // Verify still within grace period
    if (pending.scheduledAt && new Date(pending.scheduledAt).getTime() < Date.now()) {
      throw new BadRequestException('The grace period has expired and deletion is being processed');
    }

    await this.db
      .update(dataDeletionRequests)
      .set({
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      })
      .where(eq(dataDeletionRequests.id, pending.id));

    // Send confirmation email
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (user) {
      await this.emailService.sendEmail(
        user.email,
        'Account Deletion Cancelled - FinanceOwl',
        `<h2>Deletion Cancelled</h2>
        <p>Your account deletion request has been successfully cancelled. Your account and all data remain intact.</p>
        <p>If you did not cancel this request, please change your password immediately.</p>`,
        `Your FinanceOwl account deletion has been cancelled. Your data is safe.`,
      );
    }

    this.logger.log(`Account deletion cancelled for user ${userId}`);

    return { status: 'cancelled' };
  }

  /**
   * Execute the actual deletion after the grace period has passed.
   * This removes all user data from the system.
   */
  async executeDeletion(userId: string): Promise<void> {
    const [pending] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(
        and(eq(dataDeletionRequests.userId, userId), eq(dataDeletionRequests.status, 'pending')),
      )
      .orderBy(desc(dataDeletionRequests.createdAt))
      .limit(1);

    if (!pending) {
      throw new NotFoundException('No pending deletion request found');
    }

    // Verify grace period has passed
    if (pending.scheduledAt && new Date(pending.scheduledAt).getTime() > Date.now()) {
      throw new BadRequestException('Grace period has not yet expired');
    }

    // Mark as processing
    await this.db
      .update(dataDeletionRequests)
      .set({ status: 'processing' })
      .where(eq(dataDeletionRequests.id, pending.id));

    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);

    const userEmail = user?.email;

    this.logger.log(`Executing account deletion for user ${userId}`);

    try {
      // 1. Revoke all Plaid access tokens via BankSyncService
      const plaidItemsToRevoke = await this.db
        .select()
        .from(plaidItems)
        .where(eq(plaidItems.userId, userId));

      for (const item of plaidItemsToRevoke) {
        try {
          this.logger.log(`Revoking Plaid access token for item ${item.plaidItemId}`);
          await this.bankSyncService.unlinkItem(userId, item.id);
          this.logger.log(`Successfully revoked Plaid item ${item.plaidItemId}`);
        } catch (error) {
          this.logger.warn(
            `Failed to revoke Plaid item ${item.plaidItemId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // 2. Cancel Stripe subscription via BillingService
      const [subscription] = await this.db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);

      if (subscription?.stripeSubscriptionId) {
        try {
          this.logger.log(`Cancelling Stripe subscription ${subscription.stripeSubscriptionId}`);
          await this.billingService.cancelSubscription(userId, false);
          this.logger.log(
            `Successfully cancelled Stripe subscription ${subscription.stripeSubscriptionId}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // 3. Delete all user data atomically within a transaction
      await this.db.transaction(async (tx) => {
        // Transaction splits (depend on transactions)
        const userTxns = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.userId, userId));

        for (const t of userTxns) {
          await tx.delete(transactionSplits).where(eq(transactionSplits.transactionId, t.id));
        }

        // Savings contributions (depend on savings goals)
        const userGoals = await tx
          .select({ id: savingsGoals.id })
          .from(savingsGoals)
          .where(eq(savingsGoals.userId, userId));

        for (const goal of userGoals) {
          await tx.delete(savingsContributions).where(eq(savingsContributions.goalId, goal.id));
        }

        // Budget alerts and periods (depend on budgets)
        const userBudgets = await tx
          .select({ id: budgets.id })
          .from(budgets)
          .where(eq(budgets.userId, userId));

        for (const budget of userBudgets) {
          await tx.delete(budgetAlerts).where(eq(budgetAlerts.budgetId, budget.id));
          await tx.delete(budgetPeriods).where(eq(budgetPeriods.budgetId, budget.id));
        }

        // Now delete the main tables
        await tx.delete(transactions).where(eq(transactions.userId, userId));
        await tx.delete(accounts).where(eq(accounts.userId, userId));
        await tx.delete(plaidItems).where(eq(plaidItems.userId, userId));
        await tx.delete(budgets).where(eq(budgets.userId, userId));
        await tx.delete(recurringTransactions).where(eq(recurringTransactions.userId, userId));
        await tx.delete(savingsGoals).where(eq(savingsGoals.userId, userId));
        await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
        await tx.delete(notifications).where(eq(notifications.userId, userId));
        await tx.delete(netWorthHistory).where(eq(netWorthHistory.userId, userId));
        await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
        await tx.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
        await tx.delete(billingCustomers).where(eq(billingCustomers.userId, userId));
        await tx.delete(invoices).where(eq(invoices.userId, userId));
        await tx.delete(usageTracking).where(eq(usageTracking.userId, userId));
        await tx.delete(categorizationRules).where(eq(categorizationRules.userId, userId));
        await tx
          .delete(categorizationCorrections)
          .where(eq(categorizationCorrections.userId, userId));
        await tx.delete(budgetAlerts).where(eq(budgetAlerts.userId, userId));

        // 4. Anonymize audit logs (keep for compliance but remove PII)
        await tx
          .update(auditLog)
          .set({
            userId: null,
            ipAddress: null,
            details: JSON.stringify({ anonymized: true, reason: 'account_deletion' }),
          })
          .where(eq(auditLog.userId, userId));

        // 5. Delete sessions and webauthn credentials
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));

        // 6. Delete the deletion request itself
        await tx.delete(dataDeletionRequests).where(eq(dataDeletionRequests.userId, userId));

        // 7. Delete user record (last, since other tables reference it)
        await tx.delete(users).where(eq(users.id, userId));
      });

      // 8. Send final confirmation email (outside transaction — email is not rollback-able)
      if (userEmail) {
        await this.emailService.sendEmail(
          userEmail,
          'Account Deleted - FinanceOwl',
          `<h2>Your Account Has Been Deleted</h2>
          <p>Your FinanceOwl account and all associated data have been permanently deleted.</p>
          <p>If you ever wish to use FinanceOwl again, you're welcome to create a new account at any time.</p>
          <p>Thank you for having been a FinanceOwl user.</p>`,
          `Your FinanceOwl account has been permanently deleted. All your data has been removed.`,
        );
      }

      this.logger.log(`Account deletion completed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to execute deletion for user ${userId}: ${error}`);

      // Revert status to pending so it can be retried
      await this.db
        .update(dataDeletionRequests)
        .set({ status: 'pending' })
        .where(eq(dataDeletionRequests.id, pending.id));

      throw error;
    }
  }

  /**
   * Get the current deletion status for a user.
   */
  async getDeletionStatus(userId: string): Promise<DeletionStatus> {
    const [latest] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.userId, userId))
      .orderBy(desc(dataDeletionRequests.createdAt))
      .limit(1);

    if (!latest || latest.status === 'completed') {
      return { status: 'none' };
    }

    if (latest.status === 'pending') {
      const daysRemaining = latest.scheduledAt
        ? Math.max(
            0,
            Math.ceil(
              (new Date(latest.scheduledAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
            ),
          )
        : 0;

      return {
        status: 'pending_deletion',
        scheduledAt: latest.scheduledAt,
        requestedAt: latest.createdAt.toISOString(),
        daysRemaining,
      };
    }

    return {
      status: latest.status as DeletionStatus['status'],
      scheduledAt: latest.scheduledAt,
      requestedAt: latest.createdAt.toISOString(),
    };
  }
}
