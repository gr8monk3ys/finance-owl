import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
} from 'crypto';

/**
 * Versioned AES-256-GCM encryption service for sensitive financial data
 * (Plaid tokens, account numbers, SSNs, etc.).
 *
 * Wire format (binary, then base64-encoded):
 *   [version:1][salt:16][iv:12][authTag:16][ciphertext:N]
 *
 * - version   : single byte identifying the key-derivation parameters,
 *               allowing transparent key rotation in the future.
 * - salt      : random per-encryption; fed to PBKDF2 together with the
 *               master secret so every ciphertext uses a unique derived key.
 * - iv        : 96-bit nonce for AES-GCM (NIST recommended length).
 * - authTag   : 128-bit GCM authentication tag.
 * - ciphertext: the encrypted payload.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);

  /** Master secret loaded from env. Never used directly as a key. */
  private masterSecret!: Buffer;

  // ---------- constants ----------
  private static readonly CURRENT_VERSION = 0x01;
  private static readonly VERSION_LENGTH = 1;
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;
  private static readonly AUTH_TAG_LENGTH = 16;
  private static readonly KEY_LENGTH = 32; // 256-bit

  // PBKDF2 parameters per version
  private static readonly PBKDF2_ITERATIONS: Record<number, number> = {
    0x01: 100_000,
  };
  private static readonly PBKDF2_DIGEST = 'sha512';

  // Minimum header length: version + salt + iv + authTag (ciphertext may be 0 bytes for empty plaintext)
  private static readonly MIN_BUFFER_LENGTH =
    EncryptionService.VERSION_LENGTH +
    EncryptionService.SALT_LENGTH +
    EncryptionService.IV_LENGTH +
    EncryptionService.AUTH_TAG_LENGTH;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const secret = this.configService.get<string>('ENCRYPTION_MASTER_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error(
        'ENCRYPTION_MASTER_SECRET is required and must be at least 32 characters. ' +
          'Generate with: openssl rand -base64 48',
      );
    }
    this.masterSecret = Buffer.from(secret, 'utf8');
    this.logger.log(
      'Encryption master secret loaded (AES-256-GCM + PBKDF2-SHA512)',
    );
  }

  /**
   * Encrypt a plaintext string. Returns a base64-encoded ciphertext
   * that includes all metadata required for decryption.
   */
  encrypt(plaintext: string): string {
    if (typeof plaintext !== 'string') {
      throw new Error('encrypt() expects a string input');
    }

    const version = EncryptionService.CURRENT_VERSION;
    const salt = randomBytes(EncryptionService.SALT_LENGTH);
    const iv = randomBytes(EncryptionService.IV_LENGTH);
    const derivedKey = this.deriveKey(salt, version);

    const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Wire format: version(1) + salt(16) + iv(12) + authTag(16) + ciphertext
    const combined = Buffer.concat([
      Buffer.from([version]),
      salt,
      iv,
      authTag,
      encrypted,
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypt a ciphertext produced by encrypt().
   * Automatically reads the version byte to select the correct key-derivation
   * parameters, enabling transparent key rotation.
   */
  decrypt(ciphertext: string): string {
    if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
      throw new Error('decrypt() expects a non-empty string input');
    }

    const combined = Buffer.from(ciphertext, 'base64');

    if (combined.length < EncryptionService.MIN_BUFFER_LENGTH) {
      throw new Error(
        'Invalid ciphertext: buffer too short (possibly corrupted or tampered data)',
      );
    }

    let offset = 0;

    // 1. Version
    const version = combined[offset];
    offset += EncryptionService.VERSION_LENGTH;

    const iterations = EncryptionService.PBKDF2_ITERATIONS[version];
    if (iterations === undefined) {
      throw new Error(
        `Unsupported encryption version: 0x${version.toString(16).padStart(2, '0')}. ` +
          'This ciphertext may have been produced by a newer application version.',
      );
    }

    // 2. Salt
    const salt = combined.subarray(offset, offset + EncryptionService.SALT_LENGTH);
    offset += EncryptionService.SALT_LENGTH;

    // 3. IV
    const iv = combined.subarray(offset, offset + EncryptionService.IV_LENGTH);
    offset += EncryptionService.IV_LENGTH;

    // 4. Auth tag
    const authTag = combined.subarray(
      offset,
      offset + EncryptionService.AUTH_TAG_LENGTH,
    );
    offset += EncryptionService.AUTH_TAG_LENGTH;

    // 5. Encrypted payload
    const encrypted = combined.subarray(offset);

    const derivedKey = this.deriveKey(salt, version);
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      throw new Error(
        'Decryption failed: authentication tag mismatch (data may have been tampered with)',
      );
    }
  }

  // ---------- internal ----------

  private deriveKey(salt: Buffer, version: number): Buffer {
    const iterations = EncryptionService.PBKDF2_ITERATIONS[version];
    return pbkdf2Sync(
      this.masterSecret,
      salt,
      iterations,
      EncryptionService.KEY_LENGTH,
      EncryptionService.PBKDF2_DIGEST,
    );
  }
}
