import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  const VALID_SECRET = 'a-strong-master-secret-for-testing-purposes-only!';

  function createService(secret: string | undefined): EncryptionService {
    configService = { get: vi.fn().mockReturnValue(secret) } as any;
    return new EncryptionService(configService);
  }

  beforeEach(() => {
    service = createService(VALID_SECRET);
    service.onModuleInit();
  });

  // ---------- initialisation ----------

  describe('onModuleInit', () => {
    it('should throw when ENCRYPTION_MASTER_SECRET is missing', () => {
      const s = createService(undefined);
      expect(() => s.onModuleInit()).toThrow('ENCRYPTION_MASTER_SECRET is required');
    });

    it('should throw when ENCRYPTION_MASTER_SECRET is too short', () => {
      const s = createService('short');
      expect(() => s.onModuleInit()).toThrow('at least 32 characters');
    });

    it('should initialise successfully with a valid secret', () => {
      const s = createService(VALID_SECRET);
      expect(() => s.onModuleInit()).not.toThrow();
    });
  });

  // ---------- encrypt ----------

  describe('encrypt', () => {
    it('should return a non-empty base64 string', async () => {
      const result = await service.encrypt('hello');
      expect(result).toBeTruthy();
      // Verify it is valid base64
      expect(() => Buffer.from(result, 'base64')).not.toThrow();
    });

    it('should produce different ciphertexts for the same plaintext (random salt+IV)', async () => {
      const a = await service.encrypt('same');
      const b = await service.encrypt('same');
      expect(a).not.toBe(b);
    });

    it('should throw when given a non-string input', async () => {
      await expect((service as any).encrypt(123)).rejects.toThrow('expects a string');
    });

    it('should handle empty-string plaintext', async () => {
      const encrypted = await service.encrypt('');
      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toBe('');
    });
  });

  // ---------- decrypt ----------

  describe('decrypt', () => {
    it('should roundtrip arbitrary UTF-8 strings', async () => {
      const inputs = [
        'Hello, World!',
        'access-sandbox-abc123-plaid-token',
        '1234-5678-9012-3456',
        '{"key":"value","nested":{"a":1}}',
        'Unicode: \u00e9\u00e8\u00ea \u00fc\u00f6\u00e4 \ud83e\udd89',
      ];
      for (const plaintext of inputs) {
        const encrypted = await service.encrypt(plaintext);
        expect(await service.decrypt(encrypted)).toBe(plaintext);
      }
    });

    it('should throw on empty input', async () => {
      await expect(service.decrypt('')).rejects.toThrow('expects a non-empty string');
    });

    it('should throw on truncated ciphertext', async () => {
      const encrypted = await service.encrypt('test');
      const truncated = encrypted.slice(0, 10);
      await expect(service.decrypt(truncated)).rejects.toThrow('buffer too short');
    });

    it('should throw when the auth tag has been tampered with', async () => {
      const encrypted = await service.encrypt('sensitive');
      const buf = Buffer.from(encrypted, 'base64');

      // Flip a bit in the auth tag region (offset: 1 + 16 + 12 = 29)
      const authTagStart = 1 + 16 + 12;
      buf[authTagStart] ^= 0xff;

      const tampered = buf.toString('base64');
      await expect(service.decrypt(tampered)).rejects.toThrow('tampered');
    });

    it('should throw when the ciphertext body has been tampered with', async () => {
      const encrypted = await service.encrypt('some data');
      const buf = Buffer.from(encrypted, 'base64');

      // Tamper with the last byte (ciphertext payload)
      buf[buf.length - 1] ^= 0xff;

      const tampered = buf.toString('base64');
      await expect(service.decrypt(tampered)).rejects.toThrow('tampered');
    });

    it('should throw on unsupported version byte', async () => {
      const encrypted = await service.encrypt('test');
      const buf = Buffer.from(encrypted, 'base64');
      buf[0] = 0xff; // invalid version
      const modified = buf.toString('base64');
      await expect(service.decrypt(modified)).rejects.toThrow('Unsupported encryption version');
    });
  });

  // ---------- version byte / key rotation ----------

  describe('version byte', () => {
    it('should embed version 0x01 as the first byte', async () => {
      const encrypted = await service.encrypt('test');
      const buf = Buffer.from(encrypted, 'base64');
      expect(buf[0]).toBe(0x01);
    });

    it('should include salt, IV, auth tag, and ciphertext in the wire format', async () => {
      const encrypted = await service.encrypt('x');
      const buf = Buffer.from(encrypted, 'base64');
      // Minimum: 1 (version) + 16 (salt) + 12 (iv) + 16 (tag) + 1 (ciphertext) = 46
      expect(buf.length).toBeGreaterThanOrEqual(46);
    });
  });

  // ---------- cross-instance ----------

  describe('cross-instance decryption', () => {
    it('should decrypt ciphertext from another service instance with same secret', async () => {
      const other = createService(VALID_SECRET);
      other.onModuleInit();

      const encrypted = await service.encrypt('cross-instance-test');
      expect(await other.decrypt(encrypted)).toBe('cross-instance-test');
    });

    it('should NOT decrypt ciphertext from a service with a different secret', async () => {
      const other = createService('a-completely-different-secret-value-here!');
      other.onModuleInit();

      const encrypted = await service.encrypt('wrong key test');
      await expect(other.decrypt(encrypted)).rejects.toThrow();
    });
  });

  // ---------- large payloads ----------

  describe('large payloads', () => {
    it('should handle a 10 KB plaintext', async () => {
      const large = 'A'.repeat(10_240);
      const encrypted = await service.encrypt(large);
      expect(await service.decrypt(encrypted)).toBe(large);
    });
  });
});
