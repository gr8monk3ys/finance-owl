/**
 * Credit Bureau Provider Interface
 *
 * Abstraction layer for credit bureau integrations (TransUnion, Equifax, Experian).
 * All providers must implement this interface. When API keys are not configured,
 * providers fall back to simulated data.
 */

export interface CreditBureauProvider {
  readonly name: 'transunion' | 'equifax' | 'experian';

  /** Whether this provider has real API credentials configured */
  readonly isConfigured: boolean;

  /** Pull credit score */
  getCreditScore(userId: string, ssn?: string): Promise<CreditScoreResult>;

  /** Pull full credit report */
  getCreditReport(userId: string): Promise<CreditReport>;

  /** Get credit factors (what's helping/hurting) */
  getCreditFactors(userId: string): Promise<CreditFactor[]>;

  /** File a dispute */
  fileDispute(userId: string, disputeData: DisputeInput): Promise<DisputeResult>;

  /** Check dispute status */
  getDisputeStatus(disputeId: string): Promise<DisputeStatus>;

  /** Set up credit monitoring alerts */
  setupMonitoring(userId: string): Promise<MonitoringSetup>;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface CreditScoreResult {
  score: number;
  model: 'vantage3' | 'fico8' | 'fico9';
  range: { min: number; max: number };
  factors: CreditFactor[];
  pulledAt: Date;
  bureau: string;
  isSimulated: boolean;
}

export interface CreditReport {
  accounts: CreditAccount[];
  inquiries: CreditInquiry[];
  publicRecords: PublicRecord[];
  personalInfo: PersonalInfo;
  summary: ReportSummary;
  isSimulated: boolean;
}

export interface CreditFactor {
  type: 'positive' | 'negative';
  category:
    | 'payment_history'
    | 'credit_utilization'
    | 'credit_age'
    | 'credit_mix'
    | 'new_credit'
    | 'total_accounts';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  value?: string; // e.g., "98% on-time payments", "23% utilization"
}

export interface CreditAccount {
  accountName: string;
  accountType:
    | 'credit_card'
    | 'mortgage'
    | 'auto_loan'
    | 'student_loan'
    | 'personal_loan'
    | 'other';
  status: 'open' | 'closed' | 'derogatory' | 'collection';
  balance: number;
  creditLimit?: number;
  monthlyPayment?: number;
  openedDate: string;
  lastReportedDate: string;
  paymentHistory: (
    | 'on_time'
    | 'late_30'
    | 'late_60'
    | 'late_90'
    | 'collection'
    | 'unknown'
  )[];
}

export interface CreditInquiry {
  creditorName: string;
  inquiryDate: string;
  type: 'hard' | 'soft';
}

export interface PublicRecord {
  type: 'bankruptcy' | 'tax_lien' | 'civil_judgment' | 'other';
  status: 'active' | 'released' | 'discharged';
  filedDate: string;
  amount?: number;
  description: string;
}

export interface PersonalInfo {
  name: string;
  addresses: string[];
  employers: string[];
}

export interface ReportSummary {
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;
  totalBalance: number;
  totalCreditLimit: number;
  utilization: number;
  oldestAccountAge: string;
  hardInquiriesLast12Months: number;
  collectionsCount: number;
  publicRecordsCount: number;
}

export interface DisputeInput {
  accountId: string;
  reason:
    | 'not_mine'
    | 'incorrect_balance'
    | 'incorrect_status'
    | 'incorrect_date'
    | 'other';
  explanation: string;
  supportingDocuments?: string[];
}

export interface DisputeResult {
  disputeId: string;
  bureau: string;
  status: 'submitted' | 'under_review' | 'resolved' | 'rejected';
  filedAt: Date;
  estimatedResolutionDate: string;
  referenceNumber: string;
  isSimulated: boolean;
}

export interface DisputeStatus {
  disputeId: string;
  status: 'submitted' | 'under_review' | 'resolved' | 'rejected';
  filedAt: Date;
  updatedAt: Date;
  resolution?: string;
  resolvedAt?: Date;
  isSimulated: boolean;
}

export interface MonitoringSetup {
  enabled: boolean;
  bureau: string;
  monitoringId: string;
  alertTypes: string[];
  enrolledAt: Date;
  isSimulated: boolean;
}
