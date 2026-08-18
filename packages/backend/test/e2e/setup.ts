/**
 * E2E Test Setup
 *
 * Bootstraps a NestJS TestingModule with mocked database layer,
 * allowing full HTTP-level E2E tests without a real PostgreSQL instance.
 *
 * Uses real AuthModule (with overrides) for JWT auth, and creates
 * a lightweight test module for other controllers with mocked services.
 *
 * Requires unplugin-swc in the vitest config to emit decorator metadata
 * for NestJS constructor-based DI.
 */
import { Module, Global } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';

import { DATABASE_TOKEN } from '@/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { CryptoModule } from '@/common/crypto/crypto.module';
import { UsersService } from '@/modules/users/users.service';
import { TotpService } from '@/modules/auth/totp.service';
import { CryptoService } from '@/common/crypto/crypto.service';
import { EncryptionService } from '@/common/crypto/encryption.service';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { TransactionsController } from '@/modules/transactions/transactions.controller';
import { TransactionSplitService } from '@/modules/transactions/transaction-split.service';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { BudgetsController } from '@/modules/budgets/budgets.controller';
import { AccountsService } from '@/modules/accounts/accounts.service';
import { AccountsController } from '@/modules/accounts/accounts.controller';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const JWT_SECRET = 'e2e-test-jwt-secret-that-is-definitely-long-enough-for-security';
export const ENCRYPTION_KEY = '0'.repeat(64);

export const TEST_USER = {
  id: 'user-e2e-001',
  email: 'testuser@financeowl.test',
  name: 'E2E Test User',
  passwordHash: 'hashed-password-placeholder',
  totpEnabled: false,
  totpSecret: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

export const OTHER_USER = {
  id: 'user-e2e-002',
  email: 'otheruser@financeowl.test',
  name: 'Other User',
  passwordHash: 'hashed-password-placeholder',
  totpEnabled: false,
  totpSecret: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Mock Drizzle Query Builder
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock that mimics Drizzle's query builder.
 * Awaiting the chain resolves to `data`.
 */
export function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
    'groupBy',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

/**
 * Creates a fresh mock database object that can be configured per-test.
 */
export function createMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Application Bootstrap
// ---------------------------------------------------------------------------

export interface E2ETestContext {
  app: INestApplication;
  module: TestingModule;
  jwtService: JwtService;
  mockDb: ReturnType<typeof createMockDb>;
  mockUsersService: any;
  mockTotpService: any;
  mockTransactionsService: any;
  mockSplitService: any;
  mockBudgetsService: any;
  mockAccountsService: any;
}

/**
 * Create mock service factories. These use vi.fn() for each method
 * so tests can configure return values per-test.
 */
function createMockServices() {
  return {
    mockUsersService: {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updatePassword: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      setTotpSecret: vi.fn(),
    },
    mockTotpService: {
      verifyCode: vi.fn().mockResolvedValue(true),
      generateSecret: vi.fn(),
      enableTotp: vi.fn(),
      disableTotp: vi.fn(),
    },
    mockTransactionsService: {
      findAll: vi.fn(),
      findById: vi.fn(),
      createManual: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    mockSplitService: {
      splitTransaction: vi.fn(),
      getSplits: vi.fn(),
      updateSplits: vi.fn(),
      removeSplits: vi.fn(),
    },
    mockBudgetsService: {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getSummary: vi.fn(),
      processRollovers: vi.fn(),
    },
    mockAccountsService: {
      findAll: vi.fn(),
      findById: vi.fn(),
      createManual: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      getNetWorth: vi.fn(),
    },
    mockCryptoService: {
      encrypt: vi.fn().mockReturnValue('encrypted'),
      decrypt: vi.fn().mockReturnValue('decrypted'),
    },
    mockEncryptionService: {
      encrypt: vi.fn().mockReturnValue('encrypted-data'),
      decrypt: vi.fn().mockReturnValue('decrypted-data'),
      onModuleInit: vi.fn(),
    },
  };
}

/**
 * Bootstrap the full E2E NestJS application with mocked services.
 *
 * Strategy:
 * - Use the real AuthModule (which has proper DI decorators) for auth/JWT
 * - Create a lightweight test module for Transactions/Budgets/Accounts controllers
 *   using explicit provider token overrides
 * - Override all database and external service providers with mocks
 *
 * Requires unplugin-swc in vitest config to emit decorator metadata.
 */
export async function createE2EApp(): Promise<E2ETestContext> {
  // Set environment variables for ConfigService
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = JWT_SECRET;
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_EXPIRY = '15m';
  process.env.JWT_REFRESH_EXPIRY = '7d';

  const mockDb = createMockDb();
  const mocks = createMockServices();

  // Create a global mock database module that mirrors the real @Global()
  // DatabaseModule but provides a mock instead of connecting to PostgreSQL.
  @Global()
  @Module({
    providers: [{ provide: DATABASE_TOKEN, useValue: mockDb }],
    exports: [DATABASE_TOKEN],
  })
  class MockDatabaseModule {}

  // Create a lightweight module for controllers that avoids the heavy
  // AiModule -> JobsModule -> BullMQ -> Redis dependency chain.
  // We provide mock services directly using explicit tokens.
  @Module({
    controllers: [TransactionsController, BudgetsController, AccountsController],
    providers: [
      { provide: TransactionsService, useValue: mocks.mockTransactionsService },
      { provide: TransactionSplitService, useValue: mocks.mockSplitService },
      { provide: BudgetsService, useValue: mocks.mockBudgetsService },
      { provide: AccountsService, useValue: mocks.mockAccountsService },
    ],
  })
  class TestControllersModule {}

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            JWT_SECRET,
            JWT_REFRESH_SECRET: JWT_SECRET,
            ENCRYPTION_KEY,
            DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
            JWT_ACCESS_EXPIRY: '15m',
            JWT_REFRESH_EXPIRY: '7d',
          }),
        ],
      }),
      // Mock database module (globally available, replaces real DatabaseModule)
      MockDatabaseModule,
      // Real AuthModule provides JWT auth, JwtAuthGuard (APP_GUARD), JwtStrategy
      AuthModule,
      UsersModule,
      CryptoModule,
      // Lightweight controller module with mock services
      TestControllersModule,
    ],
  })
    // Override auth-related services
    .overrideProvider(UsersService)
    .useValue(mocks.mockUsersService)
    .overrideProvider(TotpService)
    .useValue(mocks.mockTotpService)
    .overrideProvider(CryptoService)
    .useValue(mocks.mockCryptoService)
    .overrideProvider(EncryptionService)
    .useValue(mocks.mockEncryptionService)
    .compile();

  const app = moduleFixture.createNestApplication();

  // Apply the same global pipes as production (main.ts)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  await app.init();

  const jwtService = moduleFixture.get<JwtService>(JwtService);

  return {
    app,
    module: moduleFixture,
    jwtService,
    mockDb,
    ...mocks,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a valid JWT access token for the given user.
 */
export function generateAccessToken(
  jwtService: JwtService,
  user: { id: string; email: string } = TEST_USER,
): string {
  return jwtService.sign({ sub: user.id, email: user.email }, { expiresIn: '15m' });
}

/**
 * Generate an expired JWT token for testing 401 scenarios.
 */
export function generateExpiredToken(jwtService: JwtService): string {
  return jwtService.sign({ sub: TEST_USER.id, email: TEST_USER.email }, { expiresIn: '0s' });
}

/**
 * Cleanup helper to close the application and release resources.
 */
export async function closeE2EApp(ctx: E2ETestContext): Promise<void> {
  if (ctx?.app) {
    await ctx.app.close();
  }
}
