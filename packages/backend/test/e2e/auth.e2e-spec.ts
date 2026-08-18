import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import * as argon2 from 'argon2';
import {
  createE2EApp,
  closeE2EApp,
  generateAccessToken,
  generateExpiredToken,
  mockQuery,
  TEST_USER,
  type E2ETestContext,
} from './setup';

// Mock argon2 at the module level for deterministic behavior
vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('mocked-hash'),
  verify: vi.fn().mockResolvedValue(false),
  argon2id: 2,
}));

// Mock crypto.randomBytes for deterministic refresh tokens
// Note: vi.mock is hoisted, so we cannot reference top-level const variables.
// Instead, inline the value directly.
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue(Buffer.from('a'.repeat(64), 'hex')),
  };
});

describe('Auth E2E - /auth', () => {
  let ctx: E2ETestContext;
  let server: any;

  beforeAll(async () => {
    ctx = await createE2EApp();
    server = ctx.app.getHttpServer();
  });

  afterAll(async () => {
    await closeE2EApp(ctx);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    ctx.mockUsersService.findByEmail.mockResolvedValue(null);
    ctx.mockUsersService.findById.mockResolvedValue(null);
    ctx.mockUsersService.count.mockResolvedValue(0);

    // Setup mock db for session operations
    ctx.mockDb.insert.mockReturnValue(mockQuery([]));
    ctx.mockDb.delete.mockReturnValue(mockQuery([]));
    ctx.mockDb.select.mockReturnValue(mockQuery([]));
  });

  // =========================================================================
  // POST /auth/register
  // =========================================================================
  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      ctx.mockUsersService.findByEmail.mockResolvedValue(null);
      ctx.mockUsersService.create.mockResolvedValue({
        id: 'user-new',
        email: 'newuser@test.com',
        name: 'New User',
      });

      const res = await request(server)
        .post('/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          password: 'SecurePass123!',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn');
      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');
      expect(typeof res.body.expiresIn).toBe('number');
    });

    it('should return 409 when email is already registered', async () => {
      ctx.mockUsersService.findByEmail.mockResolvedValue(TEST_USER);

      const res = await request(server)
        .post('/auth/register')
        .send({
          name: 'Duplicate User',
          email: TEST_USER.email,
          password: 'SecurePass123!',
        })
        .expect(409);

      expect(res.body.message).toBe('Email already registered');
    });

    it('should return 400 for weak password (too short)', async () => {
      const res = await request(server)
        .post('/auth/register')
        .send({
          name: 'Weak Password',
          email: 'weak@test.com',
          password: 'Ab1!',
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('at least 8 characters')]),
      );
    });

    it('should return 400 for password without uppercase letter', async () => {
      const res = await request(server)
        .post('/auth/register')
        .send({
          name: 'No Uppercase',
          email: 'nouppercase@test.com',
          password: 'alllowercase123!',
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('uppercase letter')]),
      );
    });

    it('should return 400 for password without number', async () => {
      const res = await request(server)
        .post('/auth/register')
        .send({
          name: 'No Number',
          email: 'nonumber@test.com',
          password: 'NoNumberHere!',
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('one number')]),
      );
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(server)
        .post('/auth/register')
        .send({ email: 'incomplete@test.com' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'SecurePass123!',
        })
        .expect(400);
    });

    it('should return 400 when name is empty string', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          name: '',
          email: 'emptyname@test.com',
          password: 'SecurePass123!',
        })
        .expect(400);
    });
  });

  // =========================================================================
  // POST /auth/login
  // =========================================================================
  describe('POST /auth/login', () => {
    it('should login with valid credentials and return tokens', async () => {
      ctx.mockUsersService.findByEmail.mockResolvedValue(TEST_USER);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const res = await request(server)
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'CorrectPass123!' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn');
    });

    it('should return 401 for wrong password', async () => {
      ctx.mockUsersService.findByEmail.mockResolvedValue(TEST_USER);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      const res = await request(server)
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'WrongPassword1!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      ctx.mockUsersService.findByEmail.mockResolvedValue(null);

      const res = await request(server)
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: 'SomePass123!' })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 400 when email is missing', async () => {
      await request(server).post('/auth/login').send({ password: 'SomePass123!' }).expect(400);
    });

    it('should return 400 when password is missing', async () => {
      await request(server).post('/auth/login').send({ email: 'user@test.com' }).expect(400);
    });

    it('should return 400 when TOTP is required but not provided', async () => {
      const totpUser = { ...TEST_USER, totpEnabled: true };
      ctx.mockUsersService.findByEmail.mockResolvedValue(totpUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const res = await request(server)
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'CorrectPass123!' })
        .expect(400);

      expect(res.body.message).toBe('TOTP code required');
      expect(res.body.code).toBe('TOTP_REQUIRED');
    });
  });

  // =========================================================================
  // POST /auth/refresh
  // =========================================================================
  describe('POST /auth/refresh', () => {
    it('should refresh tokens with a valid refresh token', async () => {
      const mockSession = {
        id: 'session-1',
        userId: TEST_USER.id,
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      // select().from().where().limit() chain for session lookup
      const selectChain = mockQuery([mockSession]);
      ctx.mockDb.select.mockReturnValueOnce(selectChain);

      // delete().where() for old session cleanup
      const deleteChain = mockQuery(undefined);
      ctx.mockDb.delete.mockReturnValue(deleteChain);

      // insert().values() for new session
      ctx.mockDb.insert.mockReturnValue(mockQuery([]));

      ctx.mockUsersService.findById.mockResolvedValue(TEST_USER);

      const res = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('expiresIn');
    });

    it('should return 401 for invalid refresh token', async () => {
      // Return empty array = no session found
      ctx.mockDb.select.mockReturnValueOnce(mockQuery([]));

      const res = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(res.body.message).toBe('Invalid refresh token');
    });

    it('should return 401 for expired refresh token', async () => {
      const expiredSession = {
        id: 'session-expired',
        userId: TEST_USER.id,
        refreshToken: 'expired-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // 1s ago
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      ctx.mockDb.select.mockReturnValueOnce(mockQuery([expiredSession]));
      ctx.mockDb.delete.mockReturnValue(mockQuery(undefined));

      const res = await request(server)
        .post('/auth/refresh')
        .send({ refreshToken: 'expired-token' })
        .expect(401);

      expect(res.body.message).toBe('Refresh token expired');
    });

    it('should return 400 when refreshToken field is missing', async () => {
      await request(server).post('/auth/refresh').send({}).expect(400);
    });
  });

  // =========================================================================
  // POST /auth/change-password
  // =========================================================================
  describe('POST /auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const token = generateAccessToken(ctx.jwtService);

      ctx.mockUsersService.findById.mockResolvedValue(TEST_USER);
      ctx.mockUsersService.findByEmail.mockResolvedValue(TEST_USER);
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.hash).mockResolvedValue('new-hashed-password');
      ctx.mockUsersService.updatePassword.mockResolvedValue(undefined);
      ctx.mockDb.delete.mockReturnValue(mockQuery(undefined));
      ctx.mockDb.insert.mockReturnValue(mockQuery([]));

      const res = await request(server)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldSecurePass1!',
          newPassword: 'NewSecurePass1!',
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for wrong current password', async () => {
      const token = generateAccessToken(ctx.jwtService);

      ctx.mockUsersService.findById.mockResolvedValue(TEST_USER);
      ctx.mockUsersService.findByEmail.mockResolvedValue(TEST_USER);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      const res = await request(server)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongOldPass1!',
          newPassword: 'NewSecurePass1!',
        })
        .expect(401);

      expect(res.body.message).toBe('Current password is incorrect');
    });

    it('should return 400 for weak new password', async () => {
      const token = generateAccessToken(ctx.jwtService);

      await request(server)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldSecurePass1!',
          newPassword: 'weak',
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(server)
        .post('/auth/change-password')
        .send({
          currentPassword: 'OldSecurePass1!',
          newPassword: 'NewSecurePass1!',
        })
        .expect(401);
    });
  });

  // =========================================================================
  // GET /auth/me - Protected route
  // =========================================================================
  describe('GET /auth/me', () => {
    it('should return current user with valid token', async () => {
      const token = generateAccessToken(ctx.jwtService);

      const res = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({
        id: TEST_USER.id,
        email: TEST_USER.email,
      });
    });

    it('should return 401 without token', async () => {
      await request(server).get('/auth/me').expect(401);
    });

    it('should return 401 with expired token', async () => {
      const expired = generateExpiredToken(ctx.jwtService);
      // Small delay to ensure the token is truly expired
      await new Promise((resolve) => setTimeout(resolve, 50));

      await request(server).get('/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('should return 401 with malformed token', async () => {
      await request(server)
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-valid-jwt-token')
        .expect(401);
    });
  });

  // =========================================================================
  // POST /auth/logout
  // =========================================================================
  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const token = generateAccessToken(ctx.jwtService);
      ctx.mockDb.delete.mockReturnValue(mockQuery(undefined));

      const res = await request(server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken: 'some-refresh-token' })
        .expect(200);

      expect(res.body.message).toBe('Logged out');
    });
  });

  // =========================================================================
  // GET /auth/first-run
  // =========================================================================
  describe('GET /auth/first-run', () => {
    it('should return isFirstRun true when no users exist', async () => {
      ctx.mockUsersService.count.mockResolvedValue(0);

      const res = await request(server).get('/auth/first-run').expect(200);

      expect(res.body.isFirstRun).toBe(true);
    });

    it('should return isFirstRun false when users exist', async () => {
      ctx.mockUsersService.count.mockResolvedValue(5);

      const res = await request(server).get('/auth/first-run').expect(200);

      expect(res.body.isFirstRun).toBe(false);
    });

    it('should be accessible without authentication (public route)', async () => {
      ctx.mockUsersService.count.mockResolvedValue(0);

      // No Authorization header
      await request(server).get('/auth/first-run').expect(200);
    });
  });

  // =========================================================================
  // GET /auth/sessions
  // =========================================================================
  describe('GET /auth/sessions', () => {
    it('should return active sessions for authenticated user', async () => {
      const token = generateAccessToken(ctx.jwtService);
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: '2026-01-01T00:00:00.000Z',
          expiresAt: '2026-01-08T00:00:00.000Z',
        },
      ];

      const selectChain = mockQuery(mockSessions);
      ctx.mockDb.select.mockReturnValueOnce(selectChain);

      const res = await request(server)
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(server).get('/auth/sessions').expect(401);
    });
  });
});
