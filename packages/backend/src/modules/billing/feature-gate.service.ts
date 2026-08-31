import { Injectable, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';
import { type PlanTier, PLAN_FEATURES, FEATURE_PLAN_MAP, canAccessFeature } from './plans';

/**
 * Service that provides feature gating logic.
 * Use this for service-level checks (non-decorator).
 */
@Injectable()
export class FeatureGateService {
  private readonly logger = new Logger(FeatureGateService.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Check if a user can access a specific feature.
   */
  async canAccess(userId: string, feature: string): Promise<boolean> {
    return this.billingService.canAccess(userId, feature);
  }

  /**
   * Check if user has at least the given plan tier.
   */
  async hasMinimumPlan(userId: string, plan: PlanTier): Promise<boolean> {
    return this.billingService.hasMinimumPlan(userId, plan);
  }

  /**
   * Check linked account limit for free-tier enforcement.
   */
  async checkLinkedAccountLimit(
    userId: string,
    currentCount: number,
  ): Promise<{
    allowed: boolean;
    limit: number;
    current: number;
  }> {
    return this.billingService.checkLinkedAccountLimit(userId, currentCount);
  }

  /**
   * Get the minimum plan required for a feature.
   */
  getRequiredPlan(feature: string): PlanTier {
    return FEATURE_PLAN_MAP[feature] ?? 'pro';
  }

  /**
   * Get all features available for a plan.
   */
  getPlanFeatures(plan: PlanTier): string[] {
    return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free;
  }

  /**
   * Get user's effective plan and feature list.
   */
  async getUserFeatures(userId: string) {
    return this.billingService.getUserFeatures(userId);
  }
}
