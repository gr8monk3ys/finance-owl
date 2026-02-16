import { Injectable, Logger } from '@nestjs/common';
import {
  MERCHANT_DATABASE,
  MCC_DATABASE,
  KEYWORD_RULES,
  type MerchantEntry,
} from './merchant-database';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface CategoryResult {
  category: string;
  subcategory: string;
  confidence: number; // 0-1
  source: 'merchant_exact' | 'merchant_normalized' | 'user_override' | 'keyword' | 'mcc' | 'learned' | 'uncategorized';
}

export interface TransactionInput {
  id?: string;
  description: string;
  merchantName?: string | null;
  mcc?: string | null;
  amount?: number | null;
}

export interface UserCategoryOverride {
  merchantPattern: string;
  category: string;
  subcategory: string;
}

interface LearnedCorrection {
  normalizedMerchant: string;
  category: string;
  subcategory: string;
  count: number;
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CategorizationEngineService {
  private readonly logger = new Logger(CategorizationEngineService.name);

  /**
   * Pre-computed regex patterns for substring merchant matching.
   * Built once at construction time to avoid creating regexes on every call.
   */
  private readonly merchantSubstringPatterns: Array<{
    regex: RegExp;
    entry: MerchantEntry;
  }>;

  /**
   * In-memory store of user overrides keyed by userId.
   * In a production deployment this would be backed by the database
   * (categorizationRules table), but for the engine itself we keep
   * a fast in-memory index that the caller can populate.
   */
  private userOverrides: Map<string, UserCategoryOverride[]> = new Map();

  /**
   * In-memory store of learned corrections keyed by userId.
   * Tracks how users have re-categorized specific merchants so
   * future transactions from the same merchant use the correction.
   */
  private learnedCorrections: Map<string, LearnedCorrection[]> = new Map();

  constructor() {
    // Pre-compute regex patterns for all merchant DB keys >= 4 chars
    this.merchantSubstringPatterns = [];
    for (const [merchantKey, entry] of Object.entries(MERCHANT_DATABASE)) {
      if (merchantKey.length >= 4) {
        const escaped = merchantKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        this.merchantSubstringPatterns.push({
          regex: new RegExp(`(?:^|\\s|\\b)${escaped}(?:\\s|$|\\b)`),
          entry,
        });
      }
    }
  }

  // ── Single transaction ───────────────────────────────────────────────

  categorizeTransaction(
    description: string,
    merchantName?: string | null,
    mcc?: string | null,
    userId?: string | null,
  ): CategoryResult {
    const normalizedDesc = this.normalizeMerchant(description);
    const normalizedMerchant = merchantName
      ? this.normalizeMerchant(merchantName)
      : null;

    // 1. User overrides (highest priority)
    if (userId) {
      const overrideResult = this.tryUserOverride(
        userId,
        normalizedDesc,
        normalizedMerchant,
      );
      if (overrideResult) return overrideResult;
    }

    // 2. Learned corrections from past user behaviour
    if (userId) {
      const learnedResult = this.tryLearnedCorrection(
        userId,
        normalizedDesc,
        normalizedMerchant,
      );
      if (learnedResult) return learnedResult;
    }

    // 3. Exact merchant database lookup (merchant name first, then description)
    const exactResult = this.tryExactMerchantMatch(
      normalizedMerchant,
      normalizedDesc,
    );
    if (exactResult) return exactResult;

    // 4. Normalized / fuzzy merchant lookup
    const normalizedResult = this.tryNormalizedMerchantMatch(
      normalizedMerchant,
      normalizedDesc,
    );
    if (normalizedResult) return normalizedResult;

    // 5. Keyword matching
    const keywordResult = this.tryKeywordMatch(normalizedDesc, normalizedMerchant);
    if (keywordResult) return keywordResult;

    // 6. MCC code
    if (mcc) {
      const mccResult = this.tryMccMatch(mcc);
      if (mccResult) return mccResult;
    }

    // 7. Uncategorized
    return {
      category: 'Uncategorized',
      subcategory: 'Uncategorized',
      confidence: 0,
      source: 'uncategorized',
    };
  }

  // ── Bulk categorization ──────────────────────────────────────────────

  categorizeBulk(
    transactions: TransactionInput[],
    userId?: string | null,
  ): CategoryResult[] {
    return transactions.map((tx) =>
      this.categorizeTransaction(
        tx.description,
        tx.merchantName,
        tx.mcc,
        userId,
      ),
    );
  }

  // ── User overrides ──────────────────────────────────────────────────

  setUserCategoryOverride(
    userId: string,
    merchantPattern: string,
    category: string,
    subcategory: string,
  ): void {
    const overrides = this.userOverrides.get(userId) ?? [];
    const normalizedPattern = this.normalizeMerchant(merchantPattern);

    // Replace existing override for same pattern if present
    const existingIndex = overrides.findIndex(
      (o) => this.normalizeMerchant(o.merchantPattern) === normalizedPattern,
    );

    const entry: UserCategoryOverride = {
      merchantPattern: normalizedPattern,
      category,
      subcategory,
    };

    if (existingIndex >= 0) {
      overrides[existingIndex] = entry;
    } else {
      overrides.push(entry);
    }

    this.userOverrides.set(userId, overrides);
  }

  getUserOverrides(userId: string): UserCategoryOverride[] {
    return this.userOverrides.get(userId) ?? [];
  }

  removeUserOverride(userId: string, merchantPattern: string): boolean {
    const overrides = this.userOverrides.get(userId);
    if (!overrides) return false;

    const normalizedPattern = this.normalizeMerchant(merchantPattern);
    const before = overrides.length;
    const filtered = overrides.filter(
      (o) => this.normalizeMerchant(o.merchantPattern) !== normalizedPattern,
    );

    if (filtered.length === before) return false;

    this.userOverrides.set(userId, filtered);
    return true;
  }

  // ── Learning / corrections ──────────────────────────────────────────

  recordCorrection(
    userId: string,
    merchantNameOrDescription: string,
    category: string,
    subcategory: string,
  ): void {
    const corrections = this.learnedCorrections.get(userId) ?? [];
    const normalizedMerchant = this.normalizeMerchant(merchantNameOrDescription);

    const existing = corrections.find(
      (c) => c.normalizedMerchant === normalizedMerchant,
    );

    if (existing) {
      existing.category = category;
      existing.subcategory = subcategory;
      existing.count += 1;
    } else {
      corrections.push({
        normalizedMerchant,
        category,
        subcategory,
        count: 1,
      });
    }

    this.learnedCorrections.set(userId, corrections);
  }

  getLearnedCorrections(userId: string): LearnedCorrection[] {
    return this.learnedCorrections.get(userId) ?? [];
  }

  // ── Merchant name normalization ─────────────────────────────────────

  /**
   * Normalizes a merchant string for matching:
   *  - lowercase
   *  - strip common corporate suffixes (INC, LLC, CORP, LTD, CO, etc.)
   *  - strip store/location numbers (#1234, STORE 456, etc.)
   *  - strip trailing transaction IDs or dates
   *  - collapse whitespace
   *  - trim
   */
  normalizeMerchant(raw: string): string {
    let name = raw.toLowerCase().trim();

    // Remove common URL suffixes
    name = name.replace(/\.(com|net|org|io|co)\b/g, '');

    // Remove corporate suffixes
    name = name.replace(
      /\b(inc|llc|ltd|corp|corporation|incorporated|company|co|lp|plc|group|holdings|enterprises|international|intl|services|svcs)\b\.?/g,
      '',
    );

    // Remove store/location identifiers: #1234, store 456, STORE #2345, ste 7, unit 8
    name = name.replace(/\b(store|ste|unit|loc|location|branch|outlet)\s*#?\s*\d+/g, '');
    name = name.replace(/#\s*\d+/g, '');

    // Remove trailing numbers that look like store IDs (e.g., "SHELL 04517")
    name = name.replace(/\s+\d{3,}$/g, '');

    // Remove transaction reference patterns (dates, IDs)
    name = name.replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, '');
    name = name.replace(/\b(ref|txn|trn|id|auth|confirmation)\s*[#:]?\s*\w+/gi, '');

    // Remove "SQ *" prefix (Square POS)
    name = name.replace(/^sq\s*\*\s*/g, '');

    // Remove "TST*" prefix (Toast POS)
    name = name.replace(/^tst\s*\*\s*/g, '');

    // Remove asterisks used as separators
    name = name.replace(/\*/g, ' ');

    // Remove city/state trailing info (e.g., "MERCHANT NAME  CITY ST")
    // Only strip when the 2-letter code is a known US state/territory abbreviation
    const stateAbbrs = new Set([
      'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in',
      'ia','ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv',
      'nh','nj','nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn',
      'tx','ut','vt','va','wa','wv','wi','wy','dc','pr','vi','gu','as','mp',
    ]);
    name = name.replace(/\s+([a-z]{2,})\s+([a-z]{2})\s*$/g, (match, _city, state) => {
      if (stateAbbrs.has(state)) {
        return '';
      }
      return match;
    });

    // Collapse multiple spaces
    name = name.replace(/\s+/g, ' ').trim();

    return name;
  }

  // ── Private matching methods ────────────────────────────────────────

  private tryUserOverride(
    userId: string,
    normalizedDesc: string,
    normalizedMerchant: string | null,
  ): CategoryResult | null {
    const overrides = this.userOverrides.get(userId);
    if (!overrides || overrides.length === 0) return null;

    for (const override of overrides) {
      const pattern = override.merchantPattern;
      if (
        normalizedDesc.includes(pattern) ||
        (normalizedMerchant && normalizedMerchant.includes(pattern))
      ) {
        return {
          category: override.category,
          subcategory: override.subcategory,
          confidence: 1.0,
          source: 'user_override',
        };
      }
    }

    return null;
  }

  private tryLearnedCorrection(
    userId: string,
    normalizedDesc: string,
    normalizedMerchant: string | null,
  ): CategoryResult | null {
    const corrections = this.learnedCorrections.get(userId);
    if (!corrections || corrections.length === 0) return null;

    // Only apply learned corrections with at least 1 occurrence
    for (const correction of corrections) {
      if (
        normalizedDesc === correction.normalizedMerchant ||
        (normalizedMerchant && normalizedMerchant === correction.normalizedMerchant)
      ) {
        return {
          category: correction.category,
          subcategory: correction.subcategory,
          confidence: Math.min(0.7 + correction.count * 0.1, 0.95),
          source: 'learned',
        };
      }
    }

    return null;
  }

  private tryExactMerchantMatch(
    normalizedMerchant: string | null,
    normalizedDesc: string,
  ): CategoryResult | null {
    // Try merchant name first (higher quality signal)
    if (normalizedMerchant) {
      const merchantEntry = MERCHANT_DATABASE[normalizedMerchant];
      if (merchantEntry) {
        return this.merchantEntryToResult(merchantEntry, 'merchant_exact', 0.95);
      }
    }

    // Try description
    const descEntry = MERCHANT_DATABASE[normalizedDesc];
    if (descEntry) {
      return this.merchantEntryToResult(descEntry, 'merchant_exact', 0.9);
    }

    return null;
  }

  private tryNormalizedMerchantMatch(
    normalizedMerchant: string | null,
    normalizedDesc: string,
  ): CategoryResult | null {
    const candidates = [normalizedMerchant, normalizedDesc].filter(
      Boolean,
    ) as string[];

    for (const candidate of candidates) {
      // Try progressively shorter prefixes of the candidate
      // e.g., "netflix billing" -> try "netflix billing", then "netflix"
      const words = candidate.split(' ');
      for (let len = words.length; len >= 1; len--) {
        const prefix = words.slice(0, len).join(' ');
        const entry = MERCHANT_DATABASE[prefix];
        if (entry) {
          const confidence = len === words.length ? 0.85 : 0.75;
          return this.merchantEntryToResult(entry, 'merchant_normalized', confidence);
        }
      }
    }

    // Try checking if any merchant DB key appears as a whole word within the candidate
    // Uses pre-computed regex patterns for performance
    for (const candidate of candidates) {
      for (const pattern of this.merchantSubstringPatterns) {
        if (pattern.regex.test(candidate)) {
          return this.merchantEntryToResult(pattern.entry, 'merchant_normalized', 0.7);
        }
      }
    }

    return null;
  }

  private tryKeywordMatch(
    normalizedDesc: string,
    normalizedMerchant: string | null,
  ): CategoryResult | null {
    const searchText = normalizedMerchant
      ? `${normalizedMerchant} ${normalizedDesc}`
      : normalizedDesc;

    for (const rule of KEYWORD_RULES) {
      for (const keyword of rule.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return {
            category: rule.category,
            subcategory: rule.subcategory,
            confidence: 0.6,
            source: 'keyword',
          };
        }
      }
    }

    return null;
  }

  private tryMccMatch(mcc: string): CategoryResult | null {
    const entry = MCC_DATABASE[mcc];
    if (!entry) return null;

    return {
      category: entry.category,
      subcategory: entry.subcategory,
      confidence: 0.8,
      source: 'mcc',
    };
  }

  private merchantEntryToResult(
    entry: MerchantEntry,
    source: CategoryResult['source'],
    confidence: number,
  ): CategoryResult {
    return {
      category: entry.category,
      subcategory: entry.subcategory,
      confidence,
      source,
    };
  }
}
