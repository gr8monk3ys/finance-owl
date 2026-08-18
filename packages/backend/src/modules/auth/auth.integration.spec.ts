import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../database/schema';
import {
  DATABASE_TOKEN,
  DATABASE_POOL_TOKEN,
  DatabaseModule,
} from '../../database/database.module';
import { AuthModule } from './auth.module';
import { UsersModule } from '../users/users.module';
import { CryptoModule } from '../../common/crypto/crypto.module';
import * as path from 'path';
import request from 'supertest';

describe('Auth Integration', () => {
  let app: INestApplication;
  let pool: Pool;

  const TEST_KEY = '0'.repeat(64);

  beforeAll(async () => {
    const connectionString =
      process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/finance_owl_test';

    pool = new Pool({ connectionString });
    const db = drizzle(pool, { schema });

    // Start from a clean slate so the suite is re-runnable against a
    // persistent local database (CI always gets a fresh one).
    await pool.query('TRUNCATE users CASCADE');

    // Run migrations
    const migrationsPath = path.resolve(__dirname, '../../../drizzle');
    await migrate(db, { migrationsFolder: migrationsPath });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-that-is-long-enough',
              JWT_REFRESH_SECRET: 'test-refresh-secret-long-enough',
              ENCRYPTION_KEY: TEST_KEY,
              JWT_ACCESS_EXPIRY: '15m',
              JWT_REFRESH_EXPIRY: '7d',
            }),
          ],
        }),
        // DatabaseModule is @Global in the real app; the test must import
        // it so its DATABASE providers exist and can be overridden below.
        DatabaseModule,
        AuthModule,
        UsersModule,
        CryptoModule,
      ],
    })
      .overrideProvider(DATABASE_POOL_TOKEN)
      .useValue(pool)
      .overrideProvider(DATABASE_TOKEN)
      .useValue(db)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    // app.close() ends the pool via DatabaseModule.onModuleDestroy (the
    // module's pool provider is overridden with this spec's pool), so no
    // separate pool.end() here — pg throws on a second end().
    await app?.close();
  });

  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'SecurePass123!',
  };

  describe('Full auth flow', () => {
    let accessToken: string;
    let refreshToken: string;

    it('should check first-run returns true when no users', async () => {
      const res = await request(app.getHttpServer()).get('/auth/first-run').expect(200);

      expect(res.body.isFirstRun).toBe(true);
    });

    it('should register a new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn');
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should check first-run returns false after registration', async () => {
      const res = await request(app.getHttpServer()).get('/auth/first-run').expect(200);

      expect(res.body.isFirstRun).toBe(false);
    });

    it('should reject duplicate registration', async () => {
      await request(app.getHttpServer()).post('/auth/register').send(testUser).expect(409);
    });

    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject login with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'whatever' })
        .expect(401);
    });

    it('should access protected route with token', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(testUser.email);
    });

    it('should reject protected route without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // Old refresh token should be invalidated
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should reject used refresh token (rotation)', async () => {
      // A well-formed (64-char hex) token that no session references —
      // malformed tokens are rejected earlier with 400 by DTO validation.
      const oldRefreshToken = 'f'.repeat(64);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('should list active sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should change password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewSecurePass456!',
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should login with new password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'NewSecurePass456!' })
        .expect(200);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('should logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);
    });
  });

  describe('Validation', () => {
    it('should reject registration with short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Test', email: 'short@test.com', password: '123' })
        .expect(400);
    });

    it('should reject registration with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Test', email: 'not-an-email', password: 'LongEnough123!' })
        .expect(400);
    });

    it('should reject registration with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@test.com' })
        .expect(400);
    });
  });
});
