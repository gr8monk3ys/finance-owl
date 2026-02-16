import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export const TENANT_ROLE_KEY = 'tenantRole';
export const PLATFORM_ADMIN_KEY = 'platformAdmin';

/**
 * Decorator that requires the user to be a member of the current tenant.
 * Optionally specify a minimum role.
 *
 * Usage:
 *   @RequiresTenantMember()           // any tenant member
 *   @RequiresTenantMember('admin')    // admin or owner
 *   @RequiresTenantMember('owner')    // owner only
 */
export function RequiresTenantMember(minRole?: 'member' | 'admin' | 'owner') {
  return applyDecorators(
    SetMetadata(TENANT_ROLE_KEY, minRole || 'member'),
    UseGuards(TenantGuard),
  );
}

/**
 * Decorator that restricts access to platform admins only.
 * Platform admins are identified by being an owner of any tenant
 * with slug 'platform' or having an email in the PLATFORM_ADMIN_EMAILS env var.
 */
export function RequiresPlatformAdmin() {
  return applyDecorators(
    SetMetadata(PLATFORM_ADMIN_KEY, true),
    UseGuards(TenantGuard),
  );
}

const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  admin: 1,
  owner: 2,
};

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if platform admin access is required
    const requiresPlatformAdmin = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiresPlatformAdmin) {
      const isAdmin = await this.isPlatformAdmin(user.id, user.email);
      if (!isAdmin) {
        throw new ForbiddenException('Platform admin access required');
      }
      return true;
    }

    // Check tenant membership
    const tenant = request.tenant;

    // If no tenant context, allow access (single-tenant mode)
    if (!tenant) {
      return true;
    }

    // Check if user is a platform admin (override)
    const isAdmin = await this.isPlatformAdmin(user.id, user.email);
    if (isAdmin) {
      return true;
    }

    const minRole = this.reflector.getAllAndOverride<string>(
      TENANT_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!minRole) {
      return true;
    }

    // Look up membership
    const [membership] = await this.db
      .select()
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenant.id),
          eq(schema.tenantMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You are not a member of this tenant',
      );
    }

    const userRoleLevel = ROLE_HIERARCHY[membership.role] ?? 0;
    const requiredRoleLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userRoleLevel < requiredRoleLevel) {
      throw new ForbiddenException(
        `This action requires at least "${minRole}" role in this tenant`,
      );
    }

    // Attach membership to request for downstream use
    (request as any).tenantMembership = membership;

    return true;
  }

  private async isPlatformAdmin(
    userId: string,
    email: string,
  ): Promise<boolean> {
    // Check env var list of platform admin emails
    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.includes(email.toLowerCase())) {
      return true;
    }

    // Check if user is owner of the 'platform' tenant
    const [platformMembership] = await this.db
      .select({ role: schema.tenantMembers.role })
      .from(schema.tenantMembers)
      .innerJoin(
        schema.tenants,
        eq(schema.tenantMembers.tenantId, schema.tenants.id),
      )
      .where(
        and(
          eq(schema.tenants.slug, 'platform'),
          eq(schema.tenantMembers.userId, userId),
          eq(schema.tenantMembers.role, 'owner'),
        ),
      )
      .limit(1);

    return !!platformMembership;
  }
}
