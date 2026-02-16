import {
  Injectable,
  NestMiddleware,
  Logger,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

/**
 * Middleware that resolves the current tenant from:
 *   1. X-Tenant-ID header (API access)
 *   2. Subdomain (e.g., acme.financeowl.com -> slug 'acme')
 *   3. Custom domain lookup
 *
 * When no tenant is resolved, the app works in single-tenant mode (no tenant attached).
 * This makes multi-tenancy entirely optional.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  /** Simple in-memory cache: slug/domain -> tenant, with TTL */
  private cache = new Map<
    string,
    { tenant: typeof schema.tenants.$inferSelect; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const tenant = await this.resolveTenant(req);

      if (tenant) {
        if (tenant.status === 'suspended') {
          _res.status(403).json({
            statusCode: 403,
            message: 'This tenant account has been suspended.',
          });
          return;
        }

        // Check trial expiry
        if (
          tenant.status === 'trial' &&
          tenant.trialEndsAt &&
          new Date(tenant.trialEndsAt) < new Date()
        ) {
          _res.status(403).json({
            statusCode: 403,
            message:
              'Trial period has ended. Please upgrade to continue using the service.',
          });
          return;
        }

        (req as any).tenant = tenant;
      }
      // If no tenant resolved, continue without one (single-tenant mode)
    } catch (error) {
      this.logger.warn(`Tenant resolution failed: ${error}`);
      // Continue without tenant - graceful degradation to single-tenant mode
    }

    next();
  }

  private async resolveTenant(req: Request) {
    // Strategy 1: X-Tenant-ID header
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenantId) {
      return this.findTenantById(headerTenantId);
    }

    // Strategy 2: X-Tenant-Slug header (convenience)
    const headerTenantSlug = req.headers['x-tenant-slug'] as
      | string
      | undefined;
    if (headerTenantSlug) {
      return this.findTenantBySlug(headerTenantSlug);
    }

    // Strategy 3: Subdomain extraction
    const host = req.hostname || req.headers.host?.split(':')[0] || '';
    const slug = this.extractSubdomain(host);
    if (slug) {
      return this.findTenantBySlug(slug);
    }

    // Strategy 4: Custom domain lookup (full hostname)
    if (host && !this.isMainDomain(host)) {
      return this.findTenantByDomain(host);
    }

    return null;
  }

  private extractSubdomain(host: string): string | null {
    // Skip localhost / IP addresses
    if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return null;
    }

    const parts = host.split('.');

    // Need at least 3 parts for subdomain (e.g., acme.financeowl.com)
    if (parts.length < 3) {
      return null;
    }

    const subdomain = parts[0];

    // Skip common non-tenant subdomains
    const reserved = new Set([
      'www',
      'api',
      'app',
      'admin',
      'mail',
      'status',
      'docs',
    ]);
    if (reserved.has(subdomain)) {
      return null;
    }

    return subdomain;
  }

  private isMainDomain(host: string): boolean {
    // Add your main domain(s) here
    const mainDomains = new Set([
      'localhost',
      'financeowl.com',
      'www.financeowl.com',
      'app.financeowl.com',
    ]);
    return mainDomains.has(host);
  }

  private async findTenantById(id: string) {
    const cached = this.getFromCache(`id:${id}`);
    if (cached) return cached;

    const [tenant] = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, id))
      .limit(1);

    if (tenant) {
      this.setCache(`id:${id}`, tenant);
      this.setCache(`slug:${tenant.slug}`, tenant);
    }

    return tenant || null;
  }

  private async findTenantBySlug(slug: string) {
    const cached = this.getFromCache(`slug:${slug}`);
    if (cached) return cached;

    const [tenant] = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);

    if (tenant) {
      this.setCache(`slug:${slug}`, tenant);
      this.setCache(`id:${tenant.id}`, tenant);
    }

    return tenant || null;
  }

  private async findTenantByDomain(domain: string) {
    const cached = this.getFromCache(`domain:${domain}`);
    if (cached) return cached;

    const [tenant] = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.domain, domain))
      .limit(1);

    if (tenant) {
      this.setCache(`domain:${domain}`, tenant);
      this.setCache(`slug:${tenant.slug}`, tenant);
      this.setCache(`id:${tenant.id}`, tenant);
    }

    return tenant || null;
  }

  private getFromCache(
    key: string,
  ): typeof schema.tenants.$inferSelect | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.tenant;
  }

  private setCache(
    key: string,
    tenant: typeof schema.tenants.$inferSelect,
  ) {
    this.cache.set(key, {
      tenant,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }
}
