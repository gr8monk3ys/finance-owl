import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private key!: Buffer;

  // AES-256-GCM constants
  private static readonly IV_LENGTH = 12; // 96-bit IV recommended for GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128-bit auth tag
  private static readonly KEY_LENGTH = 32; // 256-bit key

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    if (!keyHex || keyHex.length < 64) {
      throw new Error(
        'ENCRYPTION_KEY is required and must be a 64-character hex string (256-bit key). ' +
          'Generate with: openssl rand -hex 32',
      );
    }

    // Validate the hex string contains only valid hex characters
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters [0-9a-fA-F].');
    }

    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== CryptoService.KEY_LENGTH) {
      throw new Error(`ENCRYPTION_KEY must decode to exactly ${CryptoService.KEY_LENGTH} bytes.`);
    }

    this.logger.log('Encryption key loaded and validated (AES-256-GCM)');
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Output format: base64(iv[12] + authTag[16] + ciphertext[...])
   */
  encrypt(plaintext: string): string {
    if (typeof plaintext !== 'string') {
      throw new Error('encrypt() expects a string input');
    }

    const iv = randomBytes(CryptoService.IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: base64(iv + authTag + encrypted)
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypt ciphertext produced by encrypt().
   * Validates the minimum expected buffer length before parsing.
   */
  decrypt(ciphertext: string): string {
    if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
      throw new Error('decrypt() expects a non-empty string input');
    }

    const combined = Buffer.from(ciphertext, 'base64');

    const minLength = CryptoService.IV_LENGTH + CryptoService.AUTH_TAG_LENGTH + 1;
    if (combined.length < minLength) {
      throw new Error('Invalid ciphertext: buffer too short (possibly corrupted or tampered data)');
    }

    const iv = combined.subarray(0, CryptoService.IV_LENGTH);
    const authTag = combined.subarray(
      CryptoService.IV_LENGTH,
      CryptoService.IV_LENGTH + CryptoService.AUTH_TAG_LENGTH,
    );
    const encrypted = combined.subarray(CryptoService.IV_LENGTH + CryptoService.AUTH_TAG_LENGTH);

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      throw new Error('Decryption failed: data integrity check failed');
    }
  }

  /**
   * Constant-time comparison to prevent timing attacks when comparing tokens.
   */
  safeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
