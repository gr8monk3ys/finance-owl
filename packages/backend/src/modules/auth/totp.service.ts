import { Injectable, BadRequestException } from '@nestjs/common';
import { TOTP, generateSecret as genSecret, generateURI, verifySync } from 'otplib';
import { UsersService } from '../users/users.service';
import { CryptoService } from '../../common/crypto/crypto.service';

@Injectable()
export class TotpService {
  private totp = new TOTP();

  constructor(
    private usersService: UsersService,
    private cryptoService: CryptoService,
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

    // Return the plaintext secret and URI for the client to display QR code
    // The secret will be encrypted before storage when enableTotp is called
    return { secret, otpauth };
  }

  async enableTotp(userId: string, secret: string, code: string) {
    // Validate the TOTP code against the plaintext secret before storing
    const { valid: isValid } = verifySync({ token: code, secret });
    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Encrypt the TOTP secret before storing at rest
    const encryptedSecret = this.cryptoService.encrypt(secret);
    await this.usersService.setTotpSecret(userId, encryptedSecret);
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
