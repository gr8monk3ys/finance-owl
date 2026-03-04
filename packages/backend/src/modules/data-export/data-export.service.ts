import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { EmailService } from '../email/email.service';
import { dataExportRequests } from '../privacy/privacy.schema';
import { users } from '../../database/schema/users';
import { accounts, plaidItems } from '../../database/schema/accounts';
import { transactions } from '../../database/schema/transactions';
import { budgets, budgetPeriods, recurringTransactions } from '../../database/schema/budgets';
import { savingsGoals, savingsContributions } from '../savings-goals/savings-goals.schema';
import { notificationPreferences } from '../notifications/notification-preferences.schema';
import { auditLog, userPreferences, notifications } from '../../database/schema/audit';
import { financialHealthScores } from '../financial-health/financial-health.schema';
import * as crypto from 'crypto';

export interface ExportData {
  exportedAt: string;
  format: 'json' | 'csv';
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
  preferences: Record<string, unknown> | null;
  accounts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  budgets: Array<Record<string, unknown>>;
  budgetPeriods: Array<Record<string, unknown>>;
  recurringTransactions: Array<Record<string, unknown>>;
  savingsGoals: Array<Record<string, unknown>>;
  savingsContributions: Array<Record<string, unknown>>;
  notificationPreferences: Record<string, unknown> | null;
  notifications: Array<Record<string, unknown>>;
  financialHealthScores: Array<Record<string, unknown>>;
  auditLog: Array<Record<string, unknown>>;
}

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  /** In-memory store for completed exports. Key = download token, value = { data, expiresAt } */
  private exportStore = new Map<
    string,
    { data: string; contentType: string; filename: string; expiresAt: number }
  >();

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private emailService: EmailService,
  ) {}

  /**
   * Request a data export. Creates a record in data_export_requests,
   * generates the export, stores it temporarily, and sends an email.
   */
  async requestExport(
    userId: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ id: string; status: string }> {
    // Check for any in-progress export
    const [existing] = await this.db
      .select()
      .from(dataExportRequests)
      .where(
        and(
          eq(dataExportRequests.userId, userId),
          eq(dataExportRequests.status, 'processing'),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException('An export is already in progress');
    }

    // Create the export request record
    const [request] = await this.db
      .insert(dataExportRequests)
      .values({
        userId,
        format,
        status: 'processing',
      })
      .returning();

    // Generate the export asynchronously (but we await it here for simplicity)
    try {
      const exportData = await this.gatherUserData(userId, format);
      const downloadToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

      if (format === 'json') {
        const jsonStr = JSON.stringify(exportData, null, 2);
        this.exportStore.set(downloadToken, {
          data: jsonStr,
          contentType: 'application/json',
          filename: `finance-owl-export-${new Date().toISOString().split('T')[0]}.json`,
          expiresAt,
        });
      } else {
        const csvContent = this.convertToCsv(exportData);
        this.exportStore.set(downloadToken, {
          data: csvContent,
          contentType: 'text/csv',
          filename: `finance-owl-export-${new Date().toISOString().split('T')[0]}.csv`,
          expiresAt,
        });
      }

      // Update the export request with download URL and completion time
      const expiresAtStr = new Date(expiresAt).toISOString();
      await this.db
        .update(dataExportRequests)
        .set({
          status: 'completed',
          downloadUrl: downloadToken,
          expiresAt: expiresAtStr,
          completedAt: new Date().toISOString(),
        })
        .where(eq(dataExportRequests.id, request.id));

      // Send email notification
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        await this.emailService.sendEmail(
          user.email,
          'Your FinanceOwl Data Export is Ready',
          `<h2>Your Data Export is Ready</h2>
          <p>Your ${format.toUpperCase()} data export has been generated successfully.</p>
          <p>You can download it from your <a href="http://localhost:3000/settings/data">Settings > Data page</a>.</p>
          <p><strong>Important:</strong> This download link will expire in 30 minutes.</p>
          <p>If you did not request this export, please contact support immediately.</p>`,
          `Your FinanceOwl data export is ready. Visit Settings > Data to download it. The link expires in 30 minutes.`,
        );
      }

      this.logger.log(
        `Data export completed for user ${userId} (format: ${format})`,
      );

      return { id: request.id, status: 'completed' };
    } catch (error) {
      // Mark as failed
      await this.db
        .update(dataExportRequests)
        .set({ status: 'expired' })
        .where(eq(dataExportRequests.id, request.id));

      this.logger.error(
        `Failed to generate export for user ${userId}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get the status of the user's latest export request.
   */
  async getExportStatus(userId: string) {
    const [latest] = await this.db
      .select()
      .from(dataExportRequests)
      .where(eq(dataExportRequests.userId, userId))
      .orderBy(desc(dataExportRequests.createdAt))
      .limit(1);

    if (!latest) {
      return { status: 'none' };
    }

    // Check if the download has expired
    if (
      latest.status === 'completed' &&
      latest.expiresAt &&
      new Date(latest.expiresAt).getTime() < Date.now()
    ) {
      // Clean up expired token
      if (latest.downloadUrl) {
        this.exportStore.delete(latest.downloadUrl);
      }
      await this.db
        .update(dataExportRequests)
        .set({ status: 'expired' })
        .where(eq(dataExportRequests.id, latest.id));

      return { ...latest, status: 'expired', downloadUrl: null };
    }

    return latest;
  }

  /**
   * Download the export using the time-limited token.
   */
  getExportDownload(token: string): {
    data: string;
    contentType: string;
    filename: string;
  } | null {
    const entry = this.exportStore.get(token);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.exportStore.delete(token);
      return null;
    }

    return {
      data: entry.data,
      contentType: entry.contentType,
      filename: entry.filename,
    };
  }

  /**
   * Gather all user data for export.
   */
  async gatherUserData(
    userId: string,
    format: 'json' | 'csv',
  ): Promise<ExportData> {
    // 1. User profile
    const [userRecord] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      throw new NotFoundException('User not found');
    }

    // 2. User preferences
    const [prefs] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    // 3. Accounts (with masked account numbers)
    const userAccounts = await this.db
      .select({
        id: accounts.id,
        name: accounts.name,
        officialName: accounts.officialName,
        type: accounts.type,
        subtype: accounts.subtype,
        institutionName: accounts.institutionName,
        mask: accounts.mask,
        currentBalance: accounts.currentBalance,
        availableBalance: accounts.availableBalance,
        creditLimit: accounts.creditLimit,
        currency: accounts.currency,
        isManual: accounts.isManual,
        isHidden: accounts.isHidden,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    // Mask account details - keep only last 4 digits in mask field
    const maskedAccounts = userAccounts.map((acct) => ({
      ...acct,
      mask: acct.mask ? `****${acct.mask}` : null,
    }));

    // 4. All transactions
    const userTransactions = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));

    // 5. Budgets and budget periods
    const userBudgets = await this.db
      .select()
      .from(budgets)
      .where(eq(budgets.userId, userId));

    const budgetIds = userBudgets.map((b) => b.id);
    const userBudgetPeriods: Array<Record<string, unknown>> = [];
    if (budgetIds.length > 0) {
      for (const budgetId of budgetIds) {
        const periods = await this.db
          .select()
          .from(budgetPeriods)
          .where(eq(budgetPeriods.budgetId, budgetId));
        userBudgetPeriods.push(...periods);
      }
    }

    // 6. Recurring transactions
    const userRecurring = await this.db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.userId, userId));

    // 7. Savings goals and contributions
    const userSavingsGoals = await this.db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId));

    const userContributions: Array<Record<string, unknown>> = [];
    for (const goal of userSavingsGoals) {
      const contribs = await this.db
        .select()
        .from(savingsContributions)
        .where(eq(savingsContributions.goalId, goal.id));
      userContributions.push(...contribs);
    }

    // 8. Notification preferences
    const [notifPrefs] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // 9. Notifications
    const userNotifications = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    // 10. Financial health scores
    const healthScores = await this.db
      .select()
      .from(financialHealthScores)
      .where(eq(financialHealthScores.userId, userId))
      .orderBy(desc(financialHealthScores.createdAt));

    // 11. Audit log (user's own entries)
    const userAuditLog = await this.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt));

    return {
      exportedAt: new Date().toISOString(),
      format,
      user: userRecord,
      preferences: prefs || null,
      accounts: maskedAccounts,
      transactions: userTransactions,
      budgets: userBudgets,
      budgetPeriods: userBudgetPeriods,
      recurringTransactions: userRecurring,
      savingsGoals: userSavingsGoals,
      savingsContributions: userContributions,
      notificationPreferences: notifPrefs || null,
      notifications: userNotifications,
      financialHealthScores: healthScores,
      auditLog: userAuditLog,
    };
  }

  /**
   * Convert export data to CSV format.
   * Creates a multi-section CSV with headers for each data category.
   */
  convertToCsv(data: ExportData): string {
    const sections: string[] = [];

    sections.push(`# FinanceOwl Data Export`);
    sections.push(`# Exported At: ${data.exportedAt}`);
    sections.push(`# Format: CSV`);
    sections.push('');

    // User profile
    sections.push('## User Profile');
    sections.push('id,email,name,createdAt,updatedAt');
    sections.push(
      this.csvRow([
        data.user.id,
        data.user.email,
        data.user.name,
        String(data.user.createdAt),
        String(data.user.updatedAt),
      ]),
    );
    sections.push('');

    // Accounts
    if (data.accounts.length > 0) {
      sections.push('## Accounts');
      const accountKeys = Object.keys(data.accounts[0]);
      sections.push(accountKeys.join(','));
      for (const acct of data.accounts) {
        sections.push(this.csvRow(accountKeys.map((k) => String(acct[k] ?? ''))));
      }
      sections.push('');
    }

    // Transactions
    if (data.transactions.length > 0) {
      sections.push('## Transactions');
      const txKeys = Object.keys(data.transactions[0]);
      sections.push(txKeys.join(','));
      for (const tx of data.transactions) {
        sections.push(this.csvRow(txKeys.map((k) => String(tx[k] ?? ''))));
      }
      sections.push('');
    }

    // Budgets
    if (data.budgets.length > 0) {
      sections.push('## Budgets');
      const budgetKeys = Object.keys(data.budgets[0]);
      sections.push(budgetKeys.join(','));
      for (const b of data.budgets) {
        sections.push(this.csvRow(budgetKeys.map((k) => String(b[k] ?? ''))));
      }
      sections.push('');
    }

    // Savings Goals
    if (data.savingsGoals.length > 0) {
      sections.push('## Savings Goals');
      const goalKeys = Object.keys(data.savingsGoals[0]);
      sections.push(goalKeys.join(','));
      for (const g of data.savingsGoals) {
        sections.push(this.csvRow(goalKeys.map((k) => String(g[k] ?? ''))));
      }
      sections.push('');
    }

    // Financial Health Scores
    if (data.financialHealthScores.length > 0) {
      sections.push('## Financial Health Scores');
      const scoreKeys = Object.keys(data.financialHealthScores[0]);
      sections.push(scoreKeys.join(','));
      for (const s of data.financialHealthScores) {
        sections.push(this.csvRow(scoreKeys.map((k) => String(s[k] ?? ''))));
      }
      sections.push('');
    }

    // Audit Log
    if (data.auditLog.length > 0) {
      sections.push('## Audit Log');
      const auditKeys = Object.keys(data.auditLog[0]);
      sections.push(auditKeys.join(','));
      for (const entry of data.auditLog) {
        sections.push(this.csvRow(auditKeys.map((k) => String(entry[k] ?? ''))));
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private csvRow(values: string[]): string {
    return values
      .map((v) => {
        const escaped = v.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
          ? `"${escaped}"`
          : escaped;
      })
      .join(',');
  }

  /**
   * Periodically clean expired exports from memory.
   */
  cleanExpiredExports(): number {
    let cleaned = 0;
    const now = Date.now();
    for (const [token, entry] of this.exportStore) {
      if (entry.expiresAt < now) {
        this.exportStore.delete(token);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired export(s)`);
    }
    return cleaned;
  }
}
