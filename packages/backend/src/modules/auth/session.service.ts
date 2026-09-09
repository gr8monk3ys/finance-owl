import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

/**
 * Owns the refresh-token invariant: the plaintext token exists only in the
 * response body, and only its SHA-256 digest is ever persisted, so a leaked
 * database dump cannot be replayed against /auth/refresh. Every read and write
 * of `sessions` on the auth path goes through here, which is also the only
 * place that knows how a token is hashed.
 */
@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  /**
   * Create a session for `userId` and return the plaintext refresh token.
   * The caller must hand it straight to the client — it is not recoverable
   * from the database afterwards.
   */
  async issue(userId: string, ttlMs: number): Promise<string> {
    // Cryptographically secure random bytes, not a UUID: refresh tokens are
    // bearer credentials and must not be guessable from a timestamp.
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    await this.db.insert(schema.sessions).values({
      userId,
      refreshToken: this.hash(refreshToken),
      expiresAt,
    });

    return refreshToken;
  }

  /**
   * Consume `refreshToken`, deleting the session it belongs to, and return the
   * user it was issued to. The caller completes the rotation by calling
   * `issue` for that user, so a refresh token is never usable twice.
   *
   * Throws `UnauthorizedException` for an unknown or expired token.
   */
  async rotate(refreshToken: string): Promise<string> {
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.refreshToken, this.hash(refreshToken)))
      .limit(1);

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date(session.expiresAt) < new Date()) {
      await this.db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.db.delete(schema.sessions).where(eq(schema.sessions.id, session.id));

    return session.userId;
  }

  /** Revoke the single session identified by `refreshToken`. */
  async revoke(refreshToken: string): Promise<void> {
    await this.db
      .delete(schema.sessions)
      .where(eq(schema.sessions.refreshToken, this.hash(refreshToken)));
  }

  /** Revoke every session for a user — logout-all, and after a password change. */
  async revokeAll(userId: string): Promise<void> {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  }

  /** Sessions for a user, without the token digest. */
  async list(userId: string) {
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

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
