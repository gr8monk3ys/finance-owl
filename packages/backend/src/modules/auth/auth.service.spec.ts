import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as argon2 from 'argon2';

// Mock argon2
vi.mock('argon2', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
  argon2id: 2, // argon2id algorithm type constant
}));

// SessionService owns refresh-token generation and hashing (see
// session.service.spec.ts); here it is a seam, so a fixed token is enough.
const MOCK_REFRESH_TOKEN = 'a'.repeat(64);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockUsersService: any;
  let mockSessionService: any;
  let mockTotpService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    totpEnabled: false,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock-access-token'),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          JWT_ACCESS_EXPIRY: '15m',
          JWT_REFRESH_EXPIRY: '7d',
          JWT_SECRET: 'test-secret',
        };
        return config[key] || defaultValue;
      }),
    };

    mockUsersService = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findCredentialsById: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn(),
      count: vi.fn(),
    };

    mockSessionService = {
      issue: vi.fn().mockResolvedValue(MOCK_REFRESH_TOKEN),
      rotate: vi.fn(),
      revoke: vi.fn(),
      revokeAll: vi.fn(),
      list: vi.fn(),
    };

    mockTotpService = {
      verifyCode: vi.fn().mockResolvedValue(true),
    };

    // Construct directly to avoid NestJS DI issues in unit tests
    service = new (AuthService as any)(
      mockJwtService,
      mockConfigService,
      mockUsersService,
      mockSessionService,
      mockTotpService,
    );
  });

  describe('register', () => {
    it('should successfully register a new user and return tokens', async () => {
      // Arrange
      const name = 'New User';
      const email = 'new@example.com';
      const password = 'SecurePass123!';
      const hashedPassword = 'hashed-password';

      mockUsersService.findByEmail.mockResolvedValue(null);
      vi.mocked(argon2.hash).mockResolvedValue(hashedPassword);
      mockUsersService.create.mockResolvedValue({
        id: 'user-new',
        email,
        name,
      });

      // Act
      const result = await service.register(name, email, password);

      // Assert
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
      expect(argon2.hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      expect(mockUsersService.create).toHaveBeenCalledWith({
        name,
        email,
        passwordHash: hashedPassword,
      });
      expect(mockSessionService.issue).toHaveBeenCalledWith('user-new', SEVEN_DAYS_MS);
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900, // 15 minutes in seconds
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register('New User', 'test@example.com', 'password')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register('New User', 'test@example.com', 'password')).rejects.toThrow(
        'Email already registered',
      );

      expect(argon2.hash).not.toHaveBeenCalled();
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully login and return tokens', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'correct-password';

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      // Act
      const result = await service.login(email, password);

      // Assert
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.passwordHash, password);
      expect(mockSessionService.issue).toHaveBeenCalledWith(mockUser.id, SEVEN_DAYS_MS);
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('nonexistent@example.com', 'password')).rejects.toThrow(
        'Invalid credentials',
      );

      expect(argon2.verify).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      // Act & Assert
      await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('test@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid credentials',
      );

      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if TOTP is enabled but code not provided', async () => {
      // Arrange
      const totpUser = { ...mockUser, totpEnabled: true };
      mockUsersService.findByEmail.mockResolvedValue(totpUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      // Act & Assert
      await expect(service.login('test@example.com', 'correct-password')).rejects.toThrow(
        BadRequestException,
      );

      const error = await service.login('test@example.com', 'correct-password').catch((e) => e);
      expect(error.response).toEqual({
        message: 'TOTP code required',
        code: 'TOTP_REQUIRED',
      });

      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });

    it('should accept login when TOTP code is provided and TOTP is enabled', async () => {
      // Arrange
      const totpUser = { ...mockUser, totpEnabled: true };
      mockUsersService.findByEmail.mockResolvedValue(totpUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      // Act
      const result = await service.login('test@example.com', 'correct-password', '123456');

      // Assert
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900,
      });
    });

    it('should reject login when TOTP verification fails', async () => {
      // Arrange — verifyCode fails closed (e.g. the row vanished mid-login)
      const totpUser = { ...mockUser, totpEnabled: true };
      mockUsersService.findByEmail.mockResolvedValue(totpUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);
      mockTotpService.verifyCode.mockResolvedValue(false);

      // Act & Assert
      await expect(service.login('test@example.com', 'correct-password', '123456')).rejects.toThrow(
        'Invalid TOTP code',
      );
      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('should rotate the session and return a new token pair', async () => {
      // Arrange
      mockSessionService.rotate.mockResolvedValue(mockUser.id);
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.refreshTokens('valid-refresh-token');

      // Assert
      expect(mockSessionService.rotate).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockSessionService.issue).toHaveBeenCalledWith(mockUser.id, SEVEN_DAYS_MS);
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900,
      });
    });

    it('should propagate the rejection when the refresh token is invalid', async () => {
      // Arrange
      mockSessionService.rotate.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      // Act & Assert
      await expect(service.refreshTokens('invalid-refresh-token')).rejects.toThrow(
        'Invalid refresh token',
      );

      expect(mockUsersService.findById).not.toHaveBeenCalled();
      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user no longer exists', async () => {
      // Arrange
      mockSessionService.rotate.mockResolvedValue(mockUser.id);
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshTokens('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('valid-refresh-token')).rejects.toThrow('User not found');

      // The presented token is consumed either way — it must not be replayable
      expect(mockSessionService.rotate).toHaveBeenCalled();
      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should change the password in a single credential lookup', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'old-password';
      const newPassword = 'new-password';
      const newPasswordHash = 'new-hashed-password';

      mockUsersService.findCredentialsById.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.hash).mockResolvedValue(newPasswordHash);

      // Act
      const result = await service.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockUsersService.findCredentialsById).toHaveBeenCalledWith(userId);
      // The old two-query dance (findById then findByEmail) is gone
      expect(mockUsersService.findById).not.toHaveBeenCalled();
      expect(mockUsersService.findByEmail).not.toHaveBeenCalled();
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.passwordHash, currentPassword);
      expect(argon2.hash).toHaveBeenCalledWith(newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(userId, newPasswordHash);
      expect(mockSessionService.revokeAll).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      // Arrange
      const userId = 'user-123';

      mockUsersService.findCredentialsById.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.changePassword(userId, 'wrong-password', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(userId, 'wrong-password', 'new-password'),
      ).rejects.toThrow('Current password is incorrect');

      expect(argon2.hash).not.toHaveBeenCalled();
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
      expect(mockSessionService.revokeAll).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if the user row is gone', async () => {
      // Arrange
      mockUsersService.findCredentialsById.mockResolvedValue(null);

      // Act & Assert — a 401, never a TypeError from dereferencing null
      await expect(
        service.changePassword('non-existent-user', 'old-password', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword('non-existent-user', 'old-password', 'new-password'),
      ).rejects.toThrow('User not found');

      expect(argon2.verify).not.toHaveBeenCalled();
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the session for the given refresh token', async () => {
      // Act
      await service.logout('refresh-token-123');

      // Assert
      expect(mockSessionService.revoke).toHaveBeenCalledWith('refresh-token-123');
    });
  });

  describe('logoutAll', () => {
    it('should revoke every session for the given user', async () => {
      // Act
      await service.logoutAll('user-123');

      // Assert
      expect(mockSessionService.revokeAll).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions for a user', async () => {
      // Arrange
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: '2024-01-01T00:00:00.000Z',
          expiresAt: '2024-01-08T00:00:00.000Z',
        },
      ];
      mockSessionService.list.mockResolvedValue(mockSessions);

      // Act
      const result = await service.getActiveSessions('user-123');

      // Assert
      expect(mockSessionService.list).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockSessions);
    });
  });

  describe('createTokensForUser', () => {
    it('should create tokens for an existing user', async () => {
      // Arrange
      const userId = 'user-123';
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.createTokensForUser(userId);

      // Assert
      expect(mockUsersService.findById).toHaveBeenCalledWith(userId);
      expect(mockSessionService.issue).toHaveBeenCalledWith(userId, SEVEN_DAYS_MS);
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createTokensForUser('non-existent-user')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.createTokensForUser('non-existent-user')).rejects.toThrow(
        'User not found',
      );

      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });
  });

  describe('isFirstRun', () => {
    it('should return true when no users exist', async () => {
      // Arrange
      mockUsersService.count.mockResolvedValue(0);

      // Act
      const result = await service.isFirstRun();

      // Assert
      expect(mockUsersService.count).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when users exist', async () => {
      // Arrange
      mockUsersService.count.mockResolvedValue(5);

      // Act
      const result = await service.isFirstRun();

      // Assert
      expect(mockUsersService.count).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('token expiries', () => {
    it('should sign the JWT with the configured access expiry verbatim', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      await service.createTokensForUser('user-123');

      // Assert
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-123', email: mockUser.email },
        { expiresIn: '15m' },
      );
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_ACCESS_EXPIRY', '15m');
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_REFRESH_EXPIRY', '7d');
    });

    it('should parse expiries with ms, in agreement with @nestjs/jwt', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRY') return '30m';
        if (key === 'JWT_REFRESH_EXPIRY') return '14d';
        return undefined;
      });
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.createTokensForUser('user-123');

      // Assert — 30m = 1800 seconds
      expect(result.expiresIn).toBe(1800);
      expect(mockSessionService.issue).toHaveBeenCalledWith('user-123', 14 * 24 * 60 * 60 * 1000);
      expect(mockJwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
        expiresIn: '30m',
      });
    });

    it('should honour units the old hand-rolled parser silently dropped', async () => {
      // Regression: `1w` used to fall back to 15 minutes for the session row
      // while @nestjs/jwt happily signed a week-long token.
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRY') return '1h';
        if (key === 'JWT_REFRESH_EXPIRY') return '1w';
        return undefined;
      });
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.createTokensForUser('user-123');

      // Assert
      expect(result.expiresIn).toBe(3600);
      expect(mockSessionService.issue).toHaveBeenCalledWith('user-123', SEVEN_DAYS_MS);
    });

    it('should throw rather than silently default when an expiry is unparseable', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRY') return '15m';
        if (key === 'JWT_REFRESH_EXPIRY') return 'not-a-duration';
        return undefined;
      });
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.createTokensForUser('user-123')).rejects.toThrow(
        /JWT_REFRESH_EXPIRY must be a positive duration/,
      );
      expect(mockSessionService.issue).not.toHaveBeenCalled();
    });
  });
});
