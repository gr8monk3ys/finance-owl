import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { WebAuthnService } from './webauthn.service';

// Mock @simplewebauthn/server (ESM dynamic import)
const mockGenerateRegistrationOptions = vi.fn();
const mockVerifyRegistrationResponse = vi.fn();
const mockGenerateAuthenticationOptions = vi.fn();
const mockVerifyAuthenticationResponse = vi.fn();

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: (...args: any[]) => mockGenerateRegistrationOptions(...args),
  verifyRegistrationResponse: (...args: any[]) => mockVerifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: any[]) => mockGenerateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: any[]) => mockVerifyAuthenticationResponse(...args),
}));

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  let mockDb: any;
  let mockConfigService: any;
  let mockCacheService: any;

  const mockCredential = {
    id: 'cred-123',
    userId: 'user-123',
    publicKey: Buffer.from('mock-public-key').toString('base64'),
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    transports: JSON.stringify(['usb', 'ble']),
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
      set: vi.fn().mockReturnThis(),
    };

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          WEBAUTHN_RP_NAME: 'FinanceOwl',
          WEBAUTHN_RP_ID: 'localhost',
          WEBAUTHN_ORIGIN: 'http://localhost:3000',
        };
        return config[key] || defaultValue;
      }),
    };

    mockCacheService = {
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    };

    // Construct directly to avoid NestJS DI issues in unit tests
    service = new (WebAuthnService as any)(mockDb, mockConfigService, mockCacheService);
  });

  describe('generateRegistrationOptions', () => {
    it('should return options with correct rpName, rpID, user info and store challenge', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockCredential]);
      const mockOptions = {
        challenge: 'mock-challenge-base64',
        rp: { name: 'FinanceOwl', id: 'localhost' },
        user: { name: 'testuser' },
      };
      mockGenerateRegistrationOptions.mockResolvedValue(mockOptions);

      // Act
      const result = await service.generateRegistrationOptions('user-123', 'testuser');

      // Assert
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpName: 'FinanceOwl',
          rpID: 'localhost',
          userName: 'testuser',
          attestationType: 'none',
          excludeCredentials: expect.arrayContaining([
            expect.objectContaining({
              id: 'cred-123',
              transports: ['usb', 'ble'],
            }),
          ]),
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'required',
          },
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'webauthn:challenge:user-123',
        'mock-challenge-base64',
        300,
      );
      expect(result).toEqual(mockOptions);
    });

    it('should handle user with no existing credentials', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);
      const mockOptions = { challenge: 'mock-challenge' };
      mockGenerateRegistrationOptions.mockResolvedValue(mockOptions);

      // Act
      const result = await service.generateRegistrationOptions('user-456', 'newuser');

      // Assert
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: [],
        }),
      );
      expect(result).toEqual(mockOptions);
    });
  });

  describe('verifyRegistration', () => {
    const mockRegBody = {
      id: 'new-cred-id',
      response: {
        transports: ['usb'],
      },
    };

    it('should store credential and return verification on valid response', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue('expected-challenge');
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'new-cred-id',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      });

      // Act
      const result = await service.verifyRegistration('user-123', mockRegBody);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('webauthn:challenge:user-123');
      expect(mockCacheService.del).toHaveBeenCalledWith('webauthn:challenge:user-123');
      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response: mockRegBody,
          expectedChallenge: 'expected-challenge',
          expectedOrigin: 'http://localhost:3000',
          expectedRPID: 'localhost',
        }),
      );
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-cred-id',
          userId: 'user-123',
          counter: 0,
          deviceType: 'singleDevice',
          backedUp: false,
        }),
      );
      expect(result).toEqual({ verified: true });
    });

    it('should throw when challenge is missing or expired', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyRegistration('user-123', mockRegBody)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyRegistration('user-123', mockRegBody)).rejects.toThrow(
        'No challenge found. Please request a new challenge.',
      );
    });

    it('should throw when verification fails', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue('expected-challenge');
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: false,
        registrationInfo: null,
      });

      // Act & Assert
      await expect(service.verifyRegistration('user-123', mockRegBody)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyRegistration('user-123', mockRegBody)).rejects.toThrow(
        'WebAuthn verification failed',
      );
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should return options with user credentials and store challenge', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([mockCredential]);
      const mockOptions = { challenge: 'auth-challenge' };
      mockGenerateAuthenticationOptions.mockResolvedValue(mockOptions);

      // Act
      const result = await service.generateAuthenticationOptions('user-123');

      // Assert
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpID: 'localhost',
          userVerification: 'required',
          allowCredentials: expect.arrayContaining([
            expect.objectContaining({
              id: 'cred-123',
              transports: ['usb', 'ble'],
            }),
          ]),
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'webauthn:challenge:user-123',
        'auth-challenge',
        300,
      );
      expect(result).toEqual(mockOptions);
    });

    it('should handle anonymous authentication (no userId)', async () => {
      // Arrange
      const mockOptions = { challenge: 'anon-challenge' };
      mockGenerateAuthenticationOptions.mockResolvedValue(mockOptions);

      // Act
      const result = await service.generateAuthenticationOptions();

      // Assert
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpID: 'localhost',
          allowCredentials: undefined,
          userVerification: 'required',
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'webauthn:challenge:anonymous',
        'anon-challenge',
        300,
      );
      expect(result).toEqual(mockOptions);
    });
  });

  describe('verifyAuthentication', () => {
    const mockAuthBody = {
      id: 'cred-123',
      response: {},
    };

    it('should update counter and return verification on valid response', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockCredential]);
      mockCacheService.get.mockResolvedValue('expected-challenge');
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      // Act
      const result = await service.verifyAuthentication(mockAuthBody, 'user-123');

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('webauthn:challenge:user-123');
      expect(mockCacheService.del).toHaveBeenCalledWith('webauthn:challenge:user-123');
      expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response: mockAuthBody,
          expectedChallenge: 'expected-challenge',
          expectedOrigin: 'http://localhost:3000',
          expectedRPID: 'localhost',
          credential: expect.objectContaining({
            id: 'cred-123',
            counter: 0,
          }),
        }),
      );
      // Counter should be updated
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ counter: 1 });
      expect(result).toEqual({ verified: true, userId: 'user-123' });
    });

    it('should throw when challenge is invalid or missing', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockCredential]);
      mockCacheService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(service.verifyAuthentication(mockAuthBody, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyAuthentication(mockAuthBody, 'user-123')).rejects.toThrow(
        'No challenge found. Please request a new challenge.',
      );
    });

    it('should throw when credential is not found', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act & Assert
      await expect(service.verifyAuthentication(mockAuthBody, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyAuthentication(mockAuthBody, 'user-123')).rejects.toThrow(
        'Credential not found',
      );
    });

    it('should throw when authentication verification fails', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockCredential]);
      mockCacheService.get.mockResolvedValue('expected-challenge');
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: false,
        authenticationInfo: { newCounter: 0 },
      });

      // Act & Assert
      await expect(service.verifyAuthentication(mockAuthBody, 'user-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyAuthentication(mockAuthBody, 'user-123')).rejects.toThrow(
        'WebAuthn authentication failed',
      );
    });

    it('should use anonymous challenge key when no userId is provided', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockCredential]);
      mockCacheService.get.mockResolvedValue('anon-challenge');
      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      // Act
      const result = await service.verifyAuthentication(mockAuthBody);

      // Assert
      expect(mockCacheService.get).toHaveBeenCalledWith('webauthn:challenge:anonymous');
      expect(result).toEqual({ verified: true, userId: 'user-123' });
    });
  });

  describe('getCredentials', () => {
    it('should return user credentials', async () => {
      // Arrange
      const mockCreds = [
        {
          id: 'cred-123',
          deviceType: 'singleDevice',
          backedUp: false,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];
      mockDb.where.mockResolvedValue(mockCreds);

      // Act
      const result = await service.getCredentials('user-123');

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockCreds);
    });

    it('should return empty array when user has no credentials', async () => {
      // Arrange
      mockDb.where.mockResolvedValue([]);

      // Act
      const result = await service.getCredentials('user-456');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('removeCredential', () => {
    it('should remove credential by id and userId', async () => {
      // Arrange
      mockDb.where.mockResolvedValue(undefined);

      // Act
      await service.removeCredential('user-123', 'cred-123');

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});
