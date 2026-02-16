import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards';
import { RequiresPlatformAdmin } from './tenant.guard';
import { TenantsService } from './tenants.service';

@Controller('api/admin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantAdminController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /api/admin/tenants - List all tenants (platform admin only).
   */
  @Get()
  @RequiresPlatformAdmin()
  async listAll() {
    return this.tenantsService.findAll();
  }

  /**
   * GET /api/admin/tenants/stats - Platform-wide tenant statistics.
   */
  @Get('stats')
  @RequiresPlatformAdmin()
  async getStats() {
    return this.tenantsService.getPlatformStats();
  }

  /**
   * POST /api/admin/tenants/:id/suspend - Suspend a tenant.
   */
  @Post(':id/suspend')
  @RequiresPlatformAdmin()
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(id);
  }

  /**
   * POST /api/admin/tenants/:id/activate - Activate a tenant.
   */
  @Post(':id/activate')
  @RequiresPlatformAdmin()
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    return this.tenantsService.activate(id);
  }
}
