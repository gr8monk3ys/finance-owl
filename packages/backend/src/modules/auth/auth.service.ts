import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';
import { UsersService } from '../users/users.service';
import { TotpService } from './totp.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private totpService: TotpService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
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
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.refreshToken, this.hashRefreshToken(refreshToken)))
      .limit(1);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date(session.expiresAt) < new Date()) {
      await this.db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));
      throw new UnauthorizedException('Refresh token expired');
    }

    // Delete old session (rotate refresh token)
    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));

    const user = await this.usersService.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.createTokens(user.id, user.email);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const found = await this.usersService.findById(userId);
    if (!found) {
      throw new UnauthorizedException('User not found');
    }

    const user = await this.usersService.findByEmail(found.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    await this.usersService.updatePassword(userId, passwordHash);

    // Invalidate all sessions
    await this.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    return this.createTokens(userId, user.email);
  }

  async logout(refreshToken: string) {
    await this.db
      .delete(schema.sessions)
      .where(eq(schema.sessions.refreshToken, this.hashRefreshToken(refreshToken)));
  }

  async logoutAll(userId: string) {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }

  async getActiveSessions(userId: string) {
    return this.db
      .select({
        id: schema.sessions.id,
        userAgent: schema.sessions.userAgent,
        ipAddress: schema.sessions.ipAddress,
        createdAt: schema.sessions.createdAt,
        expiresAt: schema.sessions.expiresAt,
      })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId));
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

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
    });

    // Use cryptographically secure random bytes for refresh token (not UUID)
    const refreshToken = randomBytes(32).toString('hex');
    const refreshExpiry = this.configService.get('JWT_REFRESH_EXPIRY', '7d');
    const expiresAt = new Date(Date.now() + this.parseDuration(refreshExpiry)).toISOString();

    // Only a SHA-256 digest of the refresh token is persisted, so a leaked
    // database dump cannot be replayed against /auth/refresh.
    await this.db.insert(schema.sessions).values({
      userId,
      refreshToken: this.hashRefreshToken(refreshToken),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDuration(this.configService.get('JWT_ACCESS_EXPIRY', '15m')) / 1000,
    };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const [, value, unit] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return parseInt(value) * (multipliers[unit] || 60 * 1000);
  }
}
