import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { TenantsService } from './tenants.service';
import { CurrentTenant } from './current-tenant.decorator';
import {
  RequiresTenantMember,
  RequiresPlatformAdmin,
} from './tenant.guard';

@Controller('api/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * POST /api/tenants - Create a new tenant.
   * Only platform admins can create tenants.
   */
  @Post()
  @RequiresPlatformAdmin()
  async create(
    @Body()
    body: {
      name: string;
      slug: string;
      domain?: string;
      plan?: string;
      ownerId?: string;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantsService.create({
      name: body.name,
      slug: body.slug,
      domain: body.domain,
      plan: body.plan,
      ownerId: body.ownerId || userId,
    });
  }

  /**
   * GET /api/tenants/resolve?domain=xxx - Resolve a tenant by domain or slug.
   * Public endpoint for frontend bootstrapping.
   */
  @Get('resolve')
  @Public()
  async resolve(@Query('domain') domain: string) {
    if (!domain) {
      return null;
    }
    const tenant = await this.tenantsService.resolveByDomain(domain);
    if (!tenant) {
      return null;
    }
    // Return only public branding info
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      appName: tenant.appName,
      status: tenant.status,
    };
  }

  /**
   * GET /api/tenants/mine - Get tenants the current user belongs to.
   */
  @Get('mine')
  async getMyTenants(@CurrentUser('id') userId: string) {
    return this.tenantsService.getUserTenants(userId);
  }

  /**
   * GET /api/tenants/:id - Get tenant details.
   */
  @Get(':id')
  @RequiresTenantMember()
  async findOne(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  /**
   * PATCH /api/tenants/:id - Update tenant settings.
   */
  @Patch(':id')
  @RequiresTenantMember('admin')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      domain?: string;
      plan?: string;
      maxUsers?: number;
      features?: string;
    },
  ) {
    return this.tenantsService.update(id, body);
  }

  /**
   * PATCH /api/tenants/:id/branding - Update tenant branding.
   */
  @Patch(':id/branding')
  @RequiresTenantMember('admin')
  async updateBranding(
    @Param('id') id: string,
    @Body()
    body: {
      logoUrl?: string;
      faviconUrl?: string;
      primaryColor?: string;
      accentColor?: string;
      appName?: string;
    },
  ) {
    return this.tenantsService.updateBranding(id, body);
  }

  /**
   * GET /api/tenants/:id/members - List tenant members.
   */
  @Get(':id/members')
  @RequiresTenantMember()
  async getMembers(@Param('id') id: string) {
    return this.tenantsService.getMembers(id);
  }

  /**
   * POST /api/tenants/:id/members - Add a member to the tenant.
   */
  @Post(':id/members')
  @RequiresTenantMember('admin')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
  ) {
    return this.tenantsService.addMember(id, body.userId, body.role);
  }

  /**
   * Patch /api/tenants/:id/members/:userId/role - Change member role.
   */
  @Patch(':id/members/:userId/role')
  @RequiresTenantMember('owner')
  async changeMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: string },
  ) {
    return this.tenantsService.changeMemberRole(id, userId, body.role);
  }

  /**
   * DELETE /api/tenants/:id/members/:userId - Remove a member.
   */
  @Delete(':id/members/:userId')
  @RequiresTenantMember('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.tenantsService.removeMember(id, userId);
  }
}
