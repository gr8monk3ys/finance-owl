/**
 * Simulated credit data for development and fallback when bureau API keys
 * are not configured. Produces deterministic-ish data seeded by userId so
 * the same user always sees roughly consistent simulated data.
 */

import type {
  CreditScoreResult,
  CreditReport,
  CreditFactor,
  CreditAccount,
  CreditInquiry,
  ReportSummary,
} from './bureau.interface';

// ---------------------------------------------------------------------------
// Deterministic seed from userId
// ---------------------------------------------------------------------------

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ---------------------------------------------------------------------------
// Score generation
// ---------------------------------------------------------------------------

export function generateSimulatedScore(
  bureau: string,
  userId: string,
): CreditScoreResult {
  const seed = hashCode(userId + bureau);
  const rand = seededRandom(seed);

  // Generate a score between 580 and 810 — biased toward middle-to-good
  const baseScore = 580 + Math.round(rand() * 230);
  const score = Math.max(300, Math.min(850, baseScore));

  return {
    score,
    model: 'vantage3',
    range: { min: 300, max: 850 },
    factors: generateSimulatedFactors(userId),
    pulledAt: new Date(),
    bureau,
  };
}

// ---------------------------------------------------------------------------
// Factors generation
// ---------------------------------------------------------------------------

export function generateSimulatedFactors(userId?: string): CreditFactor[] {
  const seed = hashCode((userId || 'default') + 'factors');
  const rand = seededRandom(seed);

  const utilPct = Math.round(rand() * 60) + 5; // 5%–65%
  const onTimePct = Math.round(85 + rand() * 15); // 85%–100%
  const ageYears = Math.round(1 + rand() * 14); // 1–15 years
  const totalAccounts = Math.round(3 + rand() * 12); // 3–15

  return [
    {
      type: onTimePct >= 97 ? 'positive' : 'negative',
      category: 'payment_history',
      title: 'Payment History',
      description:
        onTimePct >= 97
          ? 'Your excellent payment track record is helping your score.'
          : 'Late or missed payments are reducing your credit score.',
      impact: 'high',
      value: `${onTimePct}% on-time payments`,
    },
    {
      type: utilPct <= 30 ? 'positive' : 'negative',
      category: 'credit_utilization',
      title: 'Credit Utilization',
      description:
        utilPct <= 30
          ? 'You are using a healthy amount of your available credit.'
          : 'Your credit utilization is higher than recommended. Try to keep it below 30%.',
      impact: 'high',
      value: `${utilPct}% utilization`,
    },
    {
      type: ageYears >= 5 ? 'positive' : 'negative',
      category: 'credit_age',
      title: 'Credit Age',
      description:
        ageYears >= 5
          ? 'A longer credit history is boosting your score.'
          : 'Your credit history is relatively short, which limits your score.',
      impact: 'medium',
      value: `${ageYears} year${ageYears === 1 ? '' : 's'} average age`,
    },
    {
      type: totalAccounts >= 5 ? 'positive' : 'negative',
      category: 'credit_mix',
      title: 'Credit Mix',
      description:
        totalAccounts >= 5
          ? 'A diverse mix of credit types is helping your profile.'
          : 'Having more types of credit accounts could improve your score.',
      impact: 'medium',
      value: `${totalAccounts} accounts`,
    },
    {
      type: 'positive',
      category: 'new_credit',
      title: 'Recent Inquiries',
      description: 'You have a low number of recent hard inquiries.',
      impact: 'low',
      value: `${Math.round(rand() * 2)} inquiries in last 12 months`,
    },
    {
      type: totalAccounts >= 4 ? 'positive' : 'negative',
      category: 'total_accounts',
      title: 'Total Accounts',
      description:
        totalAccounts >= 4
          ? 'You have a healthy number of credit accounts.'
          : 'Opening a few more accounts over time could help your credit profile.',
      impact: 'low',
      value: `${totalAccounts} total accounts`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Full report generation
// ---------------------------------------------------------------------------

export function generateSimulatedReport(bureau: string): CreditReport {
  const accounts: CreditAccount[] = [
    {
      accountName: 'Chase Sapphire Preferred',
      accountType: 'credit_card',
      status: 'open',
      balance: 2340,
      creditLimit: 15000,
      monthlyPayment: 150,
      openedDate: '2019-03-15',
      lastReportedDate: new Date().toISOString().split('T')[0],
      paymentHistory: Array(12).fill('on_time' as const),
    },
    {
      accountName: 'Wells Fargo Home Mortgage',
      accountType: 'mortgage',
      status: 'open',
      balance: 285000,
      monthlyPayment: 1850,
      openedDate: '2020-07-01',
      lastReportedDate: new Date().toISOString().split('T')[0],
      paymentHistory: Array(12).fill('on_time' as const),
    },
    {
      accountName: 'Capital One Quicksilver',
      accountType: 'credit_card',
      status: 'open',
      balance: 780,
      creditLimit: 8000,
      monthlyPayment: 50,
      openedDate: '2021-01-20',
      lastReportedDate: new Date().toISOString().split('T')[0],
      paymentHistory: [
        ...Array(10).fill('on_time' as const),
        'late_30' as const,
        'on_time' as const,
      ],
    },
    {
      accountName: 'Toyota Financial Auto Loan',
      accountType: 'auto_loan',
      status: 'open',
      balance: 12500,
      monthlyPayment: 420,
      openedDate: '2022-06-10',
      lastReportedDate: new Date().toISOString().split('T')[0],
      paymentHistory: Array(12).fill('on_time' as const),
    },
    {
      accountName: 'Discover it Card',
      accountType: 'credit_card',
      status: 'closed',
      balance: 0,
      creditLimit: 5000,
      openedDate: '2017-09-05',
      lastReportedDate: '2023-12-01',
      paymentHistory: Array(12).fill('on_time' as const),
    },
  ];

  const inquiries: CreditInquiry[] = [
    {
      creditorName: 'Toyota Financial Services',
      inquiryDate: '2022-06-05',
      type: 'hard',
    },
    {
      creditorName: 'Capital One',
      inquiryDate: '2021-01-15',
      type: 'hard',
    },
    {
      creditorName: 'Credit Karma',
      inquiryDate: new Date().toISOString().split('T')[0],
      type: 'soft',
    },
  ];

  const openAccounts = accounts.filter((a) => a.status === 'open');
  const totalCreditLimit = accounts.reduce(
    (sum, a) => sum + (a.creditLimit || 0),
    0,
  );
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const summary: ReportSummary = {
    totalAccounts: accounts.length,
    openAccounts: openAccounts.length,
    closedAccounts: accounts.length - openAccounts.length,
    totalBalance,
    totalCreditLimit,
    utilization:
      totalCreditLimit > 0
        ? Math.round((totalBalance / totalCreditLimit) * 100)
        : 0,
    oldestAccountAge: '8 years',
    hardInquiriesLast12Months: inquiries.filter((i) => i.type === 'hard').length,
    collectionsCount: 0,
    publicRecordsCount: 0,
  };

  return {
    accounts,
    inquiries,
    publicRecords: [],
    personalInfo: {
      name: 'Simulated User',
      addresses: ['123 Main Street, Anytown, US 12345'],
      employers: ['Acme Corporation'],
    },
    summary,
  };
}
