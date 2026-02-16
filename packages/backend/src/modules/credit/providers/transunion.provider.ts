import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreditBureauProvider,
  CreditScoreResult,
  CreditReport,
  CreditFactor,
  DisputeInput,
  DisputeResult,
  DisputeStatus,
  MonitoringSetup,
} from './bureau.interface';
import { generateSimulatedScore, generateSimulatedReport, generateSimulatedFactors } from './simulated-data';

/**
 * TransUnion Credit Bureau Provider
 *
 * Integrates with TransUnion's TrueVision / Consumer Credit API.
 * Falls back to simulated data when TRANSUNION_API_KEY is not configured.
 */
@Injectable()
export class TransUnionProvider implements CreditBureauProvider {
  readonly name = 'transunion' as const;
  private readonly logger = new Logger(TransUnionProvider.name);
  private readonly apiKey: string | undefined;
  private readonly partnerId: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TRANSUNION_API_KEY');
    this.partnerId = this.configService.get<string>('TRANSUNION_PARTNER_ID');
    this.baseUrl =
      this.configService.get<string>('TRANSUNION_API_URL') ||
      'https://api.transunion.com/v1';

    if (this.isConfigured) {
      this.logger.log('TransUnion provider initialized with API credentials');
    } else {
      this.logger.warn(
        'TransUnion provider running in simulation mode — set TRANSUNION_API_KEY and TRANSUNION_PARTNER_ID to enable',
      );
    }
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.partnerId);
  }

  async getCreditScore(userId: string, _ssn?: string): Promise<CreditScoreResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditScore for user ${userId}`);
      return generateSimulatedScore('transunion', userId);
    }

    try {
      const response = await this.makeRequest('/credit/score', {
        method: 'POST',
        body: { consumerId: userId },
      });

      return {
        score: response.score,
        model: response.scoreModel || 'vantage3',
        range: { min: 300, max: 850 },
        factors: this.mapFactors(response.factors || []),
        pulledAt: new Date(),
        bureau: 'transunion',
      };
    } catch (error) {
      this.logger.error(`TransUnion getCreditScore failed: ${error}`);
      this.logger.warn('Falling back to simulated data');
      return generateSimulatedScore('transunion', userId);
    }
  }

  async getCreditReport(userId: string): Promise<CreditReport> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditReport for user ${userId}`);
      return generateSimulatedReport('transunion');
    }

    try {
      const response = await this.makeRequest('/credit/report', {
        method: 'POST',
        body: { consumerId: userId },
      });

      return this.mapReport(response);
    } catch (error) {
      this.logger.error(`TransUnion getCreditReport failed: ${error}`);
      this.logger.warn('Falling back to simulated data');
      return generateSimulatedReport('transunion');
    }
  }

  async getCreditFactors(userId: string): Promise<CreditFactor[]> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] getCreditFactors for user ${userId}`);
      return generateSimulatedFactors();
    }

    try {
      const response = await this.makeRequest('/credit/factors', {
        method: 'POST',
        body: { consumerId: userId },
      });

      return this.mapFactors(response.factors || []);
    } catch (error) {
      this.logger.error(`TransUnion getCreditFactors failed: ${error}`);
      return generateSimulatedFactors();
    }
  }

  async fileDispute(userId: string, disputeData: DisputeInput): Promise<DisputeResult> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] fileDispute for user ${userId}`);
      return {
        disputeId: `sim-tu-${Date.now()}`,
        bureau: 'transunion',
        status: 'submitted',
        filedAt: new Date(),
        estimatedResolutionDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString().split('T')[0],
        referenceNumber: `TU-SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      };
    }

    try {
      const response = await this.makeRequest('/disputes', {
        method: 'POST',
        body: {
          consumerId: userId,
          accountId: disputeData.accountId,
          reason: disputeData.reason,
          explanation: disputeData.explanation,
          documents: disputeData.supportingDocuments,
        },
      });

      return {
        disputeId: response.disputeId,
        bureau: 'transunion',
        status: response.status || 'submitted',
        filedAt: new Date(response.filedAt || Date.now()),
        estimatedResolutionDate: response.estimatedResolutionDate,
        referenceNumber: response.referenceNumber,
      };
    } catch (error) {
      this.logger.error(`TransUnion fileDispute failed: ${error}`);
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
      const response = await this.makeRequest(`/disputes/${disputeId}`, {
        method: 'GET',
      });

      return {
        disputeId: response.disputeId,
        status: response.status,
        filedAt: new Date(response.filedAt),
        updatedAt: new Date(response.updatedAt),
        resolution: response.resolution,
        resolvedAt: response.resolvedAt ? new Date(response.resolvedAt) : undefined,
      };
    } catch (error) {
      this.logger.error(`TransUnion getDisputeStatus failed: ${error}`);
      throw error;
    }
  }

  async setupMonitoring(userId: string): Promise<MonitoringSetup> {
    if (!this.isConfigured) {
      this.logger.debug(`[simulated] setupMonitoring for user ${userId}`);
      return {
        enabled: true,
        bureau: 'transunion',
        monitoringId: `sim-mon-tu-${Date.now()}`,
        alertTypes: ['score_change', 'new_account', 'hard_inquiry', 'address_change'],
        enrolledAt: new Date(),
      };
    }

    try {
      const response = await this.makeRequest('/monitoring/enroll', {
        method: 'POST',
        body: { consumerId: userId },
      });

      return {
        enabled: true,
        bureau: 'transunion',
        monitoringId: response.monitoringId,
        alertTypes: response.alertTypes || ['score_change', 'new_account', 'hard_inquiry'],
        enrolledAt: new Date(response.enrolledAt || Date.now()),
      };
    } catch (error) {
      this.logger.error(`TransUnion setupMonitoring failed: ${error}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async makeRequest(
    path: string,
    options: { method: string; body?: Record<string, unknown> },
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      'X-Partner-Id': this.partnerId!,
    };

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error');
      throw new Error(
        `TransUnion API error ${response.status}: ${errorBody}`,
      );
    }

    return response.json();
  }

  private mapFactors(rawFactors: any[]): CreditFactor[] {
    return rawFactors.map((f) => ({
      type: f.impact === 'positive' ? ('positive' as const) : ('negative' as const),
      category: this.mapCategory(f.category || f.code),
      title: f.title || f.description || 'Credit Factor',
      description: f.description || f.narrative || '',
      impact: this.mapImpactLevel(f.impactLevel || f.weight),
      value: f.value,
    }));
  }

  private mapCategory(
    raw: string,
  ): CreditFactor['category'] {
    const mapping: Record<string, CreditFactor['category']> = {
      PAYMENT: 'payment_history',
      UTILIZATION: 'credit_utilization',
      AGE: 'credit_age',
      MIX: 'credit_mix',
      NEW_CREDIT: 'new_credit',
      ACCOUNTS: 'total_accounts',
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
    if (normalized === 'high' || normalized === 'critical') return 'high';
    if (normalized === 'medium' || normalized === 'moderate') return 'medium';
    return 'low';
  }

  private mapReport(raw: any): CreditReport {
    return {
      accounts: (raw.tradeLines || raw.accounts || []).map((a: any) => ({
        accountName: a.creditorName || a.subscriberName || 'Unknown',
        accountType: this.mapAccountType(a.accountType),
        status: this.mapAccountStatus(a.accountStatus),
        balance: a.currentBalance || 0,
        creditLimit: a.creditLimit,
        monthlyPayment: a.monthlyPayment,
        openedDate: a.dateOpened || '',
        lastReportedDate: a.dateReported || '',
        paymentHistory: (a.paymentPattern || []).map((p: string) =>
          this.mapPaymentStatus(p),
        ),
      })),
      inquiries: (raw.inquiries || []).map((i: any) => ({
        creditorName: i.subscriberName || 'Unknown',
        inquiryDate: i.inquiryDate || '',
        type: i.inquiryType === 'soft' ? ('soft' as const) : ('hard' as const),
      })),
      publicRecords: (raw.publicRecords || []).map((pr: any) => ({
        type: 'other' as const,
        status: 'active' as const,
        filedDate: pr.dateFiled || '',
        amount: pr.amount,
        description: pr.description || 'Public record',
      })),
      personalInfo: {
        name: raw.personalInfo?.name || '',
        addresses: raw.personalInfo?.addresses || [],
        employers: raw.personalInfo?.employers || [],
      },
      summary: {
        totalAccounts: raw.summary?.totalAccounts || 0,
        openAccounts: raw.summary?.openAccounts || 0,
        closedAccounts: raw.summary?.closedAccounts || 0,
        totalBalance: raw.summary?.totalBalance || 0,
        totalCreditLimit: raw.summary?.totalCreditLimit || 0,
        utilization: raw.summary?.utilization || 0,
        oldestAccountAge: raw.summary?.oldestAccountAge || 'N/A',
        hardInquiriesLast12Months: raw.summary?.hardInquiries || 0,
        collectionsCount: raw.summary?.collections || 0,
        publicRecordsCount: raw.summary?.publicRecords || 0,
      },
    };
  }

  private mapAccountType(raw: string): CreditAccount['accountType'] {
    const normalized = String(raw).toLowerCase();
    if (normalized.includes('credit') || normalized.includes('revolving'))
      return 'credit_card';
    if (normalized.includes('mortgage')) return 'mortgage';
    if (normalized.includes('auto')) return 'auto_loan';
    if (normalized.includes('student')) return 'student_loan';
    if (normalized.includes('personal') || normalized.includes('installment'))
      return 'personal_loan';
    return 'other';
  }

  private mapAccountStatus(raw: string): CreditAccount['status'] {
    const normalized = String(raw).toLowerCase();
    if (normalized.includes('open') || normalized.includes('current')) return 'open';
    if (normalized.includes('closed') || normalized.includes('paid')) return 'closed';
    if (normalized.includes('collection')) return 'collection';
    if (normalized.includes('derog')) return 'derogatory';
    return 'open';
  }

  private mapPaymentStatus(code: string): CreditAccount['paymentHistory'][number] {
    switch (code) {
      case 'C':
      case '0':
        return 'on_time';
      case '1':
        return 'late_30';
      case '2':
        return 'late_60';
      case '3':
        return 'late_90';
      case '9':
        return 'collection';
      default:
        return 'unknown';
    }
  }
}

// Re-import type for mapReport helper
import type { CreditAccount } from './bureau.interface';
