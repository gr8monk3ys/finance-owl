import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import ms, { type StringValue } from 'ms';
import { UsersService } from '../users/users.service';
import { SessionService } from './session.service';
import { TotpService } from './totp.service';
import type { JwtPayload } from './strategies/jwt.strategy';

const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private totpService: TotpService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    const user = await this.usersService.create({ name, email, passwordHash });

    return this.createTokens(user.id, user.email);
  }

  async login(email: string, password: string, totpCode?: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Perform a dummy hash to prevent timing attacks that reveal whether the email exists
      await argon2.hash('dummy-password-timing-defense');
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify TOTP if enabled
    if (user.totpEnabled) {
      if (!totpCode) {
        throw new BadRequestException({
          message: 'TOTP code required',
          code: 'TOTP_REQUIRED',
        });
      }
      const totpValid = await this.totpService.verifyCode(user.id, totpCode);
      if (!totpValid) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    return this.createTokens(user.id, user.email);
  }

  async refreshTokens(refreshToken: string) {
    // Rotation: the presented token is consumed here, before anything else can fail.
    const userId = await this.sessionService.rotate(refreshToken);

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.createTokens(user.id, user.email);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findCredentialsById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    await this.usersService.updatePassword(userId, passwordHash);

    // A changed password invalidates every session issued under the old one.
    await this.sessionService.revokeAll(userId);

    return this.createTokens(userId, user.email);
  }

  async logout(refreshToken: string) {
    await this.sessionService.revoke(refreshToken);
  }

  async logoutAll(userId: string) {
    await this.sessionService.revokeAll(userId);
  }

  async getActiveSessions(userId: string) {
    return this.sessionService.list(userId);
  }

  async createTokensForUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.createTokens(user.id, user.email);
  }

  async isFirstRun() {
    const count = await this.usersService.count();
    return count === 0;
  }

  private async createTokens(userId: string, email: string) {
    const payload: JwtPayload = { sub: userId, email };

    const accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRY', DEFAULT_ACCESS_EXPIRY);
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiry as StringValue,
    });

    const refreshExpiry = this.configService.get<string>(
      'JWT_REFRESH_EXPIRY',
      DEFAULT_REFRESH_EXPIRY,
    );
    const refreshToken = await this.sessionService.issue(
      userId,
      this.durationMs('JWT_REFRESH_EXPIRY', refreshExpiry),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.durationMs('JWT_ACCESS_EXPIRY', accessExpiry) / 1000,
    };
  }

  /**
   * Parse an expiry with `ms` — the same parser `@nestjs/jwt` applies to these
   * exact config values. The hand-rolled parser this replaces accepted only
   * `30s`/`15m`/`2h`/`7d` and silently fell back to 15 minutes for anything
   * else, so `JWT_REFRESH_EXPIRY=1w` minted a JWT whose session row expired a
   * week early. `env.validation.ts` rejects unparseable values at boot; this
   * throws rather than guessing if one reaches us anyway.
   */
  private durationMs(key: string, value: string): number {
    const parsed = ms(value as StringValue);
    if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) {
      this.logger.error(`${key} is not a valid duration: "${value}"`);
      throw new Error(
        `${key} must be a positive duration understood by ms (e.g. 30s, 15m, 2h, 7d, 1w), got "${value}"`,
      );
    }
    return parsed;
  }
}
