import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: any;

  const fullRow = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    totpEnabled: true,
    totpSecret: 'encrypted-secret',
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Chainable drizzle query-builder double
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    service = new (UsersService as any)(mockDb);
  });

  describe('findById', () => {
    it('should project away credentials', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([{ id: fullRow.id, email: fullRow.email }]);

      // Act
      await service.findById('user-123');

      // Assert — the profile projection must not select secrets
      const projection = mockDb.select.mock.calls[0][0];
      expect(Object.keys(projection)).not.toContain('passwordHash');
      expect(Object.keys(projection)).not.toContain('totpSecret');
    });

    it('should return null when the row is gone', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act & Assert
      await expect(service.findById('missing')).resolves.toBeNull();
    });
  });

  describe('findCredentialsById', () => {
    it('should select the whole row, credentials included', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([fullRow]);

      // Act
      const user = await service.findCredentialsById('user-123');

      // Assert — one query, no projection, so callers need no second lookup
      expect(mockDb.select).toHaveBeenCalledWith();
      expect(user).toEqual(fullRow);
    });

    it('should return null when the row is gone', async () => {
      // Arrange
      mockDb.limit.mockResolvedValue([]);

      // Act & Assert
      await expect(service.findCredentialsById('missing')).resolves.toBeNull();
    });
  });

  describe('count', () => {
    it('should ask the database for a COUNT, not fetch every row', async () => {
      // Arrange
      mockDb.from.mockResolvedValue([{ value: 42 }]);

      // Act
      const result = await service.count();

      // Assert
      expect(result).toBe(42);
      const projection = mockDb.select.mock.calls[0][0];
      expect(Object.keys(projection)).toEqual(['value']);
      // A SQL count aggregate, not a column reference the driver would
      // materialise a row per user for
      expect(JSON.stringify(projection.value.queryChunks)).toContain('count');
    });

    it('should return 0 when the table is empty', async () => {
      // Arrange
      mockDb.from.mockResolvedValue([{ value: 0 }]);

      // Act & Assert
      await expect(service.count()).resolves.toBe(0);
    });

    it('should return 0 when the driver returns no rows', async () => {
      // Arrange
      mockDb.from.mockResolvedValue([]);

      // Act & Assert
      await expect(service.count()).resolves.toBe(0);
    });
  });
});
