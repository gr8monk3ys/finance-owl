import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreditBureauProvider,
  CreditScoreResult,
  CreditReport,
  CreditFactor,
  CreditAccount,
  DisputeInput,
  DisputeResult,
  DisputeStatus,
  MonitoringSetup,
} from './bureau.interface';
import { generateSimulatedScore, generateSimulatedReport, generateSimulatedFactors } from './simulated-data';

/**
 * Equifax Credit Bureau Provider
 *
 * Integrates with Equifax's Consumer Credit API.
 * Falls back to simulated data when EQUIFAX_API_KEY is not configured.
 */
@Injectable()
export class EquifaxProvider implements CreditBureauProvider {
  readonly name = 'equifax' as const;
  private readonly logger = new Logger(EquifaxProvider.name);
  private readonly apiKey: string | undefined;
  private readonly clientId: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('EQUIFAX_API_KEY');
    this.clientId = this.configService.get<string>('EQUIFAX_CLIENT_ID');
    this.baseUrl =
      this.configService.get<string>('EQUIFAX_API_URL') ||
      'https://api.equifax.com/business/consumer-credit/v2';

    if (this.isConfigured) {
      this.logger.log('Equifax provider initialized with API credentials');
    } else {
      this.logger.warn(
        'Equifax provider running in simulation mode — set EQUIFAX_API_KEY and EQUIFAX_CLIENT_ID to enable',
      );
    }
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.clientId);
  }

  async getCreditScore(userId: string, _ssn?: string): Promise<CreditScoreResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditScore for user ${userId}`);
      return generateSimulatedScore('equifax', userId);
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/consumers/credit-score', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      const creditScore = response.creditScore as Record<string, unknown> | undefined;
      return {
        score: (creditScore?.score || response.score) as number,
        model: this.mapScoreModel(creditScore?.modelType as string | undefined),
        range: { min: 300, max: 850 },
        factors: this.mapFactors((creditScore?.factors || []) as Record<string, unknown>[]),
        pulledAt: new Date(),
        bureau: 'equifax',
        isSimulated: false,
      };
    } catch (error) {
      this.logger.error(`Equifax getCreditScore failed: ${error}`);
      this.logger.warn('Falling back to simulated data');
      return generateSimulatedScore('equifax', userId);
    }
  }

  async getCreditReport(userId: string): Promise<CreditReport> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditReport for user ${userId}`);
      return generateSimulatedReport('equifax');
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/consumers/credit-report', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      return { ...this.mapReport(response), isSimulated: false };
    } catch (error) {
      this.logger.error(`Equifax getCreditReport failed: ${error}`);
      this.logger.warn('Falling back to simulated data');
      return generateSimulatedReport('equifax');
    }
  }

  async getCreditFactors(userId: string): Promise<CreditFactor[]> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditFactors for user ${userId}`);
      return generateSimulatedFactors();
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/consumers/credit-factors', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      return this.mapFactors((response.factors || []) as Record<string, unknown>[]);
    } catch (error) {
      this.logger.error(`Equifax getCreditFactors failed: ${error}`);
      return generateSimulatedFactors();
    }
  }

  async fileDispute(userId: string, disputeData: DisputeInput): Promise<DisputeResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] fileDispute for user ${userId}`);
      return {
        disputeId: `sim-eq-${Date.now()}`,
        bureau: 'equifax',
        status: 'submitted',
        filedAt: new Date(),
        estimatedResolutionDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString().split('T')[0],
        referenceNumber: `EQ-SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        isSimulated: true,
      };
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/disputes', {
        method: 'POST',
        body: {
          consumerId: userId,
          accountId: disputeData.accountId,
          disputeReason: disputeData.reason,
          explanation: disputeData.explanation,
          supportingDocuments: disputeData.supportingDocuments,
        },
        token,
      });

      return {
        disputeId: response.disputeId as string,
        bureau: 'equifax',
        status: (response.status || 'submitted') as DisputeResult['status'],
        filedAt: new Date((response.filedDate as string) || Date.now()),
        estimatedResolutionDate: (response.estimatedResolutionDate || '') as string,
        referenceNumber: (response.referenceNumber || '') as string,
        isSimulated: false,
      };
    } catch (error) {
      this.logger.error(`Equifax fileDispute failed: ${error}`);
      throw error;
    }
  }

  async getDisputeStatus(disputeId: string): Promise<DisputeStatus> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getDisputeStatus for ${disputeId}`);
      return {
        disputeId,
        status: 'under_review',
        filedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        isSimulated: true,
      };
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest(`/disputes/${disputeId}`, {
        method: 'GET',
        token,
      });

      return {
        disputeId: response.disputeId as string,
        status: response.status as DisputeStatus['status'],
        filedAt: new Date(response.filedDate as string),
        updatedAt: new Date(response.updatedDate as string),
        resolution: response.resolution as string | undefined,
        resolvedAt: response.resolvedDate ? new Date(response.resolvedDate as string) : undefined,
        isSimulated: false,
      };
    } catch (error) {
      this.logger.error(`Equifax getDisputeStatus failed: ${error}`);
      throw error;
    }
  }

  async setupMonitoring(userId: string): Promise<MonitoringSetup> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] setupMonitoring for user ${userId}`);
      return {
        enabled: true,
        bureau: 'equifax',
        monitoringId: `sim-mon-eq-${Date.now()}`,
        alertTypes: ['score_change', 'new_account', 'hard_inquiry', 'address_change'],
        enrolledAt: new Date(),
        isSimulated: true,
      };
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/monitoring/enroll', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      return {
        enabled: true,
        bureau: 'equifax',
        monitoringId: response.monitoringId as string,
        alertTypes: (response.alertTypes || ['score_change', 'new_account', 'hard_inquiry']) as string[],
        enrolledAt: new Date((response.enrolledAt as string) || Date.now()),
        isSimulated: false,
      };
    } catch (error) {
      this.logger.error(`Equifax setupMonitoring failed: ${error}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Equifax uses OAuth2 client_credentials flow */
  private async getAccessToken(): Promise<string> {
    const tokenUrl =
      this.configService.get<string>('EQUIFAX_TOKEN_URL') ||
      'https://api.equifax.com/v2/oauth/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId!,
        client_secret: this.apiKey!,
        scope: 'https://api.equifax.com/business/consumer-credit/v2',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Equifax OAuth failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  private async makeRequest(
    path: string,
    options: { method: string; body?: Record<string, unknown>; token: string },
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.token}`,
    };

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error');
      throw new Error(`Equifax API error ${response.status}: ${errorBody}`);
    }

    return response.json();
  }

  private mapScoreModel(raw?: string): CreditScoreResult['model'] {
    if (!raw) return 'fico8';
    const normalized = raw.toLowerCase();
    if (normalized.includes('vantage')) return 'vantage3';
    if (normalized.includes('fico9') || normalized.includes('fico 9')) return 'fico9';
    return 'fico8';
  }

  private mapFactors(rawFactors: Record<string, unknown>[]): CreditFactor[] {
    return rawFactors.map((f) => ({
      type: f.type === 'positive' ? ('positive' as const) : ('negative' as const),
      category: this.mapCategory((f.category || f.factorCode) as string),
      title: (f.title || f.factorText || 'Credit Factor') as string,
      description: (f.description || f.narrative || '') as string,
      impact: this.mapImpactLevel((f.weight || f.impactLevel) as string | number),
      value: f.value as string | undefined,
    }));
  }

  private mapCategory(raw: string): CreditFactor['category'] {
    const mapping: Record<string, CreditFactor['category']> = {
      PAYMENT_HISTORY: 'payment_history',
      CREDIT_UTILIZATION: 'credit_utilization',
      LENGTH_OF_HISTORY: 'credit_age',
      CREDIT_MIX: 'credit_mix',
      NEW_CREDIT: 'new_credit',
      TOTAL_ACCOUNTS: 'total_accounts',
    };
    return mapping[raw?.toUpperCase()] || 'payment_history';
  }

  private mapImpactLevel(raw: string | number): 'high' | 'medium' | 'low' {
    if (typeof raw === 'number') {
      if (raw >= 7) return 'high';
      if (raw >= 4) return 'medium';
      return 'low';
    }
    const normalized = String(raw).toLowerCase();
    if (normalized === 'high') return 'high';
    if (normalized === 'medium') return 'medium';
    return 'low';
  }

  private mapReport(raw: Record<string, unknown>): Omit<CreditReport, 'isSimulated'> {
    const tradeLines = (raw.tradeLines || raw.accounts || []) as Record<string, unknown>[];
    const inquiries = (raw.inquiries || []) as Record<string, unknown>[];
    const publicRecords = (raw.publicRecords || []) as Record<string, unknown>[];
    const consumer = raw.consumer as Record<string, unknown> | undefined;
    return {
      accounts: tradeLines.map((a: Record<string, unknown>) => ({
        accountName: (a.creditorName || a.subscriberName || 'Unknown') as string,
        accountType: this.mapAccountType((a.accountType || a.portfolioType) as string),
        status: this.mapAccountStatus((a.payStatus || a.accountStatus) as string),
        balance: (a.balance || a.currentBalance || 0) as number,
        creditLimit: (a.highCredit || a.creditLimit) as number | undefined,
        monthlyPayment: a.scheduledMonthlyPayment as number | undefined,
        openedDate: (a.dateOpened || '') as string,
        lastReportedDate: (a.dateReported || '') as string,
        paymentHistory: [],
      })),
      inquiries: inquiries.map((i: Record<string, unknown>) => ({
        creditorName: (i.subscriberName || 'Unknown') as string,
        inquiryDate: (i.inquiryDate || '') as string,
        type: (i.type === 'soft' ? 'soft' : 'hard') as 'hard' | 'soft',
      })),
      publicRecords: publicRecords.map((pr: Record<string, unknown>) => ({
        type: 'other' as const,
        status: 'active' as const,
        filedDate: (pr.dateFiled || '') as string,
        amount: pr.amount as number | undefined,
        description: (pr.description || 'Public record') as string,
      })),
      personalInfo: {
        name: (consumer?.name || '') as string,
        addresses: (consumer?.addresses || []) as string[],
        employers: (consumer?.employers || []) as string[],
      },
      summary: {
        totalAccounts: tradeLines.length,
        openAccounts: tradeLines.filter(
          (a: Record<string, unknown>) => !a.dateClosed,
        ).length,
        closedAccounts: tradeLines.filter(
          (a: Record<string, unknown>) => !!a.dateClosed,
        ).length,
        totalBalance: 0,
        totalCreditLimit: 0,
        utilization: 0,
        oldestAccountAge: 'N/A',
        hardInquiriesLast12Months: inquiries.filter(
          (i: Record<string, unknown>) => i.type !== 'soft',
        ).length,
        collectionsCount: 0,
        publicRecordsCount: ((raw.publicRecords || []) as unknown[]).length,
      },
    };
  }

  private mapAccountType(raw: string): CreditAccount['accountType'] {
    const normalized = String(raw).toLowerCase();
    if (normalized.includes('revolving') || normalized.includes('credit'))
      return 'credit_card';
    if (normalized.includes('mortgage')) return 'mortgage';
    if (normalized.includes('auto')) return 'auto_loan';
    if (normalized.includes('student') || normalized.includes('education'))
      return 'student_loan';
    if (normalized.includes('installment') || normalized.includes('personal'))
      return 'personal_loan';
    return 'other';
  }

  private mapAccountStatus(raw: string): CreditAccount['status'] {
    const normalized = String(raw).toLowerCase();
    if (normalized.includes('current') || normalized.includes('open')) return 'open';
    if (normalized.includes('closed') || normalized.includes('paid')) return 'closed';
    if (normalized.includes('collection')) return 'collection';
    if (normalized.includes('derog')) return 'derogatory';
    return 'open';
  }
}
