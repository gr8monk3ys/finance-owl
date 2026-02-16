/**
 * Banking-as-a-Service Provider Interface
 *
 * Defines a unified contract for integrating with BaaS partners
 * (Unit.co, Treasury Prime, etc.). Each provider adapts its
 * vendor-specific API to this common interface so the rest of
 * the application can work with any BaaS provider interchangeably.
 */

export type BaaSProviderName = 'unit' | 'treasury_prime';

// ---------------------------------------------------------------------------
// Core Interface
// ---------------------------------------------------------------------------

export interface BaaSProvider {
  /** Unique identifier for this provider (e.g. 'unit', 'treasury_prime'). */
  readonly name: BaaSProviderName;

  /** Open a new checking or savings account. */
  openAccount(
    userId: string,
    type: 'checking' | 'savings',
    data: AccountOpenData,
  ): Promise<BaaSAccount>;

  /** Get account details by external (provider-side) account ID. */
  getAccount(externalAccountId: string): Promise<BaaSAccount>;

  /** Get the current balance for an account. */
  getBalance(externalAccountId: string): Promise<BaaSBalance>;

  /** Initiate an ACH or book transfer. */
  initiateTransfer(
    from: TransferParty,
    to: TransferParty,
    amount: number,
    memo?: string,
  ): Promise<BaaSTransfer>;

  /** Check the current status of a transfer. */
  getTransferStatus(transferId: string): Promise<BaaSTransfer>;

  /** Get the current interest rate for a given account type. */
  getInterestRate(accountType: 'checking' | 'savings'): Promise<InterestRate>;

  /** Retrieve transaction history for a date range. */
  getTransactions(
    externalAccountId: string,
    startDate: string,
    endDate: string,
  ): Promise<BaaSTransaction[]>;

  /** Close an account with a reason. */
  closeAccount(externalAccountId: string, reason: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Request / Option Types
// ---------------------------------------------------------------------------

export interface AccountOpenData {
  /** Full legal name. */
  fullName: string;
  /** Email address. */
  email: string;
  /** Date of birth (YYYY-MM-DD). */
  dateOfBirth: string;
  /** Social Security Number (last 4 or full, depending on provider). */
  ssn: string;
  /** Physical address. */
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  /** Phone number. */
  phone?: string;
}

export interface TransferParty {
  /** Internal or external account ID. */
  accountId: string;
  /** Routing number (for external ACH transfers). */
  routingNumber?: string;
  /** Account number (for external ACH transfers). */
  accountNumber?: string;
  /** Type of transfer party. */
  type: 'internal' | 'external';
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface BaaSAccount {
  /** Provider-side account ID. */
  externalAccountId: string;
  /** Account type. */
  type: 'checking' | 'savings';
  /** Account status. */
  status: 'pending' | 'active' | 'frozen' | 'closed';
  /** Routing number for ACH transfers. */
  routingNumber: string;
  /** Masked account number (last 4 digits). */
  accountNumberMask: string;
  /** Current balance in cents. */
  balance: number;
  /** Annual Percentage Yield. */
  apy: number;
  /** Whether FDIC insured. */
  fdicInsured: boolean;
  /** Bank name backing the account. */
  bankName: string;
  /** ISO timestamp of account creation. */
  createdAt: string;
}

export interface BaaSBalance {
  /** Available balance in cents. */
  available: number;
  /** Pending balance in cents. */
  pending: number;
  /** Currency code. */
  currency: string;
}

export interface BaaSTransfer {
  /** Provider-side transfer ID. */
  transferId: string;
  /** Transfer status. */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'returned';
  /** Amount in cents. */
  amount: number;
  /** Memo / description. */
  memo: string | null;
  /** Estimated arrival date (ISO string). */
  estimatedArrival: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of completion (null if not yet completed). */
  completedAt: string | null;
}

export interface InterestRate {
  /** Account type this rate applies to. */
  accountType: 'checking' | 'savings';
  /** Annual Percentage Yield as a decimal (e.g. 0.045 for 4.5%). */
  apy: number;
  /** Effective date of this rate. */
  effectiveDate: string;
  /** Whether the rate is variable. */
  isVariable: boolean;
}

export interface BaaSTransaction {
  /** Provider-side transaction ID. */
  externalId: string;
  /** Amount in cents (positive = credit, negative = debit). */
  amount: number;
  /** Transaction type. */
  type: 'credit' | 'debit';
  /** Description / memo. */
  description: string;
  /** Transaction date (ISO string). */
  date: string;
  /** Whether the transaction is still pending. */
  pending: boolean;
  /** Category if available. */
  category: string | null;
}

// ---------------------------------------------------------------------------
// Injection Token
// ---------------------------------------------------------------------------

/**
 * Injection token used to provide the list of available BaaS
 * providers via NestJS DI.
 */
export const BAAS_PROVIDERS = Symbol('BAAS_PROVIDERS');
