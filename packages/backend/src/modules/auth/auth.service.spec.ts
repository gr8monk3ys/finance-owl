import { createHash } from 'crypto';
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

// Mock crypto.randomBytes to return predictable values
const MOCK_REFRESH_TOKEN_HEX = 'a'.repeat(64); // 32 bytes as hex = 64 chars
// The service persists only the SHA-256 digest of the refresh token
const MOCK_REFRESH_TOKEN_HASH = createHash('sha256').update(MOCK_REFRESH_TOKEN_HEX).digest('hex');
const mockRandomBytes = vi.fn().mockReturnValue(Buffer.from(MOCK_REFRESH_TOKEN_HEX, 'hex'));
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: (...args: any[]) => mockRandomBytes(...args),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockUsersService: any;
  let mockTotpService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    totpEnabled: false,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    refreshToken: 'refresh-token-123',
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database with chainable methods
    mockDb = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

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
      create: vi.fn(),
      updatePassword: vi.fn(),
      count: vi.fn(),
    };

    mockTotpService = {
      verifyCode: vi.fn().mockResolvedValue(true),
    };

    // Construct directly to avoid NestJS DI issues in unit tests
    service = new (AuthService as any)(
      mockDb,
      mockJwtService,
      mockConfigService,
      mockUsersService,
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
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN_HEX,
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
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN_HEX,
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

      expect(mockDb.insert).not.toHaveBeenCalled();
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

      expect(mockDb.insert).not.toHaveBeenCalled();
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
        refreshToken: MOCK_REFRESH_TOKEN_HEX,
        expiresIn: 900,
      });
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.limit.mockResolvedValue([mockSession]);

      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.refreshTokens(refreshToken);

      // Assert
      expect(mockDb.delete).toHaveBeenCalled(); // Old session deleted
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockSession.userId);
      expect(mockDb.insert).toHaveBeenCalled(); // New session created
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN_HEX,
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act & Assert
      await expect(service.refreshTokens('invalid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('invalid-refresh-token')).rejects.toThrow(
        'Invalid refresh token',
      );

      expect(mockUsersService.findById).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      // Arrange
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      };
      mockDb.limit.mockResolvedValue([expiredSession]);

      // Act & Assert
      await expect(service.refreshTokens('expired-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('expired-refresh-token')).rejects.toThrow(
        'Refresh token expired',
      );

      // Should delete the expired session
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockUsersService.findById).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user no longer exists', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockSession]);
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshTokens('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('valid-refresh-token')).rejects.toThrow('User not found');

      expect(mockDb.delete).toHaveBeenCalled(); // Old session should be deleted
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should successfully change password and return new tokens', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'old-password';
      const newPassword = 'new-password';
      const newPasswordHash = 'new-hashed-password';

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.hash).mockResolvedValue(newPasswordHash);

      // Act
      const result = await service.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(mockUsersService.findById).toHaveBeenCalledWith(userId);
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(argon2.verify).toHaveBeenCalledWith(mockUser.passwordHash, currentPassword);
      expect(argon2.hash).toHaveBeenCalledWith(newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(userId, newPasswordHash);
      expect(mockDb.delete).toHaveBeenCalled(); // All sessions invalidated
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN_HEX,
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      // Arrange
      const userId = 'user-123';
      const currentPassword = 'wrong-password';
      const newPassword = 'new-password';

      mockUsersService.findById.mockResolvedValue(mockUser);
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      // Act & Assert
      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.changePassword(userId, currentPassword, newPassword)).rejects.toThrow(
        'Current password is incorrect',
      );

      expect(argon2.hash).not.toHaveBeenCalled();
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.changePassword(userId, 'old-password', 'new-password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.changePassword(userId, 'old-password', 'new-password')).rejects.toThrow(
        'User not found',
      );

      expect(argon2.verify).not.toHaveBeenCalled();
      expect(mockUsersService.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should delete the session with the given refresh token', async () => {
      // Arrange
      const refreshToken = 'refresh-token-123';

      // Act
      await service.logout(refreshToken);

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should delete all sessions for the given user', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      await service.logoutAll(userId);

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions for a user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSessions = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: '2024-01-01T00:00:00.000Z',
          expiresAt: '2024-01-08T00:00:00.000Z',
        },
        {
          id: 'session-2',
          userAgent: 'Firefox',
          ipAddress: '192.168.1.1',
          createdAt: '2024-01-02T00:00:00.000Z',
          expiresAt: '2024-01-09T00:00:00.000Z',
        },
      ];

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockResolvedValue(mockSessions);

      // Act
      const result = await service.getActiveSessions(userId);

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
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
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: MOCK_REFRESH_TOKEN_HEX,
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createTokensForUser(userId)).rejects.toThrow(UnauthorizedException);
      await expect(service.createTokensForUser(userId)).rejects.toThrow('User not found');

      expect(mockDb.insert).not.toHaveBeenCalled();
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

  describe('private createTokens method (via public methods)', () => {
    it('should create JWT with correct payload and expiry', async () => {
      // Arrange
      const userId = 'user-123';
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      await service.createTokensForUser(userId);

      // Assert
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: userId, email: mockUser.email },
        { expiresIn: '15m' },
      );
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_ACCESS_EXPIRY', '15m');
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_REFRESH_EXPIRY', '7d');
    });

    it('should insert session with correct expiry date', async () => {
      // Arrange
      const userId = 'user-123';
      mockUsersService.findById.mockResolvedValue(mockUser);

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Act
      await service.createTokensForUser(userId);

      // Assert
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          refreshToken: MOCK_REFRESH_TOKEN_HASH,
          expiresAt: expect.any(String),
        }),
      );
    });
  });

  describe('parseDuration (indirectly tested)', () => {
    it('should parse duration strings correctly', async () => {
      // Arrange
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRY') return '30m';
        if (key === 'JWT_REFRESH_EXPIRY') return '14d';
        return undefined;
      });

      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.createTokensForUser('user-123');

      // Assert - 30m = 30 * 60 = 1800 seconds
      expect(result.expiresIn).toBe(1800);
      expect(mockJwtService.sign).toHaveBeenCalledWith(expect.any(Object), {
        expiresIn: '30m',
      });
    });
  });
});
