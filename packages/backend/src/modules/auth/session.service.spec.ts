import { createHash } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';

// Mock crypto.randomBytes to return predictable values
const MOCK_REFRESH_TOKEN_HEX = 'a'.repeat(64); // 32 bytes as hex = 64 chars
// Only the SHA-256 digest of the refresh token is ever persisted
const MOCK_REFRESH_TOKEN_HASH = createHash('sha256').update(MOCK_REFRESH_TOKEN_HEX).digest('hex');
const mockRandomBytes = vi.fn().mockReturnValue(Buffer.from(MOCK_REFRESH_TOKEN_HEX, 'hex'));
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomBytes: (...args: any[]) => mockRandomBytes(...args),
  };
});

describe('SessionService', () => {
  let service: SessionService;
  let mockDb: any;

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    refreshToken: MOCK_REFRESH_TOKEN_HASH,
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Chainable drizzle query-builder double
    mockDb = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
    };

    service = new (SessionService as any)(mockDb);
  });

  describe('issue', () => {
    it('should persist only the digest and return the plaintext token', async () => {
      // Arrange
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const ttlMs = 7 * 24 * 60 * 60 * 1000;

      // Act
      const token = await service.issue('user-123', ttlMs);

      // Assert
      expect(token).toBe(MOCK_REFRESH_TOKEN_HEX);
      expect(mockRandomBytes).toHaveBeenCalledWith(32);
      expect(mockDb.values).toHaveBeenCalledWith({
        userId: 'user-123',
        refreshToken: MOCK_REFRESH_TOKEN_HASH,
        expiresAt: new Date(now + ttlMs).toISOString(),
      });
      // The plaintext token must never reach the database
      const persisted = mockDb.values.mock.calls[0][0];
      expect(persisted.refreshToken).not.toBe(MOCK_REFRESH_TOKEN_HEX);
    });

    it('should honour the ttl it is given', async () => {
      // Arrange
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Act
      await service.issue('user-123', 60_000);

      // Assert
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: new Date(now + 60_000).toISOString() }),
      );
    });
  });

  describe('rotate', () => {
    it('should delete the session and return its user', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([mockSession]);

      // Act
      const userId = await service.rotate(MOCK_REFRESH_TOKEN_HEX);

      // Assert
      expect(userId).toBe('user-123');
      expect(mockDb.delete).toHaveBeenCalled(); // consumed, so it cannot be replayed
    });

    it('should throw UnauthorizedException for an unknown token', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act & Assert
      await expect(service.rotate('nope')).rejects.toThrow(UnauthorizedException);
      await expect(service.rotate('nope')).rejects.toThrow('Invalid refresh token');
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should delete and reject an expired session', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([
        { ...mockSession, expiresAt: new Date(Date.now() - 1000).toISOString() },
      ]);

      // Act & Assert
      await expect(service.rotate(MOCK_REFRESH_TOKEN_HEX)).rejects.toThrow('Refresh token expired');
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('should delete the session matching the token digest', async () => {
      // Act
      await service.revoke(MOCK_REFRESH_TOKEN_HEX);

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('revokeAll', () => {
    it('should delete every session for the user', async () => {
      // Act
      await service.revokeAll('user-123');

      // Assert
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should return sessions without the token digest', async () => {
      // Arrange
      const rows = [
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: '2024-01-01T00:00:00.000Z',
          expiresAt: '2024-01-08T00:00:00.000Z',
        },
      ];
      mockDb.where.mockResolvedValue(rows);

      // Act
      const result = await service.list('user-123');

      // Assert
      expect(result).toEqual(rows);
      const projection = mockDb.select.mock.calls[0][0];
      expect(Object.keys(projection)).not.toContain('refreshToken');
    });
  });
});
