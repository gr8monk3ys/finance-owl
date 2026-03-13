import { Injectable, BadRequestException } from '@nestjs/common';
import { TOTP, generateSecret as genSecret, generateURI, verifySync } from 'otplib';
import { UsersService } from '../users/users.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { CacheService } from '../../common/cache/cache.service';

/** TTL for a pending TOTP setup secret (seconds). */
const TOTP_SETUP_TTL = 300; // 5 minutes

@Injectable()
export class TotpService {
  private totp = new TOTP();

  constructor(
    private usersService: UsersService,
    private cryptoService: CryptoService,
    private cacheService: CacheService,
  ) {}

  async generateSecret(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const secret = genSecret();
    const otpauth = generateURI({
      issuer: 'FinanceOwl',
      label: user.email,
      secret,
    });

    // Store the plaintext secret in cache so the client never has to send it back
    await this.cacheService.set(`totp_setup:${userId}`, secret, TOTP_SETUP_TTL);

    // Return the secret and URI for the client to display QR code
    return { secret, otpauth };
  }

  async enableTotp(userId: string, code: string) {
    // Retrieve the secret that was stored during setup
    const cacheKey = `totp_setup:${userId}`;
    const secret = await this.cacheService.get<string>(cacheKey);
    if (!secret) {
      throw new BadRequestException('TOTP setup expired, please restart setup');
    }

    // Validate the TOTP code against the plaintext secret before storing
    const { valid: isValid } = verifySync({ token: code, secret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Encrypt the TOTP secret before storing at rest
    const encryptedSecret = this.cryptoService.encrypt(secret);
    await this.usersService.setTotpSecret(userId, encryptedSecret);

    // Clean up the temporary cache entry
    await this.cacheService.del(cacheKey);

    return { enabled: true };
  }

  async disableTotp(userId: string, code: string) {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findById(userId))!.email,
    );
    if (!user?.totpSecret) {
      throw new BadRequestException('TOTP is not enabled');
    }

    // Decrypt the stored secret for verification
    const decryptedSecret = this.cryptoService.decrypt(user.totpSecret);
    const { valid: isValid } = verifySync({ token: code, secret: decryptedSecret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    await this.usersService.setTotpSecret(userId, null);
    return { enabled: false };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findById(userId))!.email,
    );
    if (!user?.totpSecret) return true; // TOTP not enabled, pass through

    // Decrypt the stored secret for verification
    const decryptedSecret = this.cryptoService.decrypt(user.totpSecret);
    const result = verifySync({ token: code, secret: decryptedSecret });
    return result.valid;
  }
}
