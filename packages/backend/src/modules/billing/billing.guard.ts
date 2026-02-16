import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BillingService } from './billing.service';
import { type PlanTier, isAtLeastPlan, getRequiredPlan } from './plans';

// ---------------------------------------------------------------------------
// Metadata keys
// ---------------------------------------------------------------------------

export const REQUIRED_PLAN_KEY = 'billing:requiredPlan';
export const REQUIRED_FEATURE_KEY = 'billing:requiredFeature';

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

/**
 * Restrict endpoint access by minimum plan tier.
 * Returns 402 Payment Required if the user's current plan is insufficient.
 *
 * Usage:
 *   @RequirePlan('pro')       // requires pro or premium
 *   @RequirePlan('premium')   // requires premium only
 *
 * Can be applied at the class or method level.
 */
export function RequirePlan(plan: PlanTier) {
  return applyDecorators(
    SetMetadata(REQUIRED_PLAN_KEY, plan),
    UseGuards(BillingPlanGuard),
  );
}

/**
 * Restrict endpoint access by specific feature.
 * Returns 402 Payment Required if the user's plan does not include the feature.
 *
 * Usage:
 *   @RequireFeature('csv_export')
 *   @RequireFeature('household_sharing')
 */
export function RequireFeature(feature: string) {
  return applyDecorators(
    SetMetadata(REQUIRED_FEATURE_KEY, feature),
    UseGuards(BillingFeatureGuard),
  );
}

// ---------------------------------------------------------------------------
// Plan Guard
// ---------------------------------------------------------------------------

@Injectable()
export class BillingPlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<PlanTier>(
      REQUIRED_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Authentication required',
          error: 'Unauthorized',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const subscription = await this.billingService.getSubscription(user.id);
    const currentPlan = subscription.planName as PlanTier;

    if (!isAtLeastPlan(currentPlan, requiredPlan)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `This feature requires the ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher. Please upgrade your subscription.`,
          error: 'Payment Required',
          requiredPlan,
          currentPlan,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}

// ---------------------------------------------------------------------------
// Feature Guard
// ---------------------------------------------------------------------------

@Injectable()
export class BillingFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Authentication required',
          error: 'Unauthorized',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const subscription = await this.billingService.getSubscription(user.id);
    const currentPlan = subscription.planName as PlanTier;
    const requiredPlan = getRequiredPlan(requiredFeature);

    if (!isAtLeastPlan(currentPlan, requiredPlan)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Access to "${requiredFeature}" requires the ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher.`,
          error: 'Payment Required',
          requiredFeature,
          requiredPlan,
          currentPlan,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
