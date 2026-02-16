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
 * Experian Credit Bureau Provider
 *
 * Integrates with Experian's Consumer Credit API.
 * Falls back to simulated data when EXPERIAN_API_KEY is not configured.
 */
@Injectable()
export class ExperianProvider implements CreditBureauProvider {
  readonly name = 'experian' as const;
  private readonly logger = new Logger(ExperianProvider.name);
  private readonly apiKey: string | undefined;
  private readonly clientId: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('EXPERIAN_API_KEY');
    this.clientId = this.configService.get<string>('EXPERIAN_CLIENT_ID');
    this.baseUrl =
      this.configService.get<string>('EXPERIAN_API_URL') ||
      'https://api.experian.com/consumer-services/v2';

    if (this.isConfigured) {
      this.logger.log('Experian provider initialized with API credentials');
    } else {
      this.logger.warn(
        'Experian provider running in simulation mode — set EXPERIAN_API_KEY and EXPERIAN_CLIENT_ID to enable',
      );
    }
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.clientId);
  }

  async getCreditScore(userId: string, _ssn?: string): Promise<CreditScoreResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditScore for user ${userId}`);
      return generateSimulatedScore('experian', userId);
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/credit/score', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      return {
        score: response.creditProfile?.score || response.score,
        model: this.mapScoreModel(response.creditProfile?.modelType),
        range: { min: 300, max: 850 },
        factors: this.mapFactors(response.creditProfile?.riskFactors || []),
        pulledAt: new Date(),
        bureau: 'experian',
      };
    } catch (error) {
      this.logger.error(`Experian getCreditScore failed: ${error}`);
      this.logger.warn('Falling back to simulated data');
      return generateSimulatedScore('experian', userId);
    }
  }

  async getCreditReport(userId: string): Promise<CreditReport> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditReport for user ${userId}`);
      return generateSimulatedReport('experian');
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/credit/report', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      return this.mapReport(response);
    } catch (error) {
      this.logger.error(`Experian getCreditReport failed: ${error}`);
      this.logger.warn('Falling back to simulated data');
      return generateSimulatedReport('experian');
    }
  }

  async getCreditFactors(userId: string): Promise<CreditFactor[]> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditFactors for user ${userId}`);
      return generateSimulatedFactors();
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/credit/factors', {
        method: 'POST',
        body: { consumerId: userId },
        token,
      });

      return this.mapFactors(response.riskFactors || response.factors || []);
    } catch (error) {
      this.logger.error(`Experian getCreditFactors failed: ${error}`);
      return generateSimulatedFactors();
    }
  }

  async fileDispute(userId: string, disputeData: DisputeInput): Promise<DisputeResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] fileDispute for user ${userId}`);
      return {
        disputeId: `sim-ex-${Date.now()}`,
        bureau: 'experian',
        status: 'submitted',
        filedAt: new Date(),
        estimatedResolutionDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString().split('T')[0],
        referenceNumber: `EX-SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      };
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest('/disputes', {
        method: 'POST',
        body: {
          consumerId: userId,
          tradelineId: disputeData.accountId,
          disputeReason: disputeData.reason,
          explanation: disputeData.explanation,
          supportingDocuments: disputeData.supportingDocuments,
        },
        token,
      });

      return {
        disputeId: response.disputeId,
        bureau: 'experian',
        status: response.status || 'submitted',
        filedAt: new Date(response.filedDate || Date.now()),
        estimatedResolutionDate: response.estimatedResolutionDate,
        referenceNumber: response.referenceNumber,
      };
    } catch (error) {
      this.logger.error(`Experian fileDispute failed: ${error}`);
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
      };
    }

    try {
      const token = await this.getAccessToken();
      const response = await this.makeRequest(`/disputes/${disputeId}`, {
        method: 'GET',
        token,
      });

      return {
        disputeId: response.disputeId,
        status: response.status,
        filedAt: new Date(response.filedDate),
        updatedAt: new Date(response.updatedDate),
        resolution: response.resolution,
        resolvedAt: response.resolvedDate ? new Date(response.resolvedDate) : undefined,
      };
    } catch (error) {
      this.logger.error(`Experian getDisputeStatus failed: ${error}`);
      throw error;
    }
  }

  async setupMonitoring(userId: string): Promise<MonitoringSetup> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] setupMonitoring for user ${userId}`);
      return {
        enabled: true,
        bureau: 'experian',
        monitoringId: `sim-mon-ex-${Date.now()}`,
        alertTypes: ['score_change', 'new_account', 'hard_inquiry', 'address_change'],
        enrolledAt: new Date(),
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
        bureau: 'experian',
        monitoringId: response.monitoringId,
        alertTypes: response.alertTypes || ['score_change', 'new_account', 'hard_inquiry'],
        enrolledAt: new Date(response.enrolledAt || Date.now()),
      };
    } catch (error) {
      this.logger.error(`Experian setupMonitoring failed: ${error}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Experian uses OAuth2 client_credentials flow */
  private async getAccessToken(): Promise<string> {
    const tokenUrl =
      this.configService.get<string>('EXPERIAN_TOKEN_URL') ||
      'https://api.experian.com/oauth2/v1/token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId!,
        client_secret: this.apiKey!,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Experian OAuth failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  private async makeRequest(
    path: string,
    options: { method: string; body?: Record<string, unknown>; token?: string },
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error');
      throw new Error(`Experian API error ${response.status}: ${errorBody}`);
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

  private mapFactors(rawFactors: any[]): CreditFactor[] {
    return rawFactors.map((f) => ({
      type: f.type === 'positive' ? ('positive' as const) : ('negative' as const),
      category: this.mapCategory(f.category || f.factorCode),
      title: f.title || f.factorText || 'Credit Factor',
      description: f.description || f.narrative || '',
      impact: this.mapImpactLevel(f.weight || f.impactLevel),
      value: f.value,
    }));
  }

  private mapCategory(raw: string): CreditFactor['category'] {
    const mapping: Record<string, CreditFactor['category']> = {
      PAYMENT_HISTORY: 'payment_history',
      UTILIZATION: 'credit_utilization',
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

  private mapReport(raw: any): CreditReport {
    return {
      accounts: (raw.tradeLines || raw.accounts || []).map((a: any) => ({
        accountName: a.creditorName || a.subscriberName || 'Unknown',
        accountType: this.mapAccountType(a.accountType || a.portfolioType),
        status: this.mapAccountStatus(a.payStatus || a.accountStatus),
        balance: a.balance || a.currentBalance || 0,
        creditLimit: a.highCredit || a.creditLimit,
        monthlyPayment: a.scheduledMonthlyPayment,
        openedDate: a.dateOpened || '',
        lastReportedDate: a.dateReported || '',
        paymentHistory: [],
      })),
      inquiries: (raw.inquiries || []).map((i: any) => ({
        creditorName: i.subscriberName || i.creditorName || 'Unknown',
        inquiryDate: i.inquiryDate || '',
        type: (i.type === 'soft' ? 'soft' : 'hard') as 'hard' | 'soft',
      })),
      publicRecords: (raw.publicRecords || []).map((pr: any) => ({
        type: 'other' as const,
        status: 'active' as const,
        filedDate: pr.dateFiled || '',
        amount: pr.amount,
        description: pr.description || 'Public record',
      })),
      personalInfo: {
        name: raw.consumer?.name || '',
        addresses: raw.consumer?.addresses || [],
        employers: raw.consumer?.employers || [],
      },
      summary: {
        totalAccounts: (raw.tradeLines || raw.accounts || []).length,
        openAccounts: (raw.tradeLines || raw.accounts || []).filter(
          (a: any) => !a.dateClosed,
        ).length,
        closedAccounts: (raw.tradeLines || raw.accounts || []).filter(
          (a: any) => a.dateClosed,
        ).length,
        totalBalance: 0,
        totalCreditLimit: 0,
        utilization: 0,
        oldestAccountAge: 'N/A',
        hardInquiriesLast12Months: (raw.inquiries || []).filter(
          (i: any) => i.type !== 'soft',
        ).length,
        collectionsCount: 0,
        publicRecordsCount: (raw.publicRecords || []).length,
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
