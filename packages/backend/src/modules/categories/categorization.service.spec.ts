import { describe, it, expect, beforeEach } from 'vitest';
import { CategorizationEngineService, type CategoryResult } from './categorization.service';

describe('CategorizationEngineService', () => {
  let service: CategorizationEngineService;

  beforeEach(() => {
    service = new CategorizationEngineService();
  });

  // ─── Exact merchant matching ───────────────────────────────────────

  describe('exact merchant matching', () => {
    it('should match Netflix by merchant name', () => {
      const result = service.categorizeTransaction('Monthly billing', 'Netflix');
      expect(result.category).toBe('Entertainment');
      expect(result.subcategory).toBe('Streaming Services');
      expect(result.source).toBe('merchant_exact');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should match Spotify by merchant name', () => {
      const result = service.categorizeTransaction('Spotify Premium', 'Spotify');
      expect(result.category).toBe('Entertainment');
      expect(result.subcategory).toBe('Music');
      expect(result.source).toBe('merchant_exact');
    });

    it('should match Amazon by description when no merchant name provided', () => {
      const result = service.categorizeTransaction('amazon');
      expect(result.category).toBe('Shopping');
      expect(result.subcategory).toBe('Online Shopping');
    });

    it('should match Starbucks by merchant name', () => {
      const result = service.categorizeTransaction('Coffee purchase', 'Starbucks');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Coffee Shops');
    });

    it('should match Uber by merchant name', () => {
      const result = service.categorizeTransaction('Trip', 'Uber');
      expect(result.category).toBe('Transportation');
      expect(result.subcategory).toBe('Ride Share');
    });

    it('should match Costco by merchant name', () => {
      const result = service.categorizeTransaction('Warehouse purchase', 'Costco');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Groceries');
    });

    it('should match Chipotle by description', () => {
      const result = service.categorizeTransaction('chipotle');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Fast Food');
    });
  });

  // ─── Normalized merchant matching ──────────────────────────────────

  describe('normalized merchant matching', () => {
    it('should match NETFLIX.COM after normalization', () => {
      const result = service.categorizeTransaction('NETFLIX.COM', 'NETFLIX.COM');
      expect(result.category).toBe('Entertainment');
      expect(result.subcategory).toBe('Streaming Services');
    });

    it('should match "SHELL OIL #04517" after stripping store number', () => {
      const result = service.categorizeTransaction('SHELL OIL #04517');
      expect(result.category).toBe('Transportation');
      expect(result.subcategory).toBe('Gas & Fuel');
    });

    it('should match "WALMART STORE #2345" after normalization', () => {
      const result = service.categorizeTransaction('WALMART STORE #2345');
      expect(result.category).toBe('Shopping');
      expect(result.subcategory).toBe('Home Goods');
    });

    it('should match "STARBUCKS STORE 12345 SEATTLE WA"', () => {
      const result = service.categorizeTransaction('STARBUCKS STORE 12345 SEATTLE WA');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Coffee Shops');
    });

    it('should match "TARGET INC" after stripping corporate suffix', () => {
      const result = service.categorizeTransaction('TARGET INC');
      expect(result.category).toBe('Shopping');
      expect(result.subcategory).toBe('Home Goods');
    });

    it('should match "CHEVRON 98234" (trailing store number)', () => {
      const result = service.categorizeTransaction('CHEVRON 98234');
      expect(result.category).toBe('Transportation');
      expect(result.subcategory).toBe('Gas & Fuel');
    });

    it('should match "SQ *COFFEE SHOP" (Square POS prefix)', () => {
      // "SQ *" gets stripped, then "coffee shop" matches keyword
      const result = service.categorizeTransaction('SQ *COFFEE SHOP');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Coffee Shops');
    });

    it('should match "TST*PIZZA PLACE" (Toast POS prefix)', () => {
      const result = service.categorizeTransaction('TST*PIZZA PLACE');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Fast Food');
    });

    it('should match "AMZN MKTP US" via substring matching', () => {
      // "amzn" is in the merchant database
      const result = service.categorizeTransaction('AMZN MKTP US');
      expect(result.category).toBe('Shopping');
      expect(result.subcategory).toBe('Online Shopping');
    });
  });

  // ─── Keyword fallback ─────────────────────────────────────────────

  describe('keyword fallback', () => {
    it('should categorize a gas station via keyword', () => {
      const result = service.categorizeTransaction('UNKNOWN GAS STATION 456');
      expect(result.category).toBe('Transportation');
      expect(result.subcategory).toBe('Gas & Fuel');
      expect(result.source).toBe('keyword');
    });

    it('should categorize a restaurant via keyword', () => {
      const result = service.categorizeTransaction('JOES BISTRO AND GRILL');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Restaurants');
      expect(result.source).toBe('keyword');
    });

    it('should categorize a gym via keyword', () => {
      const result = service.categorizeTransaction('DOWNTOWN FITNESS CENTER');
      expect(result.category).toBe('Health & Medical');
      expect(result.subcategory).toBe('Gym & Fitness');
      expect(result.source).toBe('keyword');
    });

    it('should categorize a pharmacy via keyword', () => {
      const result = service.categorizeTransaction('NEIGHBORHOOD PHARMACY RX');
      expect(result.category).toBe('Health & Medical');
      expect(result.subcategory).toBe('Pharmacy');
      expect(result.source).toBe('keyword');
    });

    it('should categorize an airline via keyword', () => {
      const result = service.categorizeTransaction('RANDOM AIRWAYS TICKET');
      expect(result.category).toBe('Travel');
      expect(result.subcategory).toBe('Flights');
      expect(result.source).toBe('keyword');
    });

    it('should categorize a hotel via keyword', () => {
      const result = service.categorizeTransaction('BEACH RESORT AND SPA');
      expect(result.category).toBe('Travel');
      expect(result.subcategory).toBe('Hotels');
      expect(result.source).toBe('keyword');
    });
  });

  // ─── MCC code matching ────────────────────────────────────────────

  describe('MCC code matching', () => {
    it('should categorize via MCC 5812 (restaurants)', () => {
      const result = service.categorizeTransaction('RANDOM MERCHANT XYZ123', null, '5812');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Restaurants');
      expect(result.source).toBe('mcc');
      expect(result.confidence).toBe(0.8);
    });

    it('should categorize via MCC 5541 (gas stations)', () => {
      const result = service.categorizeTransaction('UNKNOWN PLACE 99', null, '5541');
      expect(result.category).toBe('Transportation');
      expect(result.subcategory).toBe('Gas & Fuel');
      expect(result.source).toBe('mcc');
    });

    it('should categorize via MCC 5411 (grocery stores)', () => {
      const result = service.categorizeTransaction('SOME PLACE 77', null, '5411');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Groceries');
      expect(result.source).toBe('mcc');
    });

    it('should categorize via MCC 4511 (airlines)', () => {
      const result = service.categorizeTransaction('TICKET PURCHASE ZZZ', null, '4511');
      expect(result.category).toBe('Travel');
      expect(result.subcategory).toBe('Flights');
      expect(result.source).toBe('mcc');
    });

    it('should prefer merchant match over MCC code', () => {
      // Netflix should match by merchant, even if MCC says something else
      const result = service.categorizeTransaction('Netflix billing', 'Netflix', '5812');
      expect(result.source).not.toBe('mcc');
      expect(result.category).toBe('Entertainment');
      expect(result.subcategory).toBe('Streaming Services');
    });
  });

  // ─── User overrides ───────────────────────────────────────────────

  describe('user overrides', () => {
    const userId = 'user-123';

    it('should apply user override over merchant database match', () => {
      service.setUserCategoryOverride(userId, 'costco', 'Shopping', 'Home Goods');

      const result = service.categorizeTransaction('COSTCO WHOLESALE', 'Costco', null, userId);

      expect(result.category).toBe('Shopping');
      expect(result.subcategory).toBe('Home Goods');
      expect(result.source).toBe('user_override');
      expect(result.confidence).toBe(1.0);
    });

    it('should return overrides for a user', () => {
      service.setUserCategoryOverride(userId, 'starbucks', 'Food & Drink', 'Fast Food');

      const overrides = service.getUserOverrides(userId);
      expect(overrides).toHaveLength(1);
      expect(overrides[0].category).toBe('Food & Drink');
      expect(overrides[0].subcategory).toBe('Fast Food');
    });

    it('should replace existing override for same pattern', () => {
      service.setUserCategoryOverride(userId, 'starbucks', 'Food & Drink', 'Fast Food');
      service.setUserCategoryOverride(userId, 'starbucks', 'Food & Drink', 'Restaurants');

      const overrides = service.getUserOverrides(userId);
      expect(overrides).toHaveLength(1);
      expect(overrides[0].subcategory).toBe('Restaurants');
    });

    it('should remove a user override', () => {
      service.setUserCategoryOverride(userId, 'netflix', 'Utilities', 'Internet');
      const removed = service.removeUserOverride(userId, 'netflix');
      expect(removed).toBe(true);
      expect(service.getUserOverrides(userId)).toHaveLength(0);
    });

    it('should return false when removing non-existent override', () => {
      const removed = service.removeUserOverride(userId, 'nonexistent');
      expect(removed).toBe(false);
    });

    it('should not apply overrides from a different user', () => {
      service.setUserCategoryOverride('user-other', 'netflix', 'Utilities', 'Phone');

      const result = service.categorizeTransaction('netflix', 'Netflix', null, userId);
      expect(result.category).toBe('Entertainment');
      expect(result.source).not.toBe('user_override');
    });
  });

  // ─── Learned corrections ──────────────────────────────────────────

  describe('learned corrections', () => {
    const userId = 'user-456';

    it('should apply a learned correction to future transactions', () => {
      service.recordCorrection(userId, 'Whole Foods', 'Shopping', 'Home Goods');

      const result = service.categorizeTransaction(
        'Whole Foods purchase',
        'Whole Foods',
        null,
        userId,
      );

      expect(result.category).toBe('Shopping');
      expect(result.subcategory).toBe('Home Goods');
      expect(result.source).toBe('learned');
    });

    it('should increase confidence with repeated corrections', () => {
      service.recordCorrection(userId, 'Target', 'Food & Drink', 'Groceries');
      service.recordCorrection(userId, 'Target', 'Food & Drink', 'Groceries');
      service.recordCorrection(userId, 'Target', 'Food & Drink', 'Groceries');

      const corrections = service.getLearnedCorrections(userId);
      const targetCorrection = corrections.find((c) => c.normalizedMerchant === 'target');

      expect(targetCorrection).toBeDefined();
      expect(targetCorrection!.count).toBe(3);
    });

    it('should update category when user changes their mind', () => {
      service.recordCorrection(userId, 'Starbucks', 'Food & Drink', 'Coffee Shops');
      service.recordCorrection(userId, 'Starbucks', 'Food & Drink', 'Restaurants');

      const result = service.categorizeTransaction('Starbucks', 'Starbucks', null, userId);

      expect(result.subcategory).toBe('Restaurants');
      expect(result.source).toBe('learned');
    });
  });

  // ─── Bulk categorization ──────────────────────────────────────────

  describe('bulk categorization', () => {
    it('should categorize multiple transactions at once', () => {
      const transactions = [
        { description: 'Netflix', merchantName: 'Netflix' },
        { description: 'Shell Oil', merchantName: 'Shell' },
        { description: 'Kroger', merchantName: 'Kroger' },
        { description: 'Planet Fitness', merchantName: 'Planet Fitness' },
        { description: 'UNKNOWN VENDOR ABC', merchantName: null },
      ];

      const results = service.categorizeBulk(transactions);

      expect(results).toHaveLength(5);
      expect(results[0].category).toBe('Entertainment');
      expect(results[1].category).toBe('Transportation');
      expect(results[2].category).toBe('Food & Drink');
      expect(results[3].category).toBe('Health & Medical');
      expect(results[4].category).toBe('Uncategorized');
    });

    it('should apply user overrides in bulk mode', () => {
      const userId = 'user-bulk';
      service.setUserCategoryOverride(userId, 'netflix', 'Utilities', 'Internet');

      const transactions = [
        { description: 'Netflix billing', merchantName: 'Netflix' },
        { description: 'Spotify Premium', merchantName: 'Spotify' },
      ];

      const results = service.categorizeBulk(transactions, userId);

      expect(results[0].category).toBe('Utilities');
      expect(results[0].subcategory).toBe('Internet');
      expect(results[0].source).toBe('user_override');
      expect(results[1].category).toBe('Entertainment');
      expect(results[1].subcategory).toBe('Music');
    });
  });

  // ─── Unknown merchants ────────────────────────────────────────────

  describe('unknown merchants', () => {
    it('should return Uncategorized for unknown merchant with no matching keywords or MCC', () => {
      const result = service.categorizeTransaction('XYZZY CORP 12345', 'XYZZY CORP', null);
      expect(result.category).toBe('Uncategorized');
      expect(result.subcategory).toBe('Uncategorized');
      expect(result.confidence).toBe(0);
      expect(result.source).toBe('uncategorized');
    });

    it('should return Uncategorized for empty description', () => {
      const result = service.categorizeTransaction('');
      expect(result.category).toBe('Uncategorized');
    });

    it('should still try MCC for unknown merchant', () => {
      const result = service.categorizeTransaction('XYZZY TOTALLY UNKNOWN', null, '5812');
      expect(result.category).toBe('Food & Drink');
      expect(result.subcategory).toBe('Restaurants');
      expect(result.source).toBe('mcc');
    });
  });

  // ─── Normalization ────────────────────────────────────────────────

  describe('merchant normalization', () => {
    it('should lowercase the input', () => {
      expect(service.normalizeMerchant('NETFLIX')).toBe('netflix');
    });

    it('should strip .com suffix', () => {
      expect(service.normalizeMerchant('NETFLIX.COM')).toBe('netflix');
    });

    it('should strip INC suffix', () => {
      const result = service.normalizeMerchant('TARGET INC');
      expect(result).toBe('target');
    });

    it('should strip LLC suffix', () => {
      const result = service.normalizeMerchant('ACME LLC');
      expect(result).toBe('acme');
    });

    it('should strip store number with hash', () => {
      expect(service.normalizeMerchant('SHELL #04517')).toBe('shell');
    });

    it('should strip store number with STORE prefix', () => {
      expect(service.normalizeMerchant('WALMART STORE #2345')).toBe('walmart');
    });

    it('should strip trailing multi-digit number', () => {
      expect(service.normalizeMerchant('CHEVRON 98234')).toBe('chevron');
    });

    it('should strip SQ * prefix', () => {
      expect(service.normalizeMerchant('SQ *COFFEE BEAN')).toBe('coffee bean');
    });

    it('should strip TST* prefix', () => {
      expect(service.normalizeMerchant('TST*PIZZA PLACE')).toBe('pizza place');
    });

    it('should collapse multiple spaces', () => {
      expect(service.normalizeMerchant('SHELL   OIL')).toBe('shell oil');
    });

    it('should handle already clean input', () => {
      expect(service.normalizeMerchant('netflix')).toBe('netflix');
    });
  });

  // ─── Priority / precedence ────────────────────────────────────────

  describe('matching priority', () => {
    it('should prefer user override over everything else', () => {
      const userId = 'user-priority';
      service.setUserCategoryOverride(userId, 'shell', 'Food & Drink', 'Groceries');

      const result = service.categorizeTransaction('SHELL OIL', 'Shell', '5541', userId);

      expect(result.source).toBe('user_override');
      expect(result.category).toBe('Food & Drink');
    });

    it('should prefer learned correction over merchant database', () => {
      const userId = 'user-learned-priority';
      service.recordCorrection(userId, 'Shell', 'Education', 'Tuition');

      const result = service.categorizeTransaction('SHELL OIL', 'Shell', '5541', userId);

      expect(result.source).toBe('learned');
      expect(result.category).toBe('Education');
    });

    it('should prefer exact merchant match over keyword match', () => {
      // "shell" is both in merchant DB and could match "gas station" keyword
      const result = service.categorizeTransaction('Shell', 'Shell');
      expect(result.source).toBe('merchant_exact');
    });

    it('should prefer keyword match over MCC when both are available', () => {
      const result = service.categorizeTransaction("JOE'S RESTAURANT AND BAR", null, '9999');

      // Should match keyword "restaurant" rather than fall to MCC
      expect(result.source).toBe('keyword');
    });
  });
});
