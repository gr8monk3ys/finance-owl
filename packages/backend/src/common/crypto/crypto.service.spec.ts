import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let cryptoService: CryptoService;
  let configService: ConfigService;

  const VALID_KEY = '0'.repeat(64); // Valid 64-char hex key

  beforeEach(() => {
    configService = {
      get: vi.fn(),
    } as any;
    cryptoService = new CryptoService(configService);
  });

  describe('onModuleInit', () => {
    it('should throw when ENCRYPTION_KEY is missing', () => {
      vi.mocked(configService.get).mockReturnValue(undefined);

      expect(() => cryptoService.onModuleInit()).toThrow(
        'ENCRYPTION_KEY is required and must be a 64-character hex string (256-bit key). Generate with: openssl rand -hex 32',
      );
    });

    it('should throw when ENCRYPTION_KEY is too short', () => {
      vi.mocked(configService.get).mockReturnValue('short');

      expect(() => cryptoService.onModuleInit()).toThrow(
        'ENCRYPTION_KEY is required and must be a 64-character hex string (256-bit key). Generate with: openssl rand -hex 32',
      );
    });

    it('should succeed with valid 64-char hex key', () => {
      vi.mocked(configService.get).mockReturnValue(VALID_KEY);

      expect(() => cryptoService.onModuleInit()).not.toThrow();
    });
  });

  describe('encrypt/decrypt', () => {
    beforeEach(() => {
      vi.mocked(configService.get).mockReturnValue(VALID_KEY);
      cryptoService.onModuleInit();
    });

    it('should successfully roundtrip a string', () => {
      const plaintext = 'Hello, World!';

      const encrypted = cryptoService.encrypt(plaintext);
      const decrypted = cryptoService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same input (random IV)', () => {
      const plaintext = 'same input';

      const encrypted1 = cryptoService.encrypt(plaintext);
      const encrypted2 = cryptoService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      // Both should still decrypt to the same value
      expect(cryptoService.decrypt(encrypted1)).toBe(plaintext);
      expect(cryptoService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should throw on tampered ciphertext', () => {
      const plaintext = 'sensitive data';
      const encrypted = cryptoService.encrypt(plaintext);

      // Tamper with the ciphertext by changing a character
      const tampered = encrypted.slice(0, -1) + 'X';

      expect(() => cryptoService.decrypt(tampered)).toThrow();
    });
  });
});
