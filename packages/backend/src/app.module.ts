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
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ForecastingModule } from './modules/forecasting/forecasting.module';
import { HouseholdsModule } from './modules/households/households.module';
import { AuditModule } from './modules/audit/audit.module';
import { FlaggingModule } from './modules/flagging/flagging.module';
import { SavingsGoalsModule } from './modules/savings-goals/savings-goals.module';
import { BillingModule } from './modules/billing/billing.module';
import { EmailModule } from './modules/email/email.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CreditModule } from './modules/credit/credit.module';
import { SmartSavingsModule } from './modules/smart-savings/smart-savings.module';
import { UnclaimedModule } from './modules/unclaimed/unclaimed.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { ImportModule } from './modules/import/import.module';
import { BillNegotiationModule } from './modules/bill-negotiation/bill-negotiation.module';
import { EducationModule } from './modules/education/education.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { RealEstateModule } from './modules/real-estate/real-estate.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { CreditSimulatorModule } from './modules/credit-simulator/credit-simulator.module';
import { FinancialHealthModule } from './modules/financial-health/financial-health.module';
import { ChallengesModule } from './modules/challenges/challenges.module';
import { YearReviewModule } from './modules/year-review/year-review.module';
import { TaxModule } from './modules/tax/tax.module';
import { BenchmarkingModule } from './modules/benchmarking/benchmarking.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AdvisorSharingModule } from './modules/advisor-sharing/advisor-sharing.module';
import { SocialModule } from './modules/social/social.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { BillsModule } from './modules/bills/bills.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { BankingModule } from './modules/banking/banking.module';
import { DataExportModule } from './modules/data-export/data-export.module';
import { AccountDeletionModule } from './modules/account-deletion/account-deletion.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
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
    AiModule,
    AnalyticsModule,
    BudgetsModule,
    NotificationsModule,
    SubscriptionsModule,
    InvestmentsModule,
    ReportsModule,
    ForecastingModule,
    HouseholdsModule,
    AuditModule,
    FlaggingModule,
    SavingsGoalsModule,
    BillingModule,
    EmailModule,
    IdentityModule,
    CreditModule,
    SmartSavingsModule,
    UnclaimedModule,
    RecommendationsModule,
    ImportModule,
    BillNegotiationModule,
    EducationModule,
    ReceiptsModule,
    RealEstateModule,
    VehiclesModule,
    CurrencyModule,
    CreditSimulatorModule,
    FinancialHealthModule,
    ChallengesModule,
    YearReviewModule,
    TaxModule,
    BenchmarkingModule,
    MarketplaceModule,
    ReferralsModule,
    AdvisorSharingModule,
    SocialModule,
    PrivacyModule,
    ObservabilityModule,
    BillsModule,
    TenantsModule,
    BankingModule,
    DataExportModule,
    AccountDeletionModule,
    DashboardModule,
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
