import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TotpService } from './totp.service';

// Mock otplib
const mockGenerateSecret = vi.fn().mockReturnValue('MOCK_SECRET_BASE32');
const mockGenerateURI = vi.fn().mockReturnValue('otpauth://totp/FinanceOwl:test@example.com?secret=MOCK_SECRET_BASE32&issuer=FinanceOwl');
const mockVerifySync = vi.fn();

vi.mock('otplib', () => ({
  TOTP: vi.fn().mockImplementation(() => ({})),
  generateSecret: (...args: any[]) => mockGenerateSecret(...args),
  generateURI: (...args: any[]) => mockGenerateURI(...args),
  verifySync: (...args: any[]) => mockVerifySync(...args),
}));

describe('TotpService', () => {
  let service: TotpService;
  let mockUsersService: any;
  let mockCryptoService: any;
  let mockCacheService: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    totpEnabled: false,
    totpSecret: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockUsersService = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      setTotpSecret: vi.fn(),
    };

    mockCryptoService = {
      encrypt: vi.fn().mockReturnValue('encrypted-secret'),
      decrypt: vi.fn().mockReturnValue('MOCK_SECRET_BASE32'),
    };

    mockCacheService = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    };

    // Construct directly to avoid NestJS DI issues in unit tests
    service = new (TotpService as any)(
      mockUsersService,
      mockCryptoService,
      mockCacheService,
    );
  });

  describe('generateSecret', () => {
    it('should return secret, otpauth URL and store secret in cache with 5-min TTL', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.generateSecret('user-123');

      // Assert
      expect(mockUsersService.findById).toHaveBeenCalledWith('user-123');
      expect(mockGenerateSecret).toHaveBeenCalled();
      expect(mockGenerateURI).toHaveBeenCalledWith({
        issuer: 'FinanceOwl',
        label: mockUser.email,
        secret: 'MOCK_SECRET_BASE32',
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'totp_setup:user-123',
        'MOCK_SECRET_BASE32',
        300, // 5 minutes TTL
      );
      expect(result).toEqual({
        secret: 'MOCK_SECRET_BASE32',
        otpauth: 'otpauth://totp/FinanceOwl:test@example.com?secret=MOCK_SECRET_BASE32&issuer=FinanceOwl',
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.generateSecret('non-existent')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.generateSecret('non-existent')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('enableTotp', () => {
    it('should encrypt and store secret when code is valid', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue('MOCK_SECRET_BASE32');
      mockVerifySync.mockReturnValue({ valid: true });

      // Act
      const result = await service.enableTotp('user-123', '123456');

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('totp_setup:user-123');
      expect(mockVerifySync).toHaveBeenCalledWith({
        token: '123456',
        secret: 'MOCK_SECRET_BASE32',
      });
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith('MOCK_SECRET_BASE32');
      expect(mockUsersService.setTotpSecret).toHaveBeenCalledWith(
        'user-123',
        'encrypted-secret',
      );
      expect(mockCacheService.del).toHaveBeenCalledWith('totp_setup:user-123');
      expect(result).toEqual({ enabled: true });
    });

    it('should throw BadRequestException when code is invalid', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue('MOCK_SECRET_BASE32');
      mockVerifySync.mockReturnValue({ valid: false });

      // Act & Assert
      await expect(service.enableTotp('user-123', '000000')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enableTotp('user-123', '000000')).rejects.toThrow(
        'Invalid TOTP code',
      );

      // Should not encrypt or store anything
      expect(mockCryptoService.encrypt).not.toHaveBeenCalled();
      expect(mockUsersService.setTotpSecret).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when setup has expired (no cache entry)', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.enableTotp('user-123', '123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.enableTotp('user-123', '123456')).rejects.toThrow(
        'TOTP setup expired, please restart setup',
      );

      expect(mockVerifySync).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('should return true when code is valid', async () => {
      // Arrange
      const userWithTotp = {
        ...mockUser,
        totpEnabled: true,
        totpSecret: 'encrypted-secret',
      };
      mockUsersService.findById.mockResolvedValue(userWithTotp);
      mockUsersService.findByEmail.mockResolvedValue(userWithTotp);
      mockVerifySync.mockReturnValue({ valid: true });

      // Act
      const result = await service.verifyCode('user-123', '123456');

      // Assert
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith('encrypted-secret');
      expect(mockVerifySync).toHaveBeenCalledWith({
        token: '123456',
        secret: 'MOCK_SECRET_BASE32',
      });
      expect(result).toBe(true);
    });

    it('should return false when code is invalid', async () => {
      // Arrange
      const userWithTotp = {
        ...mockUser,
        totpEnabled: true,
        totpSecret: 'encrypted-secret',
      };
      mockUsersService.findById.mockResolvedValue(userWithTotp);
      mockUsersService.findByEmail.mockResolvedValue(userWithTotp);
      mockVerifySync.mockReturnValue({ valid: false });

      // Act
      const result = await service.verifyCode('user-123', '000000');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true (pass through) when TOTP is not enabled', async () => {
      // Arrange
      const userWithoutTotp = { ...mockUser, totpSecret: null };
      mockUsersService.findById.mockResolvedValue(userWithoutTotp);
      mockUsersService.findByEmail.mockResolvedValue(userWithoutTotp);

      // Act
      const result = await service.verifyCode('user-123', '123456');

      // Assert
      expect(result).toBe(true);
      expect(mockCryptoService.decrypt).not.toHaveBeenCalled();
      expect(mockVerifySync).not.toHaveBeenCalled();
    });
  });

  describe('disableTotp', () => {
    it('should clear totpSecret and disable TOTP with valid code', async () => {
      // Arrange
      const userWithTotp = {
        ...mockUser,
        totpEnabled: true,
        totpSecret: 'encrypted-secret',
      };
      mockUsersService.findById.mockResolvedValue(userWithTotp);
      mockUsersService.findByEmail.mockResolvedValue(userWithTotp);
      mockVerifySync.mockReturnValue({ valid: true });

      // Act
      const result = await service.disableTotp('user-123', '123456');

      // Assert
      expect(mockCryptoService.decrypt).toHaveBeenCalledWith('encrypted-secret');
      expect(mockVerifySync).toHaveBeenCalledWith({
        token: '123456',
        secret: 'MOCK_SECRET_BASE32',
      });
      expect(mockUsersService.setTotpSecret).toHaveBeenCalledWith('user-123', null);
      expect(result).toEqual({ enabled: false });
    });

    it('should throw BadRequestException with invalid code', async () => {
      // Arrange
      const userWithTotp = {
        ...mockUser,
        totpEnabled: true,
        totpSecret: 'encrypted-secret',
      };
      mockUsersService.findById.mockResolvedValue(userWithTotp);
      mockUsersService.findByEmail.mockResolvedValue(userWithTotp);
      mockVerifySync.mockReturnValue({ valid: false });

      // Act & Assert
      await expect(service.disableTotp('user-123', '000000')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.disableTotp('user-123', '000000')).rejects.toThrow(
        'Invalid TOTP code',
      );
      expect(mockUsersService.setTotpSecret).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when TOTP is not enabled', async () => {
      // Arrange
      const userWithoutTotp = { ...mockUser, totpSecret: null };
      mockUsersService.findById.mockResolvedValue(userWithoutTotp);
      mockUsersService.findByEmail.mockResolvedValue(userWithoutTotp);

      // Act & Assert
      await expect(service.disableTotp('user-123', '123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.disableTotp('user-123', '123456')).rejects.toThrow(
        'TOTP is not enabled',
      );
    });
  });
});
