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
        score: response.score as number,
        model: (response.scoreModel || 'vantage3') as CreditScoreResult['model'],
        range: { min: 300, max: 850 },
        factors: this.mapFactors((response.factors || []) as Record<string, unknown>[]),
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

      return this.mapFactors((response.factors || []) as Record<string, unknown>[]);
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
        disputeId: response.disputeId as string,
        bureau: 'transunion',
        status: (response.status || 'submitted') as DisputeResult['status'],
        filedAt: new Date((response.filedAt as string) || Date.now()),
        estimatedResolutionDate: (response.estimatedResolutionDate || '') as string,
        referenceNumber: (response.referenceNumber || '') as string,
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
        disputeId: response.disputeId as string,
        status: response.status as DisputeStatus['status'],
        filedAt: new Date(response.filedAt as string),
        updatedAt: new Date(response.updatedAt as string),
        resolution: response.resolution as string | undefined,
        resolvedAt: response.resolvedAt ? new Date(response.resolvedAt as string) : undefined,
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
        monitoringId: response.monitoringId as string,
        alertTypes: (response.alertTypes || ['score_change', 'new_account', 'hard_inquiry']) as string[],
        enrolledAt: new Date((response.enrolledAt as string) || Date.now()),
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
  ): Promise<Record<string, unknown>> {
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

  private mapFactors(rawFactors: Record<string, unknown>[]): CreditFactor[] {
    return rawFactors.map((f) => ({
      type: f.impact === 'positive' ? ('positive' as const) : ('negative' as const),
      category: this.mapCategory((f.category || f.code) as string),
      title: (f.title || f.description || 'Credit Factor') as string,
      description: (f.description || f.narrative || '') as string,
      impact: this.mapImpactLevel((f.impactLevel || f.weight) as string | number),
      value: f.value as string | undefined,
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

  private mapReport(raw: Record<string, unknown>): CreditReport {
    const tradeLines = (raw.tradeLines || raw.accounts || []) as Record<string, unknown>[];
    const inquiries = (raw.inquiries || []) as Record<string, unknown>[];
    const publicRecords = (raw.publicRecords || []) as Record<string, unknown>[];
    const personalInfo = raw.personalInfo as Record<string, unknown> | undefined;
    const summary = raw.summary as Record<string, unknown> | undefined;
    return {
      accounts: tradeLines.map((a: Record<string, unknown>) => ({
        accountName: (a.creditorName || a.subscriberName || 'Unknown') as string,
        accountType: this.mapAccountType(a.accountType as string),
        status: this.mapAccountStatus(a.accountStatus as string),
        balance: (a.currentBalance || 0) as number,
        creditLimit: a.creditLimit as number | undefined,
        monthlyPayment: a.monthlyPayment as number | undefined,
        openedDate: (a.dateOpened || '') as string,
        lastReportedDate: (a.dateReported || '') as string,
        paymentHistory: ((a.paymentPattern || []) as string[]).map((p: string) =>
          this.mapPaymentStatus(p),
        ),
      })),
      inquiries: inquiries.map((i: Record<string, unknown>) => ({
        creditorName: (i.subscriberName || 'Unknown') as string,
        inquiryDate: (i.inquiryDate || '') as string,
        type: i.inquiryType === 'soft' ? ('soft' as const) : ('hard' as const),
      })),
      publicRecords: publicRecords.map((pr: Record<string, unknown>) => ({
        type: 'other' as const,
        status: 'active' as const,
        filedDate: (pr.dateFiled || '') as string,
        amount: pr.amount as number | undefined,
        description: (pr.description || 'Public record') as string,
      })),
      personalInfo: {
        name: (personalInfo?.name || '') as string,
        addresses: (personalInfo?.addresses || []) as string[],
        employers: (personalInfo?.employers || []) as string[],
      },
      summary: {
        totalAccounts: (summary?.totalAccounts || 0) as number,
        openAccounts: (summary?.openAccounts || 0) as number,
        closedAccounts: (summary?.closedAccounts || 0) as number,
        totalBalance: (summary?.totalBalance || 0) as number,
        totalCreditLimit: (summary?.totalCreditLimit || 0) as number,
        utilization: (summary?.utilization || 0) as number,
        oldestAccountAge: (summary?.oldestAccountAge || 'N/A') as string,
        hardInquiriesLast12Months: (summary?.hardInquiries || 0) as number,
        collectionsCount: (summary?.collections || 0) as number,
        publicRecordsCount: (summary?.publicRecords || 0) as number,
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
