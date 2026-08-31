import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './common/cache/cache.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { BankSyncModule } from './modules/bank-sync/bank-sync.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { HouseholdsModule } from './modules/households/households.module';
import { AuditModule } from './modules/audit/audit.module';
import { SavingsGoalsModule } from './modules/savings-goals/savings-goals.module';
import { BillingModule } from './modules/billing/billing.module';
import { EmailModule } from './modules/email/email.module';
import { ImportModule } from './modules/import/import.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { AccountDeletionModule } from './modules/account-deletion/account-deletion.module';
import { SupportModule } from './modules/support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
      // E2E suites drive many logins from a single address; production
      // deployments must never set DISABLE_RATE_LIMITING.
      skipIf: () => process.env.DISABLE_RATE_LIMITING === '1',
    }),
    DatabaseModule,
    CacheModule,
    CryptoModule,
    JobsModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    BankSyncModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    NotificationsModule,
    SubscriptionsModule,
    HouseholdsModule,
    AuditModule,
    SavingsGoalsModule,
    BillingModule,
    EmailModule,
    ImportModule,
    ObservabilityModule,
    AccountDeletionModule,
    SupportModule,
  ],
  providers: [
    // Global throttle guard (NestJS @nestjs/throttler)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Custom token-bucket rate limiter (per-route via @RateLimit decorator)
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    // Audit-log interceptor (writes to audit_log table for @AuditAction routes)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    // Global input sanitisation -- strips HTML tags from all string inputs
    {
      provide: APP_PIPE,
      useClass: SanitizePipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply security headers to every route
    consumer.apply(SecurityHeadersMiddleware).forRoutes('*');
  }
}
