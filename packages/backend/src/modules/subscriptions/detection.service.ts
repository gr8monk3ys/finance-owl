import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type SubscriptionCategory =
  | 'streaming'
  | 'music'
  | 'fitness'
  | 'software'
  | 'food_delivery'
  | 'news'
  | 'gaming'
  | 'productivity'
  | 'cloud_storage'
  | 'insurance'
  | 'utilities'
  | 'telecom'
  | 'education'
  | 'health'
  | 'finance'
  | 'other';

export interface DetectedSubscription {
  merchantName: string;
  normalizedMerchantName: string;
  name: string;
  estimatedAmount: number;
  frequency: string;
  nextExpectedDate: string;
  accountId: string | null;
  categoryId: string | null;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  category: SubscriptionCategory;
  isTrial: boolean;
  isCancelled: boolean;
  priceChange: PriceChangeInfo | null;
  annualCostProjection: number;
  occurrenceCount: number;
  firstSeenDate: string;
  lastSeenDate: string;
  amountHistory: number[];
}

export interface PriceChangeInfo {
  previousAmount: number;
  currentAmount: number;
  changePercent: number;
  direction: 'increase' | 'decrease';
}

export interface CancelledSubscription {
  merchantName: string;
  normalizedMerchantName: string;
  lastAmount: number;
  lastChargeDate: string;
  frequency: string;
  daysSinceLastCharge: number;
  missedCycles: number;
  totalSpent: number;
}

export interface DuplicateGroup {
  normalizedName: string;
  subscriptions: {
    merchantName: string;
    accountId: string | null;
    estimatedAmount: number;
    frequency: string;
  }[];
}

export interface DetectionResult {
  active: DetectedSubscription[];
  cancelled: CancelledSubscription[];
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface TransactionRecord {
  name: string;
  merchantName: string | null;
  amount: number;
  date: string;
  accountId: string;
  categoryId: string | null;
}

interface MerchantGroup {
  merchantName: string;
  normalizedName: string;
  name: string;
  accountId: string | null;
  categoryId: string | null;
  transactions: { date: string; amount: number }[];
}

interface AmountCluster {
  centroid: number;
  amounts: number[];
  transactions: { date: string; amount: number }[];
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCY_RANGES: { min: number; max: number; label: string; nominalDays: number }[] = [
  { min: 5, max: 10, label: 'weekly', nominalDays: 7 },
  { min: 11, max: 18, label: 'biweekly', nominalDays: 14 },
  { min: 25, max: 36, label: 'monthly', nominalDays: 30 },
  { min: 55, max: 70, label: 'bimonthly', nominalDays: 60 },
  { min: 80, max: 100, label: 'quarterly', nominalDays: 90 },
  { min: 170, max: 200, label: 'semiannual', nominalDays: 182 },
  { min: 340, max: 400, label: 'annual', nominalDays: 365 },
];

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
  quarterly: 90,
  semiannual: 182,
  annual: 365,
};

const FREQUENCY_ANNUAL_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  bimonthly: 6,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

/** Amount tolerance for clustering similar charges (5%) */
const AMOUNT_CLUSTER_TOLERANCE = 0.05;

/** Coefficient of variation ceiling: reject groups above this (30% for variable bills) */
const MAX_CV_FOR_VARIABLE_BILLS = 0.3;

/** CV threshold for fixed-price subscriptions */
const FIXED_PRICE_CV_THRESHOLD = 0.05;

/** How many expected cycles past the last charge before we declare cancelled */
const CANCELLATION_MISSED_CYCLES = 1.5;

/** Maximum days to consider a trial */
const TRIAL_MAX_DAYS = 45;
const TRIAL_MAX_TRANSACTIONS = 2;

/** Price change detection threshold (%) */
const PRICE_CHANGE_THRESHOLD_PERCENT = 5;

/**
 * Maps merchant name keywords to subscription categories.
 * Ordered from most-specific to least-specific within each category.
 */
const CATEGORY_KEYWORDS: [string, SubscriptionCategory][] = [
  // Streaming
  ['netflix', 'streaming'],
  ['hulu', 'streaming'],
  ['disney+', 'streaming'],
  ['disney plus', 'streaming'],
  ['hbo max', 'streaming'],
  ['hbo', 'streaming'],
  ['paramount+', 'streaming'],
  ['paramount plus', 'streaming'],
  ['peacock', 'streaming'],
  ['apple tv', 'streaming'],
  ['crunchyroll', 'streaming'],
  ['prime video', 'streaming'],
  ['funimation', 'streaming'],
  ['mubi', 'streaming'],
  ['criterion', 'streaming'],
  ['discovery+', 'streaming'],
  ['showtime', 'streaming'],
  ['starz', 'streaming'],
  ['britbox', 'streaming'],
  ['curiosity stream', 'streaming'],
  ['youtube premium', 'streaming'],
  // Music
  ['spotify', 'music'],
  ['apple music', 'music'],
  ['youtube music', 'music'],
  ['tidal', 'music'],
  ['deezer', 'music'],
  ['pandora', 'music'],
  ['amazon music', 'music'],
  ['soundcloud', 'music'],
  ['audible', 'music'],
  ['sirius', 'music'],
  ['siriusxm', 'music'],
  // Fitness
  ['planet fitness', 'fitness'],
  ['orangetheory', 'fitness'],
  ['peloton', 'fitness'],
  ['la fitness', 'fitness'],
  ['24 hour fitness', 'fitness'],
  ['anytime fitness', 'fitness'],
  ['equinox', 'fitness'],
  ['gold gym', 'fitness'],
  ['golds gym', 'fitness'],
  ['crossfit', 'fitness'],
  ['classpass', 'fitness'],
  ['strava', 'fitness'],
  ['fitbit', 'fitness'],
  ['myfitnesspal', 'fitness'],
  ['noom', 'fitness'],
  ['whoop', 'fitness'],
  // Software / SaaS
  ['adobe', 'software'],
  ['creative cloud', 'software'],
  ['jetbrains', 'software'],
  ['figma', 'software'],
  ['sketch', 'software'],
  ['github', 'software'],
  ['gitlab', 'software'],
  ['bitbucket', 'software'],
  ['1password', 'software'],
  ['lastpass', 'software'],
  ['dashlane', 'software'],
  ['nordvpn', 'software'],
  ['expressvpn', 'software'],
  ['surfshark', 'software'],
  ['protonvpn', 'software'],
  ['bitwarden', 'software'],
  ['hover', 'software'],
  ['namecheap', 'software'],
  ['godaddy', 'software'],
  ['cloudflare', 'software'],
  ['vercel', 'software'],
  ['heroku', 'software'],
  ['digitalocean', 'software'],
  ['aws', 'software'],
  ['openai', 'software'],
  ['chatgpt', 'software'],
  ['anthropic', 'software'],
  ['claude', 'software'],
  // Food Delivery
  ['doordash', 'food_delivery'],
  ['uber eats', 'food_delivery'],
  ['grubhub', 'food_delivery'],
  ['postmates', 'food_delivery'],
  ['instacart', 'food_delivery'],
  ['hellofresh', 'food_delivery'],
  ['blue apron', 'food_delivery'],
  ['factor', 'food_delivery'],
  ['freshly', 'food_delivery'],
  ['daily harvest', 'food_delivery'],
  // News / Media
  ['new york times', 'news'],
  ['nytimes', 'news'],
  ['wall street journal', 'news'],
  ['wsj', 'news'],
  ['washington post', 'news'],
  ['bloomberg', 'news'],
  ['economist', 'news'],
  ['atlantic', 'news'],
  ['substack', 'news'],
  ['medium', 'news'],
  ['the information', 'news'],
  ['wired', 'news'],
  ['ars technica', 'news'],
  // Gaming
  ['xbox game pass', 'gaming'],
  ['playstation plus', 'gaming'],
  ['ps plus', 'gaming'],
  ['psn', 'gaming'],
  ['nintendo switch online', 'gaming'],
  ['ea play', 'gaming'],
  ['xbox live', 'gaming'],
  ['steam', 'gaming'],
  ['twitch', 'gaming'],
  ['discord', 'gaming'],
  ['humble bundle', 'gaming'],
  // Productivity
  ['microsoft 365', 'productivity'],
  ['office 365', 'productivity'],
  ['office', 'productivity'],
  ['notion', 'productivity'],
  ['evernote', 'productivity'],
  ['todoist', 'productivity'],
  ['asana', 'productivity'],
  ['slack', 'productivity'],
  ['zoom', 'productivity'],
  ['grammarly', 'productivity'],
  ['canva', 'productivity'],
  ['linear', 'productivity'],
  ['monday.com', 'productivity'],
  ['clickup', 'productivity'],
  ['trello', 'productivity'],
  // Cloud Storage
  ['google one', 'cloud_storage'],
  ['icloud', 'cloud_storage'],
  ['dropbox', 'cloud_storage'],
  ['onedrive', 'cloud_storage'],
  ['one drive', 'cloud_storage'],
  ['box', 'cloud_storage'],
  ['backblaze', 'cloud_storage'],
  // Insurance
  ['state farm', 'insurance'],
  ['geico', 'insurance'],
  ['progressive', 'insurance'],
  ['allstate', 'insurance'],
  ['liberty mutual', 'insurance'],
  ['usaa', 'insurance'],
  ['farmers insurance', 'insurance'],
  ['nationwide', 'insurance'],
  ['metlife', 'insurance'],
  ['aetna', 'insurance'],
  ['cigna', 'insurance'],
  ['united health', 'insurance'],
  ['unitedhealth', 'insurance'],
  ['anthem', 'insurance'],
  ['blue cross', 'insurance'],
  ['blue shield', 'insurance'],
  ['kaiser', 'insurance'],
  ['lemonade', 'insurance'],
  // Utilities
  ['electric', 'utilities'],
  ['power', 'utilities'],
  ['energy', 'utilities'],
  ['water', 'utilities'],
  ['gas', 'utilities'],
  ['sewage', 'utilities'],
  ['waste', 'utilities'],
  ['utility', 'utilities'],
  ['utilities', 'utilities'],
  ['pgande', 'utilities'],
  ['pg&e', 'utilities'],
  ['conedison', 'utilities'],
  ['con edison', 'utilities'],
  ['duke energy', 'utilities'],
  ['dominion', 'utilities'],
  ['southern company', 'utilities'],
  // Telecom
  ['verizon', 'telecom'],
  ['t-mobile', 'telecom'],
  ['at&t', 'telecom'],
  ['att', 'telecom'],
  ['sprint', 'telecom'],
  ['comcast', 'telecom'],
  ['xfinity', 'telecom'],
  ['spectrum', 'telecom'],
  ['cox', 'telecom'],
  ['centurylink', 'telecom'],
  ['frontier', 'telecom'],
  ['google fi', 'telecom'],
  ['mint mobile', 'telecom'],
  ['visible', 'telecom'],
  // Education
  ['coursera', 'education'],
  ['udemy', 'education'],
  ['skillshare', 'education'],
  ['masterclass', 'education'],
  ['brilliant', 'education'],
  ['duolingo', 'education'],
  ['linkedin learning', 'education'],
  ['pluralsight', 'education'],
  ['codecademy', 'education'],
  ['udacity', 'education'],
  // Health
  ['headspace', 'health'],
  ['calm', 'health'],
  ['betterhelp', 'health'],
  ['talkspace', 'health'],
  ['nurx', 'health'],
  ['hims', 'health'],
  ['hers', 'health'],
  ['cerebral', 'health'],
  // Finance
  ['robinhood', 'finance'],
  ['acorns', 'finance'],
  ['betterment', 'finance'],
  ['wealthfront', 'finance'],
  ['ynab', 'finance'],
  ['mint', 'finance'],
  ['personal capital', 'finance'],
  ['quicken', 'finance'],
  ['quickbooks', 'finance'],
  ['turbotax', 'finance'],
  ['credit karma', 'finance'],
  ['experian', 'finance'],
];

/**
 * Known subscription service names for normalizing merchant name variants.
 * Key = lowercased variant, value = canonical name.
 */
const KNOWN_SERVICES: Record<string, string> = {
  // Netflix
  netflix: 'netflix',
  'netflix.com': 'netflix',
  'netflix inc': 'netflix',
  'netflix.com inc': 'netflix',
  'netflix digital': 'netflix',
  // Spotify
  spotify: 'spotify',
  'spotify usa': 'spotify',
  'spotify ab': 'spotify',
  'spotify premium': 'spotify',
  'spotify technology': 'spotify',
  // Hulu
  hulu: 'hulu',
  'hulu llc': 'hulu',
  'hulu.com': 'hulu',
  // Disney+
  'disney+': 'disney+',
  'disney plus': 'disney+',
  disneyplus: 'disney+',
  'walt disney': 'disney+',
  'disney streaming': 'disney+',
  // Amazon
  'amazon prime': 'amazon prime',
  'amzn prime': 'amazon prime',
  'prime membership': 'amazon prime',
  'amazon prime*': 'amazon prime',
  'amzn mktp': 'amazon',
  'amazon.com': 'amazon',
  'amazon digital': 'amazon',
  // Apple
  'apple music': 'apple music',
  'apple.com/bill': 'apple services',
  'apple.com': 'apple services',
  itunes: 'apple services',
  'apple tv+': 'apple tv+',
  'apple tv plus': 'apple tv+',
  'apple icloud': 'icloud',
  icloud: 'icloud',
  'apple one': 'apple one',
  // Adobe
  adobe: 'adobe',
  'adobe systems': 'adobe',
  'adobe inc': 'adobe',
  'adobe creative': 'adobe',
  // YouTube
  'youtube premium': 'youtube premium',
  'youtube music': 'youtube music',
  'google youtube': 'youtube premium',
  'google*youtube': 'youtube premium',
  // Microsoft
  microsoft: 'microsoft 365',
  msft: 'microsoft 365',
  'microsoft 365': 'microsoft 365',
  'office 365': 'microsoft 365',
  xbox: 'xbox',
  'xbox game pass': 'xbox game pass',
  'xbox live': 'xbox live',
  // Google
  'google one': 'google one',
  'google storage': 'google one',
  'google play': 'google play',
  'google*': 'google services',
  // HBO
  'hbo max': 'hbo max',
  hbo: 'hbo max',
  max: 'hbo max',
};

/**
 * Patterns to strip from merchant names during normalization.
 * Applied in order.
 */
const MERCHANT_STRIP_PATTERNS: RegExp[] = [
  /\s*#\d+$/, // Store numbers: "Planet Fitness #1234"
  /\s*store\s*\d+$/i, // "Store 123"
  /\s*-\s*\d+$/, // "Merchant - 1234"
  /\s+\d{4,}$/, // Trailing long numbers
  /\*[a-z0-9]+$/i, // "GOOGLE*YOUTUBE" -> strip *YOUTUBE handled separately
  /\s+(inc|llc|ltd|co|corp|corporation|gmbh|ag|plc|lp|sa|sarl|srl|bv|nv)\.?$/i,
  /\s+(subscription|membership|monthly|annual|premium|basic|pro|plus|service)$/i,
  /\s+(payment|billing|bill|recurring|auto-pay|autopay)$/i,
  /\.com$/i,
  /[®™©]/g,
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name);

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Main entry point: scan a user's transaction history, detect recurring
   * patterns, identify cancellations, and persist results.
   */
  async detectForUser(userId: string): Promise<DetectedSubscription[]> {
    const userTransactions = await this.db
      .select({
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        accountId: schema.transactions.accountId,
        categoryId: schema.transactions.categoryId,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.pending, false)))
      .orderBy(desc(schema.transactions.date));

    if (userTransactions.length === 0) {
      return [];
    }

    const result = this.analyzeTransactions(userTransactions);

    await this.upsertDetected(userId, result.active);

    this.logger.log(
      `Detected ${result.active.length} active and ${result.cancelled.length} cancelled recurring transactions for user ${userId}`,
    );

    return result.active;
  }

  /**
   * Full detection including cancelled subscriptions.
   */
  async detectFullForUser(userId: string): Promise<DetectionResult> {
    const userTransactions = await this.db
      .select({
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        date: schema.transactions.date,
        accountId: schema.transactions.accountId,
        categoryId: schema.transactions.categoryId,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.pending, false)))
      .orderBy(desc(schema.transactions.date));

    if (userTransactions.length === 0) {
      return { active: [], cancelled: [], totalMonthlyEstimate: 0, totalAnnualEstimate: 0 };
    }

    const result = this.analyzeTransactions(userTransactions);

    await this.upsertDetected(userId, result.active);

    this.logger.log(
      `Detected ${result.active.length} active and ${result.cancelled.length} cancelled recurring transactions for user ${userId}`,
    );

    return result;
  }

  /**
   * Pure analysis function -- no database access.
   * This is the core algorithm, fully testable without mocks.
   */
  analyzeTransactions(transactions: TransactionRecord[], referenceDate?: Date): DetectionResult {
    const now = referenceDate ?? new Date();
    const groups = this.groupByNormalizedMerchant(transactions);
    const active: DetectedSubscription[] = [];
    const cancelled: CancelledSubscription[] = [];

    for (const group of groups) {
      if (group.transactions.length < 2) {
        continue;
      }

      // Filter out refunds (positive amounts in bank-negative-is-charge convention,
      // or negative amounts if charges are positive). We take the majority sign direction.
      const charges = this.filterRefunds(group.transactions);
      if (charges.length < 2) {
        continue;
      }

      // Cluster amounts to handle variable bills and distinguish
      // multiple subscription tiers from the same merchant.
      const clusters = this.clusterAmounts(charges);

      for (const cluster of clusters) {
        if (cluster.transactions.length < 2) {
          continue;
        }

        const result = this.analyzeCluster(group, cluster, now);
        if (!result) {
          continue;
        }

        if (result.type === 'active') {
          active.push(result.subscription);
        } else {
          cancelled.push(result.cancellation);
        }
      }
    }

    // Sort active by confidence descending
    active.sort((a, b) => b.confidenceScore - a.confidenceScore);

    // Calculate totals
    const totalAnnualEstimate = active.reduce((sum, s) => sum + s.annualCostProjection, 0);
    const totalMonthlyEstimate = Math.round((totalAnnualEstimate / 12) * 100) / 100;

    return {
      active,
      cancelled,
      totalMonthlyEstimate,
      totalAnnualEstimate: Math.round(totalAnnualEstimate * 100) / 100,
    };
  }

  /**
   * Detect potential duplicate subscriptions across different accounts.
   */
  async detectDuplicates(userId: string): Promise<DuplicateGroup[]> {
    const subscriptions = await this.db
      .select({
        id: schema.recurringTransactions.id,
        name: schema.recurringTransactions.name,
        merchantName: schema.recurringTransactions.merchantName,
        accountId: schema.recurringTransactions.accountId,
        estimatedAmount: schema.recurringTransactions.estimatedAmount,
        frequency: schema.recurringTransactions.frequency,
      })
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, userId),
          eq(schema.recurringTransactions.isActive, true),
        ),
      );

    const serviceMap = new Map<string, DuplicateGroup['subscriptions']>();

    for (const sub of subscriptions) {
      const normalizedName = this.normalizeServiceName(sub.merchantName ?? sub.name);

      if (!serviceMap.has(normalizedName)) {
        serviceMap.set(normalizedName, []);
      }
      serviceMap.get(normalizedName)!.push({
        merchantName: sub.merchantName ?? sub.name,
        accountId: sub.accountId,
        estimatedAmount: sub.estimatedAmount,
        frequency: sub.frequency,
      });
    }

    const duplicates: DuplicateGroup[] = [];
    for (const [normalizedName, subs] of serviceMap.entries()) {
      if (subs.length > 1) {
        duplicates.push({ normalizedName, subscriptions: subs });
      }
    }

    return duplicates;
  }

  // ─── Merchant Name Normalization ──────────────────────────────────────────

  /**
   * Normalize a raw merchant name for grouping purposes.
   * Strips store numbers, suffixes, normalizes case, handles common variations.
   */
  normalizeMerchantName(raw: string): string {
    let name = raw.trim();

    // Handle ALLCAPS names from bank feeds: "NETFLIX.COM" -> "netflix.com"
    name = name.toLowerCase();

    // Handle asterisk-separated names: "GOOGLE*YOUTUBE PREMIUM" -> "youtube premium"
    if (name.includes('*')) {
      const parts = name.split('*');
      // Use the part after asterisk as it's usually more specific
      name = parts[parts.length - 1].trim();
    }

    // Apply stripping patterns
    for (const pattern of MERCHANT_STRIP_PATTERNS) {
      name = name.replace(pattern, '');
    }

    // Remove extra whitespace
    name = name.replace(/\s+/g, ' ').trim();

    // Remove leading/trailing special characters
    name = name.replace(/^[^a-z0-9]+|[^a-z0-9+]+$/gi, '').trim();

    return name;
  }

  /**
   * Normalize a merchant name to a known service identifier.
   * Used for duplicate detection across name variants.
   */
  normalizeServiceName(merchantName: string): string {
    const normalized = this.normalizeMerchantName(merchantName);

    // Direct match in known services
    if (KNOWN_SERVICES[normalized]) {
      return KNOWN_SERVICES[normalized];
    }

    // Check if the normalized name contains a known service key
    for (const [key, service] of Object.entries(KNOWN_SERVICES)) {
      if (key.endsWith('*')) {
        // Wildcard match: "google*" matches "google play", "google one", etc.
        const prefix = key.slice(0, -1);
        if (normalized.startsWith(prefix)) {
          return service;
        }
      }
      if (normalized === key || normalized.includes(key)) {
        return service;
      }
    }

    // Check if any known service key contains our normalized name (for short names)
    for (const [key, service] of Object.entries(KNOWN_SERVICES)) {
      if (key.includes(normalized) && normalized.length >= 4) {
        return service;
      }
    }

    // Fallback: strip remaining common suffixes
    return normalized
      .replace(/\s+(inc|llc|ltd|co|corp|subscription|membership)\.?$/i, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Assign a subscription category based on merchant name keywords.
   */
  assignCategory(merchantName: string): SubscriptionCategory {
    const normalized = merchantName.toLowerCase().trim();

    for (const [keyword, category] of CATEGORY_KEYWORDS) {
      if (normalized === keyword || normalized.includes(keyword) || keyword.includes(normalized)) {
        return category;
      }
    }

    return 'other';
  }

  // ─── Trial Detection ──────────────────────────────────────────────────────

  /**
   * Detect if a subscription might be a trial.
   * A trial is indicated by:
   * - Very few charges (1-2)
   * - First charge is recent (within TRIAL_MAX_DAYS)
   * - OR first charge was $0 / very low and subsequent charges are higher
   */
  detectTrial(
    sortedTransactions: { date: string; amount: number }[],
    referenceDate?: Date,
  ): boolean {
    if (sortedTransactions.length === 0) {
      return false;
    }

    const now = referenceDate ?? new Date();

    // Check for $0 or very cheap introductory charge followed by normal charges
    const firstAmount = Math.abs(sortedTransactions[0].amount);
    if (sortedTransactions.length >= 2) {
      const secondAmount = Math.abs(sortedTransactions[1].amount);
      if (firstAmount < 1.0 && secondAmount >= 1.0) {
        return true;
      }
      // Significant discount on first charge (e.g., first month $1.99, then $14.99)
      if (secondAmount > 0 && firstAmount < secondAmount * 0.3) {
        return true;
      }
    }

    // Few charges and recent start
    if (sortedTransactions.length > TRIAL_MAX_TRANSACTIONS) {
      return false;
    }

    const firstChargeDate = this.parseTransactionDate(sortedTransactions[0].date);
    const daysSinceFirst = Math.round(
      (now.getTime() - firstChargeDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysSinceFirst <= TRIAL_MAX_DAYS;
  }

  // ─── Price Change Detection ───────────────────────────────────────────────

  /**
   * Detect price changes by comparing the most recent charge(s)
   * to the historical baseline (excluding recent charges).
   * Uses a windowed approach to avoid false positives from outliers.
   */
  detectPriceChange(
    sortedTransactions: { date: string; amount: number }[],
  ): PriceChangeInfo | null {
    if (sortedTransactions.length < 3) {
      return null;
    }

    const amounts = sortedTransactions.map((t) => Math.abs(t.amount));

    // Use the last 1-2 charges as "current" and everything before as "previous"
    const recentWindow = amounts.length >= 6 ? 2 : 1;
    const recentAmounts = amounts.slice(-recentWindow);
    const previousAmounts = amounts.slice(0, -recentWindow);

    if (previousAmounts.length === 0) {
      return null;
    }

    const recentMean = recentAmounts.reduce((s, a) => s + a, 0) / recentAmounts.length;
    const previousMedian = this.median(previousAmounts);

    if (previousMedian === 0) {
      return null;
    }

    const changePercent = ((recentMean - previousMedian) / previousMedian) * 100;

    if (Math.abs(changePercent) > PRICE_CHANGE_THRESHOLD_PERCENT) {
      return {
        previousAmount: Math.round(previousMedian * 100) / 100,
        currentAmount: Math.round(recentMean * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        direction: changePercent > 0 ? 'increase' : 'decrease',
      };
    }

    return null;
  }

  // ─── Cancellation Detection ───────────────────────────────────────────────

  /**
   * Determine if a recurring charge has stopped (been cancelled).
   * Returns true if more than CANCELLATION_MISSED_CYCLES expected intervals
   * have passed since the last charge.
   */
  detectCancellation(lastChargeDate: Date, frequencyDays: number, referenceDate?: Date): boolean {
    const now = referenceDate ?? new Date();
    const daysSinceLastCharge = Math.round(
      (now.getTime() - lastChargeDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysSinceLastCharge > frequencyDays * CANCELLATION_MISSED_CYCLES;
  }

  // ─── Statistical Helpers (public for testing) ─────────────────────────────

  median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Interquartile range -- used for robust outlier detection.
   */
  iqr(values: number[]): { q1: number; q3: number; iqr: number } {
    const sorted = values.slice().sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    return { q1, q3, iqr: q3 - q1 };
  }

  /**
   * Confidence scoring based on multiple factors:
   * - Amount consistency (0-35 points)
   * - Interval regularity (0-35 points)
   * - Number of occurrences (0-20 points)
   * - Merchant name recognition (0-10 points)
   */
  calculateConfidence(
    sorted: { date: string; amount: number }[],
    intervals: number[],
    frequency: string,
    meanAmount: number,
    stdDev: number,
    merchantName: string,
  ): { confidence: ConfidenceLevel; score: number } {
    let score = 0;

    // ── Amount consistency: 0-35 points ─────────────────────────────────
    const cv = meanAmount > 0 ? stdDev / meanAmount : 1;
    if (cv === 0) {
      score += 35;
    } else if (cv < 0.02) {
      score += 32;
    } else if (cv < FIXED_PRICE_CV_THRESHOLD) {
      score += 28;
    } else if (cv < 0.1) {
      score += 22;
    } else if (cv < 0.2) {
      score += 15;
    } else {
      score += 8;
    }

    // ── Interval regularity: 0-35 points ────────────────────────────────
    const expectedInterval = FREQUENCY_DAYS[frequency] ?? 30;
    if (intervals.length > 0) {
      const intervalDeviations = intervals.map((i) => Math.abs(i - expectedInterval));
      const medianDeviation = this.median(intervalDeviations);

      if (medianDeviation <= 1) {
        score += 35;
      } else if (medianDeviation <= 3) {
        score += 30;
      } else if (medianDeviation <= 5) {
        score += 22;
      } else if (medianDeviation <= 8) {
        score += 15;
      } else {
        score += 8;
      }
    }

    // ── Number of occurrences: 0-20 points ──────────────────────────────
    const txCount = sorted.length;
    if (txCount >= 12) {
      score += 20;
    } else if (txCount >= 6) {
      score += 17;
    } else if (txCount >= 4) {
      score += 13;
    } else if (txCount >= 3) {
      score += 9;
    } else {
      score += 4;
    }

    // ── Merchant name recognition: 0-10 points ─────────────────────────
    const category = this.assignCategory(merchantName);
    if (category !== 'other') {
      score += 10;
    } else {
      // Check if it's a known service
      const normalized = this.normalizeMerchantName(merchantName);
      if (KNOWN_SERVICES[normalized]) {
        score += 7;
      } else {
        score += 0;
      }
    }

    let confidence: ConfidenceLevel;
    if (score >= 75) {
      confidence = 'high';
    } else if (score >= 50) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { confidence, score };
  }

  // ─── Private: Grouping ────────────────────────────────────────────────────

  private groupByNormalizedMerchant(transactions: TransactionRecord[]): MerchantGroup[] {
    const map = new Map<string, MerchantGroup>();

    for (const tx of transactions) {
      const rawName = tx.merchantName ?? tx.name;
      const normalizedKey = this.normalizeMerchantName(rawName);

      if (!map.has(normalizedKey)) {
        map.set(normalizedKey, {
          merchantName: rawName,
          normalizedName: normalizedKey,
          name: tx.name,
          accountId: tx.accountId,
          categoryId: tx.categoryId,
          transactions: [],
        });
      }

      map.get(normalizedKey)!.transactions.push({
        date: tx.date,
        amount: tx.amount,
      });
    }

    return Array.from(map.values());
  }

  // ─── Private: Refund filtering ────────────────────────────────────────────

  /**
   * Filter out refunds from a set of transactions.
   * Determines the dominant sign direction and removes transactions
   * in the opposite direction (those are likely refunds).
   */
  private filterRefunds(
    transactions: { date: string; amount: number }[],
  ): { date: string; amount: number }[] {
    if (transactions.length === 0) return [];

    // Determine dominant sign
    const positiveCount = transactions.filter((t) => t.amount > 0).length;
    const negativeCount = transactions.filter((t) => t.amount < 0).length;

    if (positiveCount === 0 && negativeCount === 0) return [];

    // If all same sign, return all
    if (positiveCount === 0 || negativeCount === 0) {
      return transactions;
    }

    // The dominant sign is the direction of charges
    const dominantIsPositive = positiveCount >= negativeCount;

    return transactions.filter((t) => (dominantIsPositive ? t.amount > 0 : t.amount < 0));
  }

  // ─── Private: Amount Clustering ───────────────────────────────────────────

  /**
   * Group transactions by similar amounts using single-linkage clustering.
   * This handles:
   * - Variable bills (utility, phone) where amounts fluctuate within ~5%
   * - Multiple subscription tiers from same merchant (individual vs family plan)
   * - Price changes over time
   */
  clusterAmounts(transactions: { date: string; amount: number }[]): AmountCluster[] {
    if (transactions.length === 0) return [];

    const sorted = transactions.slice().sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));

    const clusters: AmountCluster[] = [];
    let currentCluster: AmountCluster = {
      centroid: Math.abs(sorted[0].amount),
      amounts: [Math.abs(sorted[0].amount)],
      transactions: [sorted[0]],
    };

    for (let i = 1; i < sorted.length; i++) {
      const amount = Math.abs(sorted[i].amount);
      const tolerance = currentCluster.centroid * AMOUNT_CLUSTER_TOLERANCE;
      const maxTolerance = Math.max(tolerance, 0.5); // Minimum $0.50 tolerance

      if (Math.abs(amount - currentCluster.centroid) <= maxTolerance) {
        currentCluster.amounts.push(amount);
        currentCluster.transactions.push(sorted[i]);
        // Update centroid
        currentCluster.centroid =
          currentCluster.amounts.reduce((s, a) => s + a, 0) / currentCluster.amounts.length;
      } else {
        clusters.push(currentCluster);
        currentCluster = {
          centroid: amount,
          amounts: [amount],
          transactions: [sorted[i]],
        };
      }
    }
    clusters.push(currentCluster);

    return clusters;
  }

  // ─── Private: Core Analysis ───────────────────────────────────────────────

  private analyzeCluster(
    group: MerchantGroup,
    cluster: AmountCluster,
    referenceDate: Date,
  ):
    | { type: 'active'; subscription: DetectedSubscription }
    | { type: 'cancelled'; cancellation: CancelledSubscription }
    | null {
    const sorted = cluster.transactions
      .slice()
      .sort(
        (a, b) =>
          this.parseTransactionDate(a.date).getTime() - this.parseTransactionDate(b.date).getTime(),
      );

    // Calculate intervals between consecutive transactions (in days)
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = this.parseTransactionDate(sorted[i - 1].date).getTime();
      const curr = this.parseTransactionDate(sorted[i].date).getTime();
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) {
      return null;
    }

    // Remove outlier intervals using IQR method (if enough data points)
    const cleanedIntervals = this.removeIntervalOutliers(intervals);
    if (cleanedIntervals.length === 0) {
      return null;
    }

    const medianInterval = this.median(cleanedIntervals);
    const frequency = this.mapToFrequency(medianInterval);

    if (!frequency) {
      return null;
    }

    const frequencyDays = FREQUENCY_DAYS[frequency];

    // Check amount consistency
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const meanAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const stdDev = this.standardDeviation(amounts);
    const cv = meanAmount > 0 ? stdDev / meanAmount : 1;

    if (cv >= MAX_CV_FOR_VARIABLE_BILLS) {
      return null;
    }

    // Check for cancellation
    const lastChargeDate = this.parseTransactionDate(sorted[sorted.length - 1].date);
    const isCancelled = this.detectCancellation(lastChargeDate, frequencyDays, referenceDate);

    if (isCancelled) {
      const daysSinceLastCharge = Math.round(
        (referenceDate.getTime() - lastChargeDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const totalSpent = amounts.reduce((s, a) => s + a, 0);

      return {
        type: 'cancelled',
        cancellation: {
          merchantName: group.merchantName,
          normalizedMerchantName: group.normalizedName,
          lastAmount: Math.round(amounts[amounts.length - 1] * 100) / 100,
          lastChargeDate: sorted[sorted.length - 1].date,
          frequency,
          daysSinceLastCharge,
          missedCycles: Math.floor(daysSinceLastCharge / frequencyDays),
          totalSpent: Math.round(totalSpent * 100) / 100,
        },
      };
    }

    // Calculate confidence
    const { confidence, score } = this.calculateConfidence(
      sorted,
      cleanedIntervals,
      frequency,
      meanAmount,
      stdDev,
      group.merchantName,
    );

    // Determine category
    const category = this.assignCategory(group.merchantName);

    // Detect trial
    const isTrial = this.detectTrial(sorted, referenceDate);

    // Detect price change
    const priceChange = this.detectPriceChange(sorted);

    // Use the most recent amount as the estimated amount (not mean)
    // to account for price changes
    const currentAmount = priceChange
      ? priceChange.currentAmount
      : Math.round(meanAmount * 100) / 100;

    // Calculate next expected date
    const nextDate = this.calculateNextDate(lastChargeDate, frequency);

    // Annual cost projection
    const annualMultiplier = FREQUENCY_ANNUAL_MULTIPLIER[frequency] ?? 12;
    const annualCostProjection = Math.round(currentAmount * annualMultiplier * 100) / 100;

    return {
      type: 'active',
      subscription: {
        merchantName: group.merchantName,
        normalizedMerchantName: group.normalizedName,
        name: group.name,
        estimatedAmount: currentAmount,
        frequency,
        nextExpectedDate: this.formatDateOnly(nextDate),
        accountId: group.accountId,
        categoryId: group.categoryId,
        confidence,
        confidenceScore: score,
        category,
        isTrial,
        isCancelled: false,
        priceChange,
        annualCostProjection,
        occurrenceCount: sorted.length,
        firstSeenDate: sorted[0].date,
        lastSeenDate: sorted[sorted.length - 1].date,
        amountHistory: amounts,
      },
    };
  }

  // ─── Private: Interval Analysis ───────────────────────────────────────────

  /**
   * Remove outlier intervals using IQR method.
   * This handles skipped months, vacations, etc.
   */
  private removeIntervalOutliers(intervals: number[]): number[] {
    if (intervals.length <= 2) {
      return intervals;
    }

    const { q1, q3, iqr: iqrValue } = this.iqr(intervals);
    const lowerBound = q1 - 1.5 * iqrValue;
    const upperBound = q3 + 1.5 * iqrValue;

    const cleaned = intervals.filter((i) => i >= lowerBound && i <= upperBound);

    // If we removed everything, fall back to original
    return cleaned.length > 0 ? cleaned : intervals;
  }

  private mapToFrequency(medianDays: number): string | null {
    for (const range of FREQUENCY_RANGES) {
      if (medianDays >= range.min && medianDays <= range.max) {
        return range.label;
      }
    }
    return null;
  }

  /**
   * Calculate the next expected charge date based on the last charge and frequency.
   * Uses calendar-aware logic for monthly+ frequencies.
   */
  private calculateNextDate(lastChargeDate: Date, frequency: string): Date {
    const next = new Date(lastChargeDate);

    switch (frequency) {
      case 'weekly':
        next.setUTCDate(next.getUTCDate() + 7);
        break;
      case 'biweekly':
        next.setUTCDate(next.getUTCDate() + 14);
        break;
      case 'monthly':
        next.setUTCMonth(next.getUTCMonth() + 1);
        break;
      case 'bimonthly':
        next.setUTCMonth(next.getUTCMonth() + 2);
        break;
      case 'quarterly':
        next.setUTCMonth(next.getUTCMonth() + 3);
        break;
      case 'semiannual':
        next.setUTCMonth(next.getUTCMonth() + 6);
        break;
      case 'annual':
        next.setUTCFullYear(next.getUTCFullYear() + 1);
        break;
      default:
        next.setUTCDate(next.getUTCDate() + (FREQUENCY_DAYS[frequency] ?? 30));
    }

    return next;
  }

  private parseTransactionDate(value: string): Date {
    if (DATE_ONLY_PATTERN.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }

    return new Date(value);
  }

  private formatDateOnly(value: Date): string {
    return value.toISOString().split('T')[0];
  }

  // ─── Private: Persistence ─────────────────────────────────────────────────

  private async upsertDetected(userId: string, detected: DetectedSubscription[]): Promise<void> {
    for (const sub of detected) {
      const merchantKey = sub.normalizedMerchantName;

      const existing = await this.db
        .select({ id: schema.recurringTransactions.id })
        .from(schema.recurringTransactions)
        .where(
          and(
            eq(schema.recurringTransactions.userId, userId),
            eq(schema.recurringTransactions.merchantName, merchantKey),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(schema.recurringTransactions)
          .set({
            estimatedAmount: sub.estimatedAmount,
            frequency: sub.frequency,
            nextExpectedDate: sub.nextExpectedDate,
            updatedAt: new Date(),
          })
          .where(eq(schema.recurringTransactions.id, existing[0].id));
      } else {
        await this.db.insert(schema.recurringTransactions).values({
          userId,
          accountId: sub.accountId,
          categoryId: sub.categoryId,
          name: sub.name,
          merchantName: merchantKey,
          estimatedAmount: sub.estimatedAmount,
          frequency: sub.frequency,
          nextExpectedDate: sub.nextExpectedDate,
          isActive: true,
          isConfirmed: false,
        });
      }
    }
  }
}
