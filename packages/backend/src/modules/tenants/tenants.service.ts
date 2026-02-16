import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, count, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import type { Tenant, NewTenant } from './tenants.schema';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  // ---------------------------------------------------------------------------
  // Tenant CRUD
  // ---------------------------------------------------------------------------

  async create(data: {
    name: string;
    slug: string;
    domain?: string;
    plan?: string;
    ownerId: string;
  }): Promise<Tenant> {
    // Validate slug format
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(data.slug)) {
      throw new BadRequestException(
        'Slug must be lowercase alphanumeric with optional hyphens, 1-63 characters',
      );
    }

    // Check reserved slugs
    const reserved = new Set([
      'www',
      'api',
      'app',
      'admin',
      'mail',
      'status',
      'docs',
      'platform',
      'billing',
      'support',
    ]);
    if (reserved.has(data.slug)) {
      throw new ConflictException(`Slug "${data.slug}" is reserved`);
    }

    // Check uniqueness
    const existing = await this.findBySlug(data.slug);
    if (existing) {
      throw new ConflictException(`Slug "${data.slug}" is already taken`);
    }

    const [tenant] = await this.db
      .insert(schema.tenants)
      .values({
        name: data.name,
        slug: data.slug,
        domain: data.domain || null,
        plan: data.plan || 'free',
      })
      .returning();

    // Add creator as owner
    await this.db.insert(schema.tenantMembers).values({
      tenantId: tenant.id,
      userId: data.ownerId,
      role: 'owner',
    });

    this.logger.log(`Tenant created: ${tenant.slug} (${tenant.id})`);
    return tenant;
  }

  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, id))
      .limit(1);
    return tenant || null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const [tenant] = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);
    return tenant || null;
  }

  async findByDomain(domain: string): Promise<Tenant | null> {
    const [tenant] = await this.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.domain, domain))
      .limit(1);
    return tenant || null;
  }

  async findAll(): Promise<Tenant[]> {
    return this.db.select().from(schema.tenants).orderBy(schema.tenants.name);
  }

  async update(
    id: string,
    data: Partial<
      Pick<NewTenant, 'name' | 'domain' | 'plan' | 'maxUsers' | 'features' | 'status'>
    >,
  ): Promise<Tenant> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    const [updated] = await this.db
      .update(schema.tenants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, id))
      .returning();

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Branding
  // ---------------------------------------------------------------------------

  async updateBranding(
    id: string,
    branding: {
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      appName?: string;
    },
  ): Promise<Tenant> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Tenant not found');
    }

    // Validate color format
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    if (branding.primaryColor && !colorRegex.test(branding.primaryColor)) {
      throw new BadRequestException('primaryColor must be a valid hex color (e.g., #10b981)');
    }
    if (branding.accentColor && !colorRegex.test(branding.accentColor)) {
      throw new BadRequestException('accentColor must be a valid hex color (e.g., #f59e0b)');
    }

    const [updated] = await this.db
      .update(schema.tenants)
      .set({
        ...branding,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, id))
      .returning();

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Feature flags
  // ---------------------------------------------------------------------------

  async getFeatures(id: string): Promise<string[]> {
    const tenant = await this.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');

    try {
      return tenant.features ? JSON.parse(tenant.features) : [];
    } catch {
      return [];
    }
  }

  async setFeatures(id: string, features: string[]): Promise<Tenant> {
    return this.update(id, { features: JSON.stringify(features) });
  }

  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const features = await this.getFeatures(tenantId);
    return features.includes(feature);
  }

  // ---------------------------------------------------------------------------
  // Member management
  // ---------------------------------------------------------------------------

  async getMembers(tenantId: string) {
    return this.db
      .select({
        id: schema.tenantMembers.id,
        userId: schema.tenantMembers.userId,
        role: schema.tenantMembers.role,
        createdAt: schema.tenantMembers.createdAt,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.tenantMembers)
      .innerJoin(schema.users, eq(schema.tenantMembers.userId, schema.users.id))
      .where(eq(schema.tenantMembers.tenantId, tenantId))
      .orderBy(schema.tenantMembers.createdAt);
  }

  async addMember(
    tenantId: string,
    userId: string,
    role: string = 'member',
  ) {
    const tenant = await this.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Check max users limit
    const [memberCount] = await this.db
      .select({ count: count() })
      .from(schema.tenantMembers)
      .where(eq(schema.tenantMembers.tenantId, tenantId));

    if (tenant.maxUsers && memberCount.count >= tenant.maxUsers) {
      throw new BadRequestException(
        `Tenant has reached its maximum of ${tenant.maxUsers} members`,
      );
    }

    // Check if already a member
    const [existing] = await this.db
      .select()
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenantId),
          eq(schema.tenantMembers.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('User is already a member of this tenant');
    }

    const [member] = await this.db
      .insert(schema.tenantMembers)
      .values({ tenantId, userId, role })
      .returning();

    this.logger.log(
      `Member added to tenant ${tenantId}: user=${userId}, role=${role}`,
    );
    return member;
  }

  async removeMember(tenantId: string, userId: string) {
    // Prevent removing the last owner
    const owners = await this.db
      .select()
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenantId),
          eq(schema.tenantMembers.role, 'owner'),
        ),
      );

    const isRemovingOwner = owners.some((o) => o.userId === userId);
    if (isRemovingOwner && owners.length <= 1) {
      throw new BadRequestException(
        'Cannot remove the last owner of a tenant. Transfer ownership first.',
      );
    }

    const result = await this.db
      .delete(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenantId),
          eq(schema.tenantMembers.userId, userId),
        ),
      )
      .returning();

    if (result.length === 0) {
      throw new NotFoundException('Member not found in this tenant');
    }

    this.logger.log(
      `Member removed from tenant ${tenantId}: user=${userId}`,
    );
  }

  async changeMemberRole(
    tenantId: string,
    userId: string,
    newRole: string,
  ) {
    const [membership] = await this.db
      .select()
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenantId),
          eq(schema.tenantMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Member not found in this tenant');
    }

    // Prevent demoting the last owner
    if (membership.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await this.db
        .select({ count: count() })
        .from(schema.tenantMembers)
        .where(
          and(
            eq(schema.tenantMembers.tenantId, tenantId),
            eq(schema.tenantMembers.role, 'owner'),
          ),
        );

      if (ownerCount[0].count <= 1) {
        throw new BadRequestException(
          'Cannot demote the last owner. Promote another member to owner first.',
        );
      }
    }

    const [updated] = await this.db
      .update(schema.tenantMembers)
      .set({ role: newRole })
      .where(eq(schema.tenantMembers.id, membership.id))
      .returning();

    return updated;
  }

  async getUserTenants(userId: string) {
    return this.db
      .select({
        id: schema.tenants.id,
        name: schema.tenants.name,
        slug: schema.tenants.slug,
        plan: schema.tenants.plan,
        status: schema.tenants.status,
        role: schema.tenantMembers.role,
        logoUrl: schema.tenants.logoUrl,
        appName: schema.tenants.appName,
        primaryColor: schema.tenants.primaryColor,
      })
      .from(schema.tenantMembers)
      .innerJoin(
        schema.tenants,
        eq(schema.tenantMembers.tenantId, schema.tenants.id),
      )
      .where(eq(schema.tenantMembers.userId, userId))
      .orderBy(schema.tenants.name);
  }

  // ---------------------------------------------------------------------------
  // Status management
  // ---------------------------------------------------------------------------

  async suspend(id: string): Promise<Tenant> {
    return this.update(id, { status: 'suspended' });
  }

  async activate(id: string): Promise<Tenant> {
    return this.update(id, { status: 'active' });
  }

  // ---------------------------------------------------------------------------
  // Platform stats
  // ---------------------------------------------------------------------------

  async getPlatformStats() {
    const [tenantStats] = await this.db
      .select({
        total: count(),
        active: count(
          sql`CASE WHEN ${schema.tenants.status} = 'active' THEN 1 END`,
        ),
        trial: count(
          sql`CASE WHEN ${schema.tenants.status} = 'trial' THEN 1 END`,
        ),
        suspended: count(
          sql`CASE WHEN ${schema.tenants.status} = 'suspended' THEN 1 END`,
        ),
      })
      .from(schema.tenants);

    const [memberStats] = await this.db
      .select({ total: count() })
      .from(schema.tenantMembers);

    const planBreakdown = await this.db
      .select({
        plan: schema.tenants.plan,
        count: count(),
      })
      .from(schema.tenants)
      .groupBy(schema.tenants.plan);

    return {
      tenants: tenantStats,
      totalMembers: memberStats.total,
      planBreakdown,
    };
  }

  // ---------------------------------------------------------------------------
  // Domain resolution (for public endpoint)
  // ---------------------------------------------------------------------------

  async resolveByDomain(domain: string) {
    const tenant = await this.findByDomain(domain);
    if (!tenant) {
      // Try slug-based lookup (subdomain)
      return this.findBySlug(domain);
    }
    return tenant;
  }
}
