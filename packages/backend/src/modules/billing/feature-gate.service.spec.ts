import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureGateService } from './feature-gate.service';
import { FEATURES, PLAN_FEATURES, FEATURE_PLAN_MAP } from './plans';

describe('FeatureGateService', () => {
  let service: FeatureGateService;
  let mockBillingService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBillingService = {
      canAccess: vi.fn(),
      hasMinimumPlan: vi.fn(),
      checkLinkedAccountLimit: vi.fn(),
      getUserFeatures: vi.fn(),
    };

    service = new (FeatureGateService as any)(mockBillingService);
  });

  // --------------------------------------------------------------------------
  // canAccess
  // --------------------------------------------------------------------------

  describe('canAccess', () => {
    it('should delegate to billingService.canAccess', async () => {
      mockBillingService.canAccess.mockResolvedValue(true);

      const result = await service.canAccess('user-1', FEATURES.BASIC_BUDGETS);

      expect(mockBillingService.canAccess).toHaveBeenCalledWith('user-1', FEATURES.BASIC_BUDGETS);
      expect(result).toBe(true);
    });

    it('should return false when billing service denies access', async () => {
      mockBillingService.canAccess.mockResolvedValue(false);

      const result = await service.canAccess('user-1', FEATURES.HOUSEHOLD_SHARING);

      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Free tier gating
  // --------------------------------------------------------------------------

  describe('free tier', () => {
    it('should allow free features for a free-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(true);

      const result = await service.canAccess('free-user', FEATURES.BASIC_BUDGETS);
      expect(result).toBe(true);
    });

    it('should block pro features for a free-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(false);

      const result = await service.canAccess('free-user', FEATURES.AI_CHAT_UNLIMITED);
      expect(result).toBe(false);
    });

    it('should block premium features for a free-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(false);

      const result = await service.canAccess('free-user', FEATURES.HOUSEHOLD_SHARING);
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Pro tier gating
  // --------------------------------------------------------------------------

  describe('pro tier', () => {
    it('should allow pro features for a pro-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(true);

      const result = await service.canAccess('pro-user', FEATURES.AI_INSIGHTS);
      expect(result).toBe(true);
    });

    it('should block premium-only features for a pro-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(false);

      const result = await service.canAccess('pro-user', FEATURES.HOUSEHOLD_SHARING);
      expect(result).toBe(false);
    });

    it('should block family budgets for a pro-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(false);

      const result = await service.canAccess('pro-user', FEATURES.FAMILY_BUDGETS);
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Premium tier gating
  // --------------------------------------------------------------------------

  describe('premium tier', () => {
    it('should allow all features for a premium-tier user', async () => {
      mockBillingService.canAccess.mockResolvedValue(true);

      const premiumFeatures = [
        FEATURES.BASIC_BUDGETS,
        FEATURES.AI_CHAT_UNLIMITED,
        FEATURES.HOUSEHOLD_SHARING,
        FEATURES.API_ACCESS,
        FEATURES.FAMILY_BUDGETS,
      ];

      for (const feature of premiumFeatures) {
        const result = await service.canAccess('premium-user', feature);
        expect(result).toBe(true);
      }
    });

    it('should allow household sharing for premium user', async () => {
      mockBillingService.canAccess.mockResolvedValue(true);

      const result = await service.canAccess('premium-user', FEATURES.HOUSEHOLD_SHARING);
      expect(result).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // hasMinimumPlan
  // --------------------------------------------------------------------------

  describe('hasMinimumPlan', () => {
    it('should delegate to billingService.hasMinimumPlan', async () => {
      mockBillingService.hasMinimumPlan.mockResolvedValue(true);

      const result = await service.hasMinimumPlan('user-1', 'pro');

      expect(mockBillingService.hasMinimumPlan).toHaveBeenCalledWith('user-1', 'pro');
      expect(result).toBe(true);
    });

    it('should return false when user plan is below required', async () => {
      mockBillingService.hasMinimumPlan.mockResolvedValue(false);

      const result = await service.hasMinimumPlan('free-user', 'premium');

      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // checkLinkedAccountLimit
  // --------------------------------------------------------------------------

  describe('checkLinkedAccountLimit', () => {
    it('should delegate to billingService and return limit info', async () => {
      const limitResult = { allowed: false, limit: 2, current: 2 };
      mockBillingService.checkLinkedAccountLimit.mockResolvedValue(limitResult);

      const result = await service.checkLinkedAccountLimit('free-user', 2);

      expect(mockBillingService.checkLinkedAccountLimit).toHaveBeenCalledWith('free-user', 2);
      expect(result).toEqual(limitResult);
    });

    it('should return allowed true when under limit', async () => {
      const limitResult = { allowed: true, limit: 2, current: 1 };
      mockBillingService.checkLinkedAccountLimit.mockResolvedValue(limitResult);

      const result = await service.checkLinkedAccountLimit('free-user', 1);

      expect(result.allowed).toBe(true);
    });

    it('should return unlimited for pro users', async () => {
      const limitResult = { allowed: true, limit: -1, current: 10 };
      mockBillingService.checkLinkedAccountLimit.mockResolvedValue(limitResult);

      const result = await service.checkLinkedAccountLimit('pro-user', 10);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  // --------------------------------------------------------------------------
  // getRequiredPlan (synchronous, uses FEATURE_PLAN_MAP)
  // --------------------------------------------------------------------------

  describe('getRequiredPlan', () => {
    it('should return "free" for free-tier features', () => {
      expect(service.getRequiredPlan(FEATURES.BASIC_BUDGETS)).toBe('free');
      expect(service.getRequiredPlan(FEATURES.MANUAL_ACCOUNTS)).toBe('free');
      expect(service.getRequiredPlan(FEATURES.BASIC_ANALYTICS)).toBe('free');
    });

    it('should return "pro" for pro-tier features', () => {
      expect(service.getRequiredPlan(FEATURES.AI_CHAT_UNLIMITED)).toBe('pro');
      expect(service.getRequiredPlan(FEATURES.CSV_EXPORT)).toBe('pro');
      expect(service.getRequiredPlan(FEATURES.REPORTS)).toBe('pro');
      expect(service.getRequiredPlan(FEATURES.INVESTMENT_TRACKING)).toBe('pro');
    });

    it('should return "premium" for premium-tier features', () => {
      expect(service.getRequiredPlan(FEATURES.HOUSEHOLD_SHARING)).toBe('premium');
      expect(service.getRequiredPlan(FEATURES.FAMILY_BUDGETS)).toBe('premium');
      expect(service.getRequiredPlan(FEATURES.SHARED_GOALS)).toBe('premium');
      expect(service.getRequiredPlan(FEATURES.API_ACCESS)).toBe('premium');
    });

    it('should default to "pro" for unknown features', () => {
      expect(service.getRequiredPlan('unknown_feature')).toBe('pro');
    });
  });

  // --------------------------------------------------------------------------
  // getPlanFeatures (synchronous, uses PLAN_FEATURES)
  // --------------------------------------------------------------------------

  describe('getPlanFeatures', () => {
    it('should return free-tier features for "free" plan', () => {
      const features = service.getPlanFeatures('free');

      expect(features).toEqual(PLAN_FEATURES.free);
      expect(features).toContain(FEATURES.BASIC_BUDGETS);
      expect(features).toContain(FEATURES.MANUAL_ACCOUNTS);
      expect(features).not.toContain(FEATURES.AI_CHAT_UNLIMITED);
    });

    it('should return pro-tier features for "pro" plan', () => {
      const features = service.getPlanFeatures('pro');

      expect(features).toEqual(PLAN_FEATURES.pro);
      expect(features).toContain(FEATURES.AI_CHAT_UNLIMITED);
      expect(features).toContain(FEATURES.CSV_EXPORT);
      expect(features).not.toContain(FEATURES.HOUSEHOLD_SHARING);
    });

    it('should return premium-tier features for "premium" plan', () => {
      const features = service.getPlanFeatures('premium');

      expect(features).toEqual(PLAN_FEATURES.premium);
      expect(features).toContain(FEATURES.HOUSEHOLD_SHARING);
      expect(features).toContain(FEATURES.API_ACCESS);
      expect(features).toContain(FEATURES.BASIC_BUDGETS);
    });

    it('should fall back to free features for unknown plan', () => {
      const features = service.getPlanFeatures('unknown' as any);

      expect(features).toEqual(PLAN_FEATURES.free);
    });
  });

  // --------------------------------------------------------------------------
  // getUserFeatures
  // --------------------------------------------------------------------------

  describe('getUserFeatures', () => {
    it('should delegate to billingService.getUserFeatures', async () => {
      const userFeatures = {
        plan: 'pro',
        features: PLAN_FEATURES.pro,
        limits: { ai_chat_daily: 'unlimited', linked_accounts: 'unlimited' },
      };
      mockBillingService.getUserFeatures.mockResolvedValue(userFeatures);

      const result = await service.getUserFeatures('user-1');

      expect(mockBillingService.getUserFeatures).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(userFeatures);
    });
  });
});
