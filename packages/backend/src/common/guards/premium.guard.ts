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
import { BillingService } from '../../modules/billing/billing.service';
import { type PlanTier } from '../../modules/billing/plans';

export const PREMIUM_FEATURE_KEY = 'premiumFeature';
export const REQUIRED_PLAN_KEY = 'requiredPlan';

/**
 * Decorator that restricts access to premium users.
 * Optionally specify a specific feature to check.
 *
 * Usage:
 *   @RequiresPremium()                  // requires any paid plan
 *   @RequiresPremium('csv_export')      // requires a plan with csv_export feature
 */
export function RequiresPremium(feature?: string) {
  return applyDecorators(
    SetMetadata(PREMIUM_FEATURE_KEY, feature || '__premium__'),
    UseGuards(PremiumGuard),
  );
}

/**
 * Decorator that restricts access by minimum plan tier.
 * Returns 402 Payment Required if the user's plan is insufficient.
 *
 * Usage:
 *   @RequiresPlan('pro')       // requires pro or premium
 *   @RequiresPlan('premium')   // requires premium only
 */
export function RequiresPlan(plan: PlanTier) {
  return applyDecorators(
    SetMetadata(REQUIRED_PLAN_KEY, plan),
    UseGuards(PlanGuard),
  );
}

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(
      PREMIUM_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!feature) {
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

    if (feature === '__premium__') {
      const premium = await this.billingService.isPremium(user.id);
      if (!premium) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message:
              'This feature requires a Pro or Premium plan. Please upgrade your subscription.',
            error: 'Payment Required',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      return true;
    }

    const hasAccess = await this.billingService.getFeatureAccess(
      user.id,
      feature,
    );

    if (!hasAccess) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Access to "${feature}" requires a higher plan. Please upgrade your subscription.`,
          error: 'Payment Required',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private billingService: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(
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

    const hasPlan = await this.billingService.hasMinimumPlan(
      user.id,
      requiredPlan as PlanTier,
    );

    if (!hasPlan) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `This feature requires the ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher. Please upgrade your subscription.`,
          error: 'Payment Required',
          requiredPlan,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
