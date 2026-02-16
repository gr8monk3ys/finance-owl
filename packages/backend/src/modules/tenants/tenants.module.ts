import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantMiddleware } from './tenant.middleware';
import { TenantGuard } from './tenant.guard';

@Module({
  providers: [TenantsService, TenantGuard],
  controllers: [TenantsController, TenantAdminController],
  exports: [TenantsService],
})
export class TenantsModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant middleware to all API routes.
    // The middleware is graceful: if no tenant is resolved, the app continues
    // in single-tenant mode. This makes multi-tenancy entirely optional.
    consumer.apply(TenantMiddleware).forRoutes({
      path: 'api/*',
      method: RequestMethod.ALL,
    });
  }
}
