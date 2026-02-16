import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the current tenant from the request.
 * The tenant is attached by TenantMiddleware.
 *
 * Usage:
 *   @CurrentTenant() tenant          // full tenant object
 *   @CurrentTenant('id') tenantId    // just the tenant id
 *   @CurrentTenant('slug') slug      // just the slug
 */
export const CurrentTenant = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;
    return data ? tenant?.[data] : tenant;
  },
);
