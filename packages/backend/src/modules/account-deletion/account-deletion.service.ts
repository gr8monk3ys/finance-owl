import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { EmailService } from '../email/email.service';
import { dataDeletionRequests } from '../privacy/privacy.schema';
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
import { financialHealthScores, financialHealthGoals, financialHealthAlerts } from '../financial-health/financial-health.schema';
import { billingCustomers, userSubscriptions, invoices, usageTracking } from '../billing/billing.schema';
import { privacyConsents, dataExportRequests } from '../privacy/privacy.schema';
import { categories, categorizationRules, categorizationCorrections } from '../../database/schema/categories';

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
  ) {}

  /**
   * Request account deletion. Starts a 14-day grace period.
   */
  async requestDeletion(
    userId: string,
    reason?: string,
  ): Promise<DeletionStatus> {
    // Check for existing pending deletion
    const [existing] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(
        and(
          eq(dataDeletionRequests.userId, userId),
          eq(dataDeletionRequests.status, 'pending'),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'A deletion request is already pending for this account',
      );
    }

    // Verify user exists
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

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
      <p>During the 14-day grace period, you can cancel this request at any time from your <a href="http://localhost:3000/settings/data">Settings > Data page</a>.</p>
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

    this.logger.log(
      `Account deletion requested for user ${userId}, scheduled for ${scheduledAt}`,
    );

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
        and(
          eq(dataDeletionRequests.userId, userId),
          eq(dataDeletionRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(dataDeletionRequests.createdAt))
      .limit(1);

    if (!pending) {
      throw new NotFoundException('No pending deletion request found');
    }

    // Verify still within grace period
    if (pending.scheduledAt && new Date(pending.scheduledAt).getTime() < Date.now()) {
      throw new BadRequestException(
        'The grace period has expired and deletion is being processed',
      );
    }

    await this.db
      .update(dataDeletionRequests)
      .set({
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      .where(eq(dataDeletionRequests.id, pending.id));

    // Send confirmation email
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

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
        and(
          eq(dataDeletionRequests.userId, userId),
          eq(dataDeletionRequests.status, 'pending'),
        ),
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

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userEmail = user?.email;

    this.logger.log(`Executing account deletion for user ${userId}`);

    try {
      // 1. Revoke all Plaid access tokens (log them, actual API call would happen here)
      const plaidItemsToRevoke = await this.db
        .select()
        .from(plaidItems)
        .where(eq(plaidItems.userId, userId));

      for (const item of plaidItemsToRevoke) {
        this.logger.log(
          `Revoking Plaid access token for item ${item.plaidItemId}`,
        );
        // In production: await plaidClient.itemRemove({ access_token: decryptedToken });
      }

      // 2. Cancel Stripe subscription (log it, actual API call would happen here)
      const [subscription] = await this.db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);

      if (subscription?.stripeSubscriptionId) {
        this.logger.log(
          `Cancelling Stripe subscription ${subscription.stripeSubscriptionId}`,
        );
        // In production: await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      }

      // 3. Delete all user data in correct order (respecting foreign keys)
      // Transaction splits (depend on transactions)
      const userTxns = await this.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.userId, userId));

      for (const tx of userTxns) {
        await this.db
          .delete(transactionSplits)
          .where(eq(transactionSplits.transactionId, tx.id));
      }

      // Savings contributions (depend on savings goals)
      const userGoals = await this.db
        .select({ id: savingsGoals.id })
        .from(savingsGoals)
        .where(eq(savingsGoals.userId, userId));

      for (const goal of userGoals) {
        await this.db
          .delete(savingsContributions)
          .where(eq(savingsContributions.goalId, goal.id));
      }

      // Budget alerts and periods (depend on budgets)
      const userBudgets = await this.db
        .select({ id: budgets.id })
        .from(budgets)
        .where(eq(budgets.userId, userId));

      for (const budget of userBudgets) {
        await this.db
          .delete(budgetAlerts)
          .where(eq(budgetAlerts.budgetId, budget.id));
        await this.db
          .delete(budgetPeriods)
          .where(eq(budgetPeriods.budgetId, budget.id));
      }

      // Now delete the main tables
      await this.db.delete(transactions).where(eq(transactions.userId, userId));
      await this.db.delete(accounts).where(eq(accounts.userId, userId));
      await this.db.delete(plaidItems).where(eq(plaidItems.userId, userId));
      await this.db.delete(budgets).where(eq(budgets.userId, userId));
      await this.db.delete(recurringTransactions).where(eq(recurringTransactions.userId, userId));
      await this.db.delete(savingsGoals).where(eq(savingsGoals.userId, userId));
      await this.db.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      await this.db.delete(notifications).where(eq(notifications.userId, userId));
      await this.db.delete(netWorthHistory).where(eq(netWorthHistory.userId, userId));
      await this.db.delete(financialHealthScores).where(eq(financialHealthScores.userId, userId));
      await this.db.delete(financialHealthGoals).where(eq(financialHealthGoals.userId, userId));
      await this.db.delete(financialHealthAlerts).where(eq(financialHealthAlerts.userId, userId));
      await this.db.delete(userPreferences).where(eq(userPreferences.userId, userId));
      await this.db.delete(privacyConsents).where(eq(privacyConsents.userId, userId));
      await this.db.delete(dataExportRequests).where(eq(dataExportRequests.userId, userId));
      await this.db.delete(userSubscriptions).where(eq(userSubscriptions.userId, userId));
      await this.db.delete(billingCustomers).where(eq(billingCustomers.userId, userId));
      await this.db.delete(invoices).where(eq(invoices.userId, userId));
      await this.db.delete(usageTracking).where(eq(usageTracking.userId, userId));
      await this.db.delete(categorizationRules).where(eq(categorizationRules.userId, userId));
      await this.db.delete(categorizationCorrections).where(eq(categorizationCorrections.userId, userId));
      await this.db.delete(budgetAlerts).where(eq(budgetAlerts.userId, userId));

      // 4. Anonymize audit logs (keep for compliance but remove PII)
      await this.db
        .update(auditLog)
        .set({
          userId: null,
          ipAddress: null,
          details: JSON.stringify({ anonymized: true, reason: 'account_deletion' }),
        })
        .where(eq(auditLog.userId, userId));

      // 5. Delete sessions and webauthn credentials
      await this.db.delete(sessions).where(eq(sessions.userId, userId));
      await this.db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));

      // 6. Delete the deletion request itself
      await this.db
        .delete(dataDeletionRequests)
        .where(eq(dataDeletionRequests.userId, userId));

      // 7. Delete user record (last, since other tables reference it)
      await this.db.delete(users).where(eq(users.id, userId));

      // 8. Send final confirmation email
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
      this.logger.error(
        `Failed to execute deletion for user ${userId}: ${error}`,
      );

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
              (new Date(latest.scheduledAt).getTime() - Date.now()) /
                (24 * 60 * 60 * 1000),
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
