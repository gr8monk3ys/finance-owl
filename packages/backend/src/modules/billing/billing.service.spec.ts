import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import {
  PLAN_FEATURES,
  FEATURE_PLAN_MAP,
  PLANS,
  canAccessFeature,
  isAtLeastPlan,
  getRequiredPlan,
  getAllPlans,
  getPlanLimits,
} from './plans';

// Mock Stripe at module level
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: { create: vi.fn() },
      },
      billingPortal: {
        sessions: { create: vi.fn() },
      },
      customers: {
        create: vi.fn(),
        update: vi.fn(),
      },
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  };
});

function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'groupBy',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

describe('BillingService', () => {
  let service: BillingService;
  let mockDb: any;
  let mockConfigService: any;

  const mockUserId = 'user-123';

  const freePlan = {
    id: 'plan-free',
    name: 'free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: JSON.stringify(PLAN_FEATURES.free),
    isActive: 1,
  };

  const proPlan = {
    id: 'plan-pro',
    name: 'pro',
    monthlyPrice: 9.99,
    yearlyPrice: 99.99,
    features: JSON.stringify(PLAN_FEATURES.pro),
    isActive: 1,
  };

  const premiumPlan = {
    id: 'plan-premium',
    name: 'premium',
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    features: JSON.stringify(PLAN_FEATURES.premium),
    isActive: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          STRIPE_SECRET_KEY: 'sk_test_fake',
          STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
          STRIPE_PRICE_PRO_YEARLY: 'price_pro_yearly',
          STRIPE_PRICE_PREMIUM_MONTHLY: 'price_premium_monthly',
          STRIPE_PRICE_PREMIUM_YEARLY: 'price_premium_yearly',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key] || defaultValue;
      }),
      getOrThrow: vi.fn((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
        throw new Error(`Missing ${key}`);
      }),
    };

    service = new BillingService(mockDb, mockConfigService);
  });

  // ---------------------------------------------------------------------------
  // plans.ts helper functions
  // ---------------------------------------------------------------------------
  describe('plans.ts helpers', () => {
    it('canAccessFeature returns true for features in the plan', () => {
      expect(canAccessFeature('free', 'basic_budgets')).toBe(true);
      expect(canAccessFeature('pro', 'investment_tracking')).toBe(true);
      expect(canAccessFeature('premium', 'household_sharing')).toBe(true);
    });

    it('canAccessFeature returns false for features not in the plan', () => {
      expect(canAccessFeature('free', 'investment_tracking')).toBe(false);
      expect(canAccessFeature('free', 'household_sharing')).toBe(false);
      expect(canAccessFeature('pro', 'household_sharing')).toBe(false);
    });

    it('isAtLeastPlan compares tiers correctly', () => {
      expect(isAtLeastPlan('premium', 'pro')).toBe(true);
      expect(isAtLeastPlan('premium', 'free')).toBe(true);
      expect(isAtLeastPlan('pro', 'pro')).toBe(true);
      expect(isAtLeastPlan('pro', 'premium')).toBe(false);
      expect(isAtLeastPlan('free', 'pro')).toBe(false);
    });

    it('getRequiredPlan returns correct minimum plan', () => {
      expect(getRequiredPlan('basic_budgets')).toBe('free');
      expect(getRequiredPlan('investment_tracking')).toBe('pro');
      expect(getRequiredPlan('household_sharing')).toBe('premium');
    });

    it('getAllPlans returns all three plans in order', () => {
      const plans = getAllPlans();
      expect(plans).toHaveLength(3);
      expect(plans[0].name).toBe('free');
      expect(plans[1].name).toBe('pro');
      expect(plans[2].name).toBe('premium');
    });

    it('getPlanLimits returns correct limits per tier', () => {
      const freeLimits = getPlanLimits('free');
      expect(freeLimits.maxLinkedAccounts).toBe(2);
      expect(freeLimits.aiChatMessagesPerDay).toBe(5);
      expect(freeLimits.csvExport).toBe(false);

      const proLimits = getPlanLimits('pro');
      expect(proLimits.maxLinkedAccounts).toBe(-1);
      expect(proLimits.aiChatMessagesPerDay).toBe(-1);
      expect(proLimits.csvExport).toBe(true);
      expect(proLimits.householdMembers).toBe(0);

      const premiumLimits = getPlanLimits('premium');
      expect(premiumLimits.householdMembers).toBe(10);
      expect(premiumLimits.apiRequestsPerMinute).toBe(300);
    });
  });

  // ---------------------------------------------------------------------------
  // PLAN_FEATURES constants
  // ---------------------------------------------------------------------------
  describe('PLAN_FEATURES', () => {
    it('should define features for all three tiers', () => {
      expect(PLAN_FEATURES.free).toBeDefined();
      expect(PLAN_FEATURES.pro).toBeDefined();
      expect(PLAN_FEATURES.premium).toBeDefined();
    });

    it('should include all free features (or upgraded versions) in pro', () => {
      for (const feature of PLAN_FEATURES.free) {
        if (feature === 'ai_chat_limited') {
          expect(PLAN_FEATURES.pro).toContain('ai_chat_unlimited');
        } else if (feature === 'linked_accounts_2') {
          expect(PLAN_FEATURES.pro).toContain('linked_accounts_unlimited');
        } else {
          expect(PLAN_FEATURES.pro).toContain(feature);
        }
      }
    });

    it('should include all pro features in premium', () => {
      for (const feature of PLAN_FEATURES.pro) {
        expect(PLAN_FEATURES.premium).toContain(feature);
      }
    });

    it('should have premium-exclusive features', () => {
      expect(PLAN_FEATURES.premium).toContain('household_sharing');
      expect(PLAN_FEATURES.premium).toContain('family_budgets');
      expect(PLAN_FEATURES.premium).toContain('shared_goals');
      expect(PLAN_FEATURES.premium).toContain('advisor_sharing');
      expect(PLAN_FEATURES.pro).not.toContain('household_sharing');
    });

    it('should have pro features not in free', () => {
      expect(PLAN_FEATURES.pro).toContain('subscription_tracking');
      expect(PLAN_FEATURES.pro).toContain('bill_negotiation');
      expect(PLAN_FEATURES.pro).toContain('smart_savings');
      expect(PLAN_FEATURES.pro).toContain('investment_tracking');
      expect(PLAN_FEATURES.pro).toContain('reports');
      expect(PLAN_FEATURES.free).not.toContain('subscription_tracking');
      expect(PLAN_FEATURES.free).not.toContain('investment_tracking');
    });
  });

  // ---------------------------------------------------------------------------
  // FEATURE_PLAN_MAP
  // ---------------------------------------------------------------------------
  describe('FEATURE_PLAN_MAP', () => {
    it('should map free features to free tier', () => {
      expect(FEATURE_PLAN_MAP['basic_budgets']).toBe('free');
      expect(FEATURE_PLAN_MAP['manual_accounts']).toBe('free');
      expect(FEATURE_PLAN_MAP['basic_analytics']).toBe('free');
    });

    it('should map pro features to pro tier', () => {
      expect(FEATURE_PLAN_MAP['subscription_tracking']).toBe('pro');
      expect(FEATURE_PLAN_MAP['bill_negotiation']).toBe('pro');
      expect(FEATURE_PLAN_MAP['smart_savings']).toBe('pro');
      expect(FEATURE_PLAN_MAP['investment_tracking']).toBe('pro');
      expect(FEATURE_PLAN_MAP['reports']).toBe('pro');
    });

    it('should map premium features to premium tier', () => {
      expect(FEATURE_PLAN_MAP['household_sharing']).toBe('premium');
      expect(FEATURE_PLAN_MAP['family_budgets']).toBe('premium');
      expect(FEATURE_PLAN_MAP['shared_goals']).toBe('premium');
      expect(FEATURE_PLAN_MAP['advisor_sharing']).toBe('premium');
    });
  });

  // ---------------------------------------------------------------------------
  // Plan pricing
  // ---------------------------------------------------------------------------
  describe('Plan pricing', () => {
    it('Free plan should be $0', () => {
      expect(PLANS.free.monthlyPrice).toBe(0);
      expect(PLANS.free.yearlyPrice).toBe(0);
    });

    it('Pro plan should be $9.99/mo', () => {
      expect(PLANS.pro.monthlyPrice).toBe(9.99);
      expect(PLANS.pro.yearlyPrice).toBe(99.99);
    });

    it('Premium plan should be $19.99/mo', () => {
      expect(PLANS.premium.monthlyPrice).toBe(19.99);
      expect(PLANS.premium.yearlyPrice).toBe(199.99);
    });
  });

  // ---------------------------------------------------------------------------
  // getPlans
  // ---------------------------------------------------------------------------
  describe('getPlans', () => {
    it('should return existing plans with parsed features', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([freePlan, proPlan]),
      );

      const result = await service.getPlans();

      expect(result).toHaveLength(2);
      expect(Array.isArray(result[0].features)).toBe(true);
      expect(result[0].features).toContain('basic_budgets');
    });

    it('should seed default plans when none exist', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined))
        .mockReturnValueOnce(mockQuery(undefined));
      mockDb.select.mockReturnValueOnce(
        mockQuery([freePlan, proPlan, premiumPlan]),
      );

      const result = await service.getPlans();

      expect(result).toHaveLength(3);
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // getSubscription
  // ---------------------------------------------------------------------------
  describe('getSubscription', () => {
    it('should return free plan info when no subscription exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getSubscription(mockUserId);

      expect(result.planName).toBe('free');
      expect(result.status).toBe('active');
      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(result.features).toEqual(PLAN_FEATURES.free);
      expect(result.limits.maxLinkedAccounts).toBe(2);
    });

    it('should return pro plan info for active pro subscription', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        plan: 'pro',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        currentPeriodStart: '2025-01-01T00:00:00Z',
        currentPeriodEnd: '2025-02-01T00:00:00Z',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.getSubscription(mockUserId);

      expect(result.planName).toBe('pro');
      expect(result.status).toBe('active');
      expect(result.planDisplayName).toBe('Pro');
      expect(result.features).toContain('investment_tracking');
      expect(result.limits.maxLinkedAccounts).toBe(-1);
    });

    it('should downgrade to free features when subscription is past_due', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        plan: 'pro',
        status: 'past_due',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.getSubscription(mockUserId);

      expect(result.planName).toBe('free');
      expect(result.status).toBe('past_due');
      expect(result.features).toEqual(PLAN_FEATURES.free);
    });

    it('should retain features during trialing', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        plan: 'pro',
        status: 'trialing',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.getSubscription(mockUserId);

      expect(result.planName).toBe('pro');
      expect(result.status).toBe('trialing');
    });
  });

  // ---------------------------------------------------------------------------
  // createCustomer
  // ---------------------------------------------------------------------------
  describe('createCustomer', () => {
    it('should return existing customer ID if already exists', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ userId: mockUserId, stripeCustomerId: 'cus_existing' }]),
      );

      const result = await service.createCustomer(
        mockUserId,
        'test@example.com',
        'Test User',
      );

      expect(result).toBe('cus_existing');
    });

    it('should create a new Stripe customer when none exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const stripe = (service as any).stripe;
      stripe.customers.create.mockResolvedValue({ id: 'cus_new_123' });
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.createCustomer(
        mockUserId,
        'test@example.com',
        'Test User',
      );

      expect(result).toBe('cus_new_123');
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { userId: mockUserId },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createCheckoutSessionByPlan
  // ---------------------------------------------------------------------------
  describe('createCheckoutSessionByPlan', () => {
    it('should throw NotFoundException when plan not found', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.createCheckoutSessionByPlan(mockUserId, 'non-existent', 'month'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for free plan checkout', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([freePlan]));

      await expect(
        service.createCheckoutSessionByPlan(mockUserId, 'plan-free', 'month'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // createPortalSession
  // ---------------------------------------------------------------------------
  describe('createPortalSession', () => {
    it('should throw BadRequestException when no billing account exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.createPortalSession(mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create portal session for existing customer', async () => {
      mockDb.select.mockReturnValueOnce(
        mockQuery([{ userId: mockUserId, stripeCustomerId: 'cus_123' }]),
      );

      const stripe = (service as any).stripe;
      stripe.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/xxx',
      });

      const result = await service.createPortalSession(mockUserId);

      expect(result.url).toBe('https://billing.stripe.com/session/xxx');
    });
  });

  // ---------------------------------------------------------------------------
  // cancelSubscription
  // ---------------------------------------------------------------------------
  describe('cancelSubscription', () => {
    it('should throw when no subscription exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.cancelSubscription(mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when subscription is already canceled', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
        status: 'canceled',
      };
      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      await expect(
        service.cancelSubscription(mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should cancel at period end by default', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        currentPeriodEnd: '2025-02-01T00:00:00Z',
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const stripe = (service as any).stripe;
      stripe.subscriptions.update.mockResolvedValue({
        cancel_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: true,
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.cancelSubscription(mockUserId, true);

      expect(result.canceled).toBe(true);
      expect(result.effectiveDate).toBeTruthy();
      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
    });

    it('should cancel immediately when atPeriodEnd is false', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const stripe = (service as any).stripe;
      stripe.subscriptions.cancel.mockResolvedValue({ id: 'sub_123' });

      // getPlans call
      mockDb.select.mockReturnValueOnce(mockQuery([freePlan, proPlan]));
      // update subscription
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.cancelSubscription(mockUserId, false);

      expect(result.canceled).toBe(true);
      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    });
  });

  // ---------------------------------------------------------------------------
  // resumeSubscription
  // ---------------------------------------------------------------------------
  describe('resumeSubscription', () => {
    it('should throw when no subscription exists', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(
        service.resumeSubscription(mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when subscription is not scheduled for cancellation', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };
      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      await expect(
        service.resumeSubscription(mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when subscription is fully canceled', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
        status: 'canceled',
        cancelAtPeriodEnd: 1,
      };
      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      await expect(
        service.resumeSubscription(mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resume a subscription scheduled for cancellation', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        cancelAtPeriodEnd: 1,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const stripe = (service as any).stripe;
      stripe.subscriptions.update.mockResolvedValue({
        cancel_at_period_end: false,
      });

      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.resumeSubscription(mockUserId);

      expect(result.resumed).toBe(true);
      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: false,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // isPremium
  // ---------------------------------------------------------------------------
  describe('isPremium', () => {
    it('should return true for active pro subscription', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.isPremium(mockUserId);
      expect(result).toBe(true);
    });

    it('should return true for active premium subscription', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-premium',
        plan: 'premium',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.isPremium(mockUserId);
      expect(result).toBe(true);
    });

    it('should return false for free plan', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.isPremium(mockUserId);
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // hasMinimumPlan
  // ---------------------------------------------------------------------------
  describe('hasMinimumPlan', () => {
    it('should return true when premium user checks for pro', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-premium',
        plan: 'premium',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.hasMinimumPlan(mockUserId, 'pro');
      expect(result).toBe(true);
    });

    it('should return false when pro user checks for premium', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.hasMinimumPlan(mockUserId, 'premium');
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getUserFeatures
  // ---------------------------------------------------------------------------
  describe('getUserFeatures', () => {
    it('should return free plan features and limits for free users', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.getUserFeatures(mockUserId);

      expect(result.plan).toBe('free');
      expect(result.features).toContain('basic_budgets');
      expect(result.limits.ai_chat_daily).toBe(5);
      expect(result.limits.linked_accounts).toBe(2);
      expect(result.limits.api_requests_per_minute).toBe(30);
      expect(result.limits.transaction_history_months).toBe(3);
    });

    it('should return pro features and unlimited limits for pro users', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-pro',
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.getUserFeatures(mockUserId);

      expect(result.plan).toBe('pro');
      expect(result.features).toContain('investment_tracking');
      expect(result.limits.ai_chat_daily).toBe('unlimited');
      expect(result.limits.linked_accounts).toBe('unlimited');
      expect(result.limits.api_requests_per_minute).toBe(120);
    });

    it('should return premium features with household limits', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        planId: 'plan-premium',
        plan: 'premium',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.getUserFeatures(mockUserId);

      expect(result.plan).toBe('premium');
      expect(result.features).toContain('household_sharing');
      expect(result.limits.household_members).toBe(10);
      expect(result.limits.api_requests_per_minute).toBe(300);
    });
  });

  // ---------------------------------------------------------------------------
  // checkLinkedAccountLimit
  // ---------------------------------------------------------------------------
  describe('checkLinkedAccountLimit', () => {
    it('should allow unlimited accounts for pro users', async () => {
      const subscription = {
        id: 'sub-1',
        userId: mockUserId,
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: 0,
      };

      mockDb.select.mockReturnValueOnce(mockQuery([subscription]));

      const result = await service.checkLinkedAccountLimit(mockUserId, 10);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it('should enforce 2-account limit for free users', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.checkLinkedAccountLimit(mockUserId, 2);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(2);
      expect(result.current).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // handleWebhook
  // ---------------------------------------------------------------------------
  describe('handleWebhook', () => {
    it('should throw BadRequestException on invalid signature', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle checkout.session.completed event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: mockUserId },
            subscription: 'sub_123',
            customer: 'cus_123',
          },
        },
      });

      stripe.subscriptions.retrieve.mockResolvedValue({
        status: 'active',
        start_date: Math.floor(Date.now() / 1000),
        cancel_at: null,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_pro_monthly' } }] },
      });

      // getPlans
      mockDb.select.mockReturnValueOnce(
        mockQuery([freePlan, proPlan, premiumPlan]),
      );
      // Check existing billing customer
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Insert billing customer
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));
      // Check existing subscription
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      // Insert new subscription
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        'valid-sig',
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle customer.subscription.updated event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            start_date: Math.floor(Date.now() / 1000),
            cancel_at: null,
            cancel_at_period_end: false,
            items: { data: [{ price: { id: 'price_pro_monthly' } }] },
          },
        },
      });

      const existingSub = {
        id: 'local-sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
      };

      mockDb.select.mockReturnValueOnce(mockQuery([existingSub]));
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        'valid-sig',
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle customer.subscription.deleted event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_123',
            status: 'canceled',
          },
        },
      });

      const existingSub = {
        id: 'local-sub-1',
        userId: mockUserId,
        stripeSubscriptionId: 'sub_123',
      };

      mockDb.select.mockReturnValueOnce(mockQuery([existingSub]));
      mockDb.select.mockReturnValueOnce(
        mockQuery([freePlan, proPlan]),
      );
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        'valid-sig',
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'inv_123',
            customer: 'cus_123',
            amount_paid: 999,
            currency: 'usd',
            hosted_invoice_url: 'https://stripe.com/invoice/123',
            lines: { data: [{ description: 'Pro monthly' }] },
          },
        },
      });

      mockDb.select.mockReturnValueOnce(
        mockQuery([{ userId: mockUserId, stripeCustomerId: 'cus_123' }]),
      );
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        'valid-sig',
      );

      expect(result).toEqual({ received: true });
    });

    it('should handle invoice.payment_failed event', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_fail_123',
            customer: 'cus_123',
            amount_due: 999,
            currency: 'usd',
            hosted_invoice_url: null,
          },
        },
      });

      const existingSub = {
        id: 'local-sub-1',
        userId: mockUserId,
        stripeCustomerId: 'cus_123',
      };

      mockDb.select.mockReturnValueOnce(mockQuery([existingSub]));
      mockDb.update.mockReturnValueOnce(mockQuery(undefined));
      mockDb.select.mockReturnValueOnce(mockQuery([]));
      mockDb.insert.mockReturnValueOnce(mockQuery(undefined));

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        'valid-sig',
      );

      expect(result).toEqual({ received: true });
    });

    it('should return received: true for unhandled event types', async () => {
      const stripe = (service as any).stripe;
      stripe.webhooks.constructEvent.mockReturnValue({
        type: 'some.unknown.event',
        data: { object: {} },
      });

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        'valid-sig',
      );

      expect(result).toEqual({ received: true });
    });
  });
});
