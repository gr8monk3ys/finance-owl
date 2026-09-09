import { describe, it, expect } from 'vitest';
import {
  PLANS,
  PLAN_TIER_ORDER,
  PLAN_FEATURES,
  FEATURE_PLAN_MAP,
  canAccessFeature,
  getRequiredPlan,
  isAtLeastPlan,
  getPlanDefinition,
  getAllPlans,
  getPlanLimits,
  formatPlanPrice,
  getUpgradeTiers,
  type PlanTier,
} from './plans';

const TIERS: PlanTier[] = ['free', 'pro', 'premium'];

describe('plans', () => {
  describe('the tier vocabulary', () => {
    // This table is the single source of truth for both the billing guards
    // and every price the UI shows. The frontend used to carry four
    // hand-copied versions of it, one of which invented a `family` tier and
    // quoted $4.99 for what billing charges $9.99 for.
    it('has exactly the three tiers the backend enforces', () => {
      expect(Object.keys(PLANS).sort()).toEqual(['free', 'premium', 'pro']);
    });

    it('gives every tier a definition whose name matches its key', () => {
      for (const tier of TIERS) {
        expect(PLANS[tier].name).toBe(tier);
      }
    });

    it('orders the tiers free < pro < premium', () => {
      expect(PLAN_TIER_ORDER.free).toBeLessThan(PLAN_TIER_ORDER.pro);
      expect(PLAN_TIER_ORDER.pro).toBeLessThan(PLAN_TIER_ORDER.premium);
    });
  });

  describe('pricing', () => {
    it('prices free at zero and every paid tier above it', () => {
      expect(PLANS.free.monthlyPrice).toBe(0);
      expect(PLANS.free.yearlyPrice).toBe(0);
      expect(PLANS.pro.monthlyPrice).toBeGreaterThan(0);
      expect(PLANS.premium.monthlyPrice).toBeGreaterThan(PLANS.pro.monthlyPrice);
    });

    it('makes paying yearly cheaper than twelve months', () => {
      for (const tier of ['pro', 'premium'] as const) {
        expect(PLANS[tier].yearlyPrice).toBeLessThan(PLANS[tier].monthlyPrice * 12);
      }
    });

    it('formats a monthly price', () => {
      expect(formatPlanPrice('free')).toBe('$0');
      expect(formatPlanPrice('pro')).toBe('$9.99/mo');
      expect(formatPlanPrice('premium')).toBe('$19.99/mo');
    });

    it('formats a yearly price', () => {
      expect(formatPlanPrice('free', 'year')).toBe('$0');
      expect(formatPlanPrice('pro', 'year')).toBe('$99.99/yr');
    });
  });

  describe('feature access', () => {
    it('lets a tier reach every feature it lists', () => {
      for (const tier of TIERS) {
        for (const feature of PLAN_FEATURES[tier]) {
          expect(canAccessFeature(tier, feature)).toBe(true);
        }
      }
    });

    it('refuses a feature the tier does not list', () => {
      const proOnly = PLAN_FEATURES.pro.find((f) => !PLAN_FEATURES.free.includes(f));
      expect(proOnly).toBeDefined();
      expect(canAccessFeature('free', proOnly as string)).toBe(false);
    });

    it('refuses an unknown feature outright', () => {
      expect(canAccessFeature('premium', 'not-a-real-feature')).toBe(false);
    });

    it('maps every gated feature to a tier that actually grants it', () => {
      for (const [feature, tier] of Object.entries(FEATURE_PLAN_MAP)) {
        expect(canAccessFeature(tier, feature)).toBe(true);
      }
    });

    it('reports the tier a feature requires', () => {
      for (const [feature, tier] of Object.entries(FEATURE_PLAN_MAP)) {
        expect(getRequiredPlan(feature)).toBe(tier);
      }
    });
  });

  describe('isAtLeastPlan', () => {
    it('accepts a tier meeting or exceeding the requirement', () => {
      expect(isAtLeastPlan('premium', 'free')).toBe(true);
      expect(isAtLeastPlan('pro', 'pro')).toBe(true);
      expect(isAtLeastPlan('premium', 'pro')).toBe(true);
    });

    it('rejects a tier below the requirement', () => {
      expect(isAtLeastPlan('free', 'pro')).toBe(false);
      expect(isAtLeastPlan('pro', 'premium')).toBe(false);
    });
  });

  describe('lookups', () => {
    it('returns each tier definition by name', () => {
      for (const tier of TIERS) {
        expect(getPlanDefinition(tier)).toBe(PLANS[tier]);
      }
    });

    it('returns every plan, ordered cheapest first', () => {
      const all = getAllPlans();
      expect(all).toHaveLength(TIERS.length);
      const prices = all.map((p) => p.monthlyPrice);
      expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    });

    it('offers only the paid tiers as upgrades', () => {
      const names = getUpgradeTiers().map((p) => p.name);
      expect(names).toEqual(['pro', 'premium']);
      expect(names).not.toContain('free');
    });

    it('returns limits per tier, with paid tiers never tighter than free', () => {
      const free = getPlanLimits('free');
      const pro = getPlanLimits('pro');
      // -1 means unlimited, so treat it as the largest value.
      const asNumber = (n: number) => (n === -1 ? Number.POSITIVE_INFINITY : n);
      expect(asNumber(pro.maxLinkedAccounts)).toBeGreaterThanOrEqual(
        asNumber(free.maxLinkedAccounts),
      );
      expect(asNumber(pro.aiChatMessagesPerDay)).toBeGreaterThanOrEqual(
        asNumber(free.aiChatMessagesPerDay),
      );
    });

    it('gives household sharing only to premium', () => {
      expect(getPlanLimits('free').householdMembers).toBe(0);
      expect(getPlanLimits('pro').householdMembers).toBe(0);
      expect(getPlanLimits('premium').householdMembers).toBeGreaterThan(0);
    });
  });
});
