import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { emailQueue } from './email-queue.schema';
import {
  billReminderHtml,
  billReminderText,
  type BillReminderData,
  budgetAlertHtml,
  budgetAlertText,
  type BudgetAlertData,
  weeklyDigestHtml,
  weeklyDigestText,
  type WeeklyDigestData,
  anomalyAlertHtml,
  anomalyAlertText,
  type AnomalyAlertData,
  securityAlertHtml,
  securityAlertText,
  type SecurityAlertData,
  welcomeHtml,
  welcomeText,
  type WelcomeData,
} from './templates';

// ── Queue Types ──────────────────────────────────────────────────────

interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  createdAt: number;
}

// ── Service ──────────────────────────────────────────────────────────

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;
  private readonly appUrl: string;
  private readonly settingsUrl: string;

  /** In-memory retry queue */
  private readonly queue: Map<string, QueuedEmail> = new Map();
  private queueTimer: ReturnType<typeof setInterval> | null = null;

  /** How often to drain the retry queue (ms) */
  private static readonly QUEUE_INTERVAL_MS = 10_000;

  /** Maximum retry attempts per email */
  static readonly MAX_ATTEMPTS = 3;

  /** Base delay for exponential backoff (ms) */
  private static readonly BASE_DELAY_MS = 5_000;

  /** Counter for queue IDs */
  private idCounter = 0;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
  ) {
    this.fromAddress = this.configService.get<string>(
      'SMTP_FROM',
      'FinanceOwl <noreply@financeowl.app>',
    );
    this.appUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    this.settingsUrl = `${this.appUrl}/settings/notifications`;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  onModuleInit() {
    this.initTransport();

    // Start queue processor
    this.queueTimer = setInterval(() => this.processQueue(), EmailService.QUEUE_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }

    if (this.queue.size > 0) {
      this.logger.warn(`Module destroying with ${this.queue.size} unsent email(s) in queue`);
    }
  }

  // ── Public status check ──────────────────────────────────────────────

  /**
   * Returns `true` if SMTP is configured and the email transport is
   * available. Other services can use this to check before attempting
   * email delivery.
   */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  // ── Transport initialisation ───────────────────────────────────────

  private initTransport() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      this.logger.warn(
        'SMTP_HOST not configured -- email sending disabled. ' +
          'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars to enable.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`Email transport initialised (${host}:${port})`);
  }

  // ── Core send method ───────────────────────────────────────────────

  /**
   * Send a single email. Returns `true` if sent (or queued for retry
   * when queue is available), `false` if SMTP is not configured.
   *
   * On transient failure the email is placed in an in-memory retry
   * queue with up to 3 attempts using exponential backoff.
   */
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Email not sent (SMTP not configured): ${subject} to ${to}`);

      // Persist to the email_queue table so it can be sent later
      try {
        await this.db.insert(emailQueue).values({
          to,
          subject,
          body: html,
          status: 'pending',
        });
        this.logger.debug(`Unsent email queued in database: "${subject}" -> ${to}`);
      } catch (err) {
        this.logger.error(`Failed to queue unsent email to database: ${err}`);
      }

      return false;
    }

    const plainText = text ?? this.stripHtml(html);

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
        text: plainText,
      });

      this.logger.log(`Email sent: "${subject}" -> ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email "${subject}" to ${to}: ${error}`);

      // Enqueue for retry
      this.enqueue(to, subject, html, plainText);
      return true; // Queued, will be retried
    }
  }

  // ── In-memory retry queue ──────────────────────────────────────────

  private enqueue(to: string, subject: string, html: string, text: string): void {
    const id = `eq-${++this.idCounter}-${Date.now()}`;
    const entry: QueuedEmail = {
      id,
      to,
      subject,
      html,
      text,
      attempts: 1, // Already attempted once
      maxAttempts: EmailService.MAX_ATTEMPTS,
      nextRetryAt: Date.now() + EmailService.BASE_DELAY_MS,
      createdAt: Date.now(),
    };

    this.queue.set(id, entry);
    this.logger.debug(
      `Email queued for retry: id=${id} subject="${subject}" to=${to} (attempt 1/${EmailService.MAX_ATTEMPTS})`,
    );
  }

  /**
   * Process all items in the retry queue whose retry time has passed.
   * Runs on a fixed interval.
   */
  private async processQueue(): Promise<void> {
    if (this.queue.size === 0) return;
    if (!this.transporter) {
      // Transport disappeared (shouldn't normally happen)
      this.queue.clear();
      return;
    }

    const now = Date.now();

    for (const [id, entry] of this.queue) {
      if (entry.nextRetryAt > now) continue;

      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to: entry.to,
          subject: entry.subject,
          html: entry.html,
          text: entry.text,
        });

        this.queue.delete(id);
        this.logger.log(
          `Email sent on retry (attempt ${entry.attempts + 1}): "${entry.subject}" -> ${entry.to}`,
        );
      } catch (error) {
        entry.attempts += 1;

        if (entry.attempts >= entry.maxAttempts) {
          this.queue.delete(id);
          this.logger.error(
            `Email permanently failed after ${entry.attempts} attempts: "${entry.subject}" -> ${entry.to}: ${error}`,
          );
        } else {
          // Exponential backoff: BASE * 2^(attempt-1)
          const delay = EmailService.BASE_DELAY_MS * Math.pow(2, entry.attempts - 1);
          entry.nextRetryAt = Date.now() + delay;
          this.logger.warn(
            `Email retry ${entry.attempts}/${entry.maxAttempts} failed, next retry in ${Math.round(delay / 1000)}s: "${entry.subject}" -> ${entry.to}`,
          );
        }
      }
    }
  }

  // ── Queue inspection (for testing / monitoring) ────────────────────

  get queueSize(): number {
    return this.queue.size;
  }

  // ── Template-based send methods ────────────────────────────────────

  async sendBillReminder(
    to: string,
    data: Omit<BillReminderData, 'appUrl' | 'settingsUrl'>,
  ): Promise<boolean> {
    const templateData: BillReminderData = {
      ...data,
      appUrl: this.appUrl,
      settingsUrl: this.settingsUrl,
    };

    return this.sendEmail(
      to,
      `Upcoming Bill: ${data.billName} - ${formatCurrencySimple(data.amount)} due ${data.dueDate}`,
      billReminderHtml(templateData),
      billReminderText(templateData),
    );
  }

  async sendBudgetAlert(
    to: string,
    data: Omit<BudgetAlertData, 'appUrl' | 'settingsUrl'>,
  ): Promise<boolean> {
    const templateData: BudgetAlertData = {
      ...data,
      appUrl: this.appUrl,
      settingsUrl: this.settingsUrl,
    };

    const pct = Math.round(data.percentUsed);
    return this.sendEmail(
      to,
      `Budget Alert: ${data.budgetName} at ${pct}%`,
      budgetAlertHtml(templateData),
      budgetAlertText(templateData),
    );
  }

  async sendWeeklyDigest(
    to: string,
    data: Omit<WeeklyDigestData, 'appUrl' | 'settingsUrl'>,
  ): Promise<boolean> {
    const templateData: WeeklyDigestData = {
      ...data,
      appUrl: this.appUrl,
      settingsUrl: this.settingsUrl,
    };

    const net = data.totalIncome - data.totalExpenses;
    const sign = net >= 0 ? '+' : '-';
    return this.sendEmail(
      to,
      `FinanceOwl Weekly Summary - ${sign}${formatCurrencySimple(Math.abs(net))} net this week`,
      weeklyDigestHtml(templateData),
      weeklyDigestText(templateData),
    );
  }

  async sendAnomalyAlert(
    to: string,
    data: Omit<AnomalyAlertData, 'appUrl' | 'settingsUrl'>,
  ): Promise<boolean> {
    const templateData: AnomalyAlertData = {
      ...data,
      appUrl: this.appUrl,
      settingsUrl: this.settingsUrl,
    };

    return this.sendEmail(
      to,
      `Unusual Transaction: ${formatCurrencySimple(Math.abs(data.amount))} at ${data.merchantName}`,
      anomalyAlertHtml(templateData),
      anomalyAlertText(templateData),
    );
  }

  async sendSecurityAlert(
    to: string,
    data: Omit<SecurityAlertData, 'appUrl' | 'settingsUrl'>,
  ): Promise<boolean> {
    const templateData: SecurityAlertData = {
      ...data,
      appUrl: this.appUrl,
      settingsUrl: this.settingsUrl,
    };

    return this.sendEmail(
      to,
      `Security Alert: ${data.eventTitle}`,
      securityAlertHtml(templateData),
      securityAlertText(templateData),
    );
  }

  async sendWelcome(
    to: string,
    data: Omit<WelcomeData, 'appUrl' | 'settingsUrl'>,
  ): Promise<boolean> {
    const templateData: WelcomeData = {
      ...data,
      appUrl: this.appUrl,
      settingsUrl: this.settingsUrl,
    };

    return this.sendEmail(
      to,
      'Welcome to FinanceOwl!',
      welcomeHtml(templateData),
      welcomeText(templateData),
    );
  }

  // ── Private helpers ────────────────────────────────────────────────

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// ── Module-level utility ─────────────────────────────────────────────

function formatCurrencySimple(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
