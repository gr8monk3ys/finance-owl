// ---------------------------------------------------------------------------
// Plan definitions for FinanceOwl SaaS billing
// ---------------------------------------------------------------------------

export type PlanTier = 'free' | 'pro' | 'premium';

export interface PlanDefinition {
  name: PlanTier;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: PlanLimits;
}

export interface PlanLimits {
  maxLinkedAccounts: number; // -1 = unlimited
  maxManualAccounts: number;
  transactionHistoryMonths: number; // -1 = unlimited
  aiChatMessagesPerDay: number; // -1 = unlimited
  apiRequestsPerMinute: number;
  csvExport: boolean;
  customCategories: boolean;
  householdMembers: number; // 0 = not available, -1 = unlimited
}

// ---------------------------------------------------------------------------
// Feature keys
// ---------------------------------------------------------------------------

export const FEATURES = {
  // Free-tier features
  BASIC_BUDGETS: 'basic_budgets',
  MANUAL_ACCOUNTS: 'manual_accounts',
  BASIC_ANALYTICS: 'basic_analytics',
  AI_CHAT_LIMITED: 'ai_chat_limited',
  LINKED_ACCOUNTS_2: 'linked_accounts_2',

  // Pro-tier features
  AI_CHAT_UNLIMITED: 'ai_chat_unlimited',
  LINKED_ACCOUNTS_UNLIMITED: 'linked_accounts_unlimited',
  SUBSCRIPTION_TRACKING: 'subscription_tracking',
  BILL_NEGOTIATION: 'bill_negotiation',
  SMART_SAVINGS: 'smart_savings',
  INVESTMENT_TRACKING: 'investment_tracking',
  REPORTS: 'reports',
  CSV_EXPORT: 'csv_export',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  AI_INSIGHTS: 'ai_insights',
  CUSTOM_CATEGORIES: 'custom_categories',
  PRIORITY_SUPPORT: 'priority_support',
  TRANSACTION_HISTORY_UNLIMITED: 'transaction_history_unlimited',

  // Premium-tier features
  HOUSEHOLD_SHARING: 'household_sharing',
  FAMILY_BUDGETS: 'family_budgets',
  SHARED_GOALS: 'shared_goals',
  ADVISOR_SHARING: 'advisor_sharing',
  DEDICATED_SUPPORT: 'dedicated_support',
  API_ACCESS: 'api_access',
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

// ---------------------------------------------------------------------------
// Plan feature lists
// ---------------------------------------------------------------------------

export const PLAN_FEATURES: Record<PlanTier, string[]> = {
  free: [
    FEATURES.BASIC_BUDGETS,
    FEATURES.MANUAL_ACCOUNTS,
    FEATURES.BASIC_ANALYTICS,
    FEATURES.AI_CHAT_LIMITED,
    FEATURES.LINKED_ACCOUNTS_2,
  ],
  pro: [
    FEATURES.BASIC_BUDGETS,
    FEATURES.MANUAL_ACCOUNTS,
    FEATURES.BASIC_ANALYTICS,
    FEATURES.AI_CHAT_UNLIMITED,
    FEATURES.LINKED_ACCOUNTS_UNLIMITED,
    FEATURES.SUBSCRIPTION_TRACKING,
    FEATURES.BILL_NEGOTIATION,
    FEATURES.SMART_SAVINGS,
    FEATURES.INVESTMENT_TRACKING,
    FEATURES.REPORTS,
    FEATURES.CSV_EXPORT,
    FEATURES.ADVANCED_ANALYTICS,
    FEATURES.AI_INSIGHTS,
    FEATURES.CUSTOM_CATEGORIES,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.TRANSACTION_HISTORY_UNLIMITED,
  ],
  premium: [
    FEATURES.BASIC_BUDGETS,
    FEATURES.MANUAL_ACCOUNTS,
    FEATURES.BASIC_ANALYTICS,
    FEATURES.AI_CHAT_UNLIMITED,
    FEATURES.LINKED_ACCOUNTS_UNLIMITED,
    FEATURES.SUBSCRIPTION_TRACKING,
    FEATURES.BILL_NEGOTIATION,
    FEATURES.SMART_SAVINGS,
    FEATURES.INVESTMENT_TRACKING,
    FEATURES.REPORTS,
    FEATURES.CSV_EXPORT,
    FEATURES.ADVANCED_ANALYTICS,
    FEATURES.AI_INSIGHTS,
    FEATURES.CUSTOM_CATEGORIES,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.TRANSACTION_HISTORY_UNLIMITED,
    FEATURES.HOUSEHOLD_SHARING,
    FEATURES.FAMILY_BUDGETS,
    FEATURES.SHARED_GOALS,
    FEATURES.ADVISOR_SHARING,
    FEATURES.DEDICATED_SUPPORT,
    FEATURES.API_ACCESS,
  ],
};

// ---------------------------------------------------------------------------
// Feature-to-minimum-plan map
// ---------------------------------------------------------------------------

export const FEATURE_PLAN_MAP: Record<string, PlanTier> = {
  [FEATURES.BASIC_BUDGETS]: 'free',
  [FEATURES.MANUAL_ACCOUNTS]: 'free',
  [FEATURES.BASIC_ANALYTICS]: 'free',
  [FEATURES.AI_CHAT_LIMITED]: 'free',
  [FEATURES.LINKED_ACCOUNTS_2]: 'free',

  [FEATURES.AI_CHAT_UNLIMITED]: 'pro',
  [FEATURES.LINKED_ACCOUNTS_UNLIMITED]: 'pro',
  [FEATURES.SUBSCRIPTION_TRACKING]: 'pro',
  [FEATURES.BILL_NEGOTIATION]: 'pro',
  [FEATURES.SMART_SAVINGS]: 'pro',
  [FEATURES.INVESTMENT_TRACKING]: 'pro',
  [FEATURES.REPORTS]: 'pro',
  [FEATURES.CSV_EXPORT]: 'pro',
  [FEATURES.ADVANCED_ANALYTICS]: 'pro',
  [FEATURES.AI_INSIGHTS]: 'pro',
  [FEATURES.CUSTOM_CATEGORIES]: 'pro',
  [FEATURES.PRIORITY_SUPPORT]: 'pro',
  [FEATURES.TRANSACTION_HISTORY_UNLIMITED]: 'pro',

  [FEATURES.HOUSEHOLD_SHARING]: 'premium',
  [FEATURES.FAMILY_BUDGETS]: 'premium',
  [FEATURES.SHARED_GOALS]: 'premium',
  [FEATURES.ADVISOR_SHARING]: 'premium',
  [FEATURES.DEDICATED_SUPPORT]: 'premium',
  [FEATURES.API_ACCESS]: 'premium',
};

// ---------------------------------------------------------------------------
// Plan tier hierarchy (numeric for comparisons)
// ---------------------------------------------------------------------------

export const PLAN_TIER_ORDER: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'For getting started with personal finance tracking.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: PLAN_FEATURES.free,
    limits: {
      maxLinkedAccounts: 2,
      maxManualAccounts: 5,
      transactionHistoryMonths: 3,
      aiChatMessagesPerDay: 5,
      apiRequestsPerMinute: 30,
      csvExport: false,
      customCategories: false,
      householdMembers: 0,
    },
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Full-featured finance management for power users.',
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    features: PLAN_FEATURES.pro,
    limits: {
      maxLinkedAccounts: -1,
      maxManualAccounts: -1,
      transactionHistoryMonths: -1,
      aiChatMessagesPerDay: -1,
      apiRequestsPerMinute: 120,
      csvExport: true,
      customCategories: true,
      householdMembers: 0,
    },
  },
  premium: {
    name: 'premium',
    displayName: 'Premium',
    description: 'Share finances and budgets with your household.',
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    features: PLAN_FEATURES.premium,
    limits: {
      maxLinkedAccounts: -1,
      maxManualAccounts: -1,
      transactionHistoryMonths: -1,
      aiChatMessagesPerDay: -1,
      apiRequestsPerMinute: 300,
      csvExport: true,
      customCategories: true,
      householdMembers: 10,
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a given plan tier can access a specific feature.
 */
export function canAccessFeature(plan: PlanTier, feature: string): boolean {
  const features = PLAN_FEATURES[plan];
  if (!features) return false;
  return features.includes(feature);
}

/**
 * Get the minimum plan required for a feature.
 */
export function getRequiredPlan(feature: string): PlanTier {
  return FEATURE_PLAN_MAP[feature] ?? 'pro';
}

/**
 * Check if planA is at least as high a tier as planB.
 */
export function isAtLeastPlan(current: PlanTier, required: PlanTier): boolean {
  return (PLAN_TIER_ORDER[current] ?? 0) >= (PLAN_TIER_ORDER[required] ?? 0);
}

/**
 * Get the plan definition for a tier.
 */
export function getPlanDefinition(tier: PlanTier): PlanDefinition {
  return PLANS[tier] ?? PLANS.free;
}

/**
 * Get all plan definitions as an ordered array.
 */
export function getAllPlans(): PlanDefinition[] {
  return [PLANS.free, PLANS.pro, PLANS.premium];
}

/**
 * Get the plan limits for a tier.
 */
export function getPlanLimits(tier: PlanTier): PlanLimits {
  return PLANS[tier]?.limits ?? PLANS.free.limits;
}
