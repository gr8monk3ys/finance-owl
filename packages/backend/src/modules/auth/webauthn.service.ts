import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

// SimpleWebAuthn is ESM-only -- use dynamic imports
async function loadWebAuthn() {
  const mod = await import('@simplewebauthn/server');
  return mod;
}

/** Challenge stored with creation timestamp for expiry enforcement. */
interface StoredChallenge {
  challenge: string;
  createdAt: number;
}

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private rpName: string;
  private rpID: string;
  private origin: string;

  // Challenge TTL: 5 minutes in milliseconds
  private static readonly CHALLENGE_TTL_MS = 5 * 60 * 1000;

  // In-memory challenge store with expiry (keyed by userId)
  private challenges = new Map<string, StoredChallenge>();

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private configService: ConfigService,
  ) {
    this.rpName = this.configService.get('WEBAUTHN_RP_NAME', 'FinanceOwl');
    this.rpID = this.configService.get('WEBAUTHN_RP_ID', 'localhost');
    this.origin = this.configService.get(
      'WEBAUTHN_ORIGIN',
      'http://localhost:3000',
    );

    // Periodically clean up expired challenges every 60 seconds
    setInterval(() => this.cleanupExpiredChallenges(), 60_000);
  }

  async generateRegistrationOptions(userId: string, userName: string) {
    const { generateRegistrationOptions } = await loadWebAuthn();

    const existingCreds = await this.db
      .select()
      .from(schema.webauthnCredentials)
      .where(eq(schema.webauthnCredentials.userId, userId));

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((cred) => ({
        id: cred.id,
        transports: cred.transports
          ? JSON.parse(cred.transports)
          : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    this.setChallenge(userId, options.challenge);
    return options;
  }

  async verifyRegistration(userId: string, body: any) {
    const { verifyRegistrationResponse } = await loadWebAuthn();

    const expectedChallenge = this.getAndValidateChallenge(userId);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('WebAuthn verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await this.db.insert(schema.webauthnCredentials).values({
      id: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: body.response?.transports
        ? JSON.stringify(body.response.transports)
        : null,
    });

    this.challenges.delete(userId);
    return { verified: true };
  }

  async generateAuthenticationOptions(userId?: string) {
    const { generateAuthenticationOptions } = await loadWebAuthn();

    let allowCredentials: any[] | undefined;

    if (userId) {
      const creds = await this.db
        .select()
        .from(schema.webauthnCredentials)
        .where(eq(schema.webauthnCredentials.userId, userId));

      allowCredentials = creds.map((cred) => ({
        id: cred.id,
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Store challenge keyed by a temp ID when no userId
    const challengeKey = userId || 'anonymous';
    this.setChallenge(challengeKey, options.challenge);

    return options;
  }

  async verifyAuthentication(body: any, userId?: string) {
    const { verifyAuthenticationResponse } = await loadWebAuthn();

    const credentialId = body.id;

    const [credential] = await this.db
      .select()
      .from(schema.webauthnCredentials)
      .where(eq(schema.webauthnCredentials.id, credentialId))
      .limit(1);

    if (!credential) {
      throw new BadRequestException('Credential not found');
    }

    const challengeKey = userId || 'anonymous';
    const expectedChallenge = this.getAndValidateChallenge(challengeKey);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(
          Buffer.from(credential.publicKey, 'base64'),
        ),
        counter: credential.counter,
        transports: credential.transports
          ? JSON.parse(credential.transports)
          : undefined,
      },
    });

    if (!verification.verified) {
      throw new BadRequestException('WebAuthn authentication failed');
    }

    // Update counter to prevent replay attacks
    await this.db
      .update(schema.webauthnCredentials)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(schema.webauthnCredentials.id, credentialId));

    this.challenges.delete(challengeKey);
    return { verified: true, userId: credential.userId };
  }

  async getCredentials(userId: string) {
    return this.db
      .select({
        id: schema.webauthnCredentials.id,
        deviceType: schema.webauthnCredentials.deviceType,
        backedUp: schema.webauthnCredentials.backedUp,
        createdAt: schema.webauthnCredentials.createdAt,
      })
      .from(schema.webauthnCredentials)
      .where(eq(schema.webauthnCredentials.userId, userId));
  }

  async removeCredential(userId: string, credentialId: string) {
    await this.db
      .delete(schema.webauthnCredentials)
      .where(
        and(
          eq(schema.webauthnCredentials.id, credentialId),
          eq(schema.webauthnCredentials.userId, userId),
        ),
      );
  }

  /** Store a challenge with a creation timestamp. */
  private setChallenge(key: string, challenge: string): void {
    this.challenges.set(key, {
      challenge,
      createdAt: Date.now(),
    });
  }

  /**
   * Retrieve and validate a challenge, removing it on retrieval (single-use).
   * Throws if the challenge does not exist or has expired.
   */
  private getAndValidateChallenge(key: string): string {
    const stored = this.challenges.get(key);
    if (!stored) {
      throw new BadRequestException(
        'No challenge found. Please request a new challenge.',
      );
    }

    // Always delete the challenge (single-use)
    this.challenges.delete(key);

    // Check if the challenge has expired
    const elapsed = Date.now() - stored.createdAt;
    if (elapsed > WebAuthnService.CHALLENGE_TTL_MS) {
      throw new BadRequestException(
        'Challenge has expired. Please request a new one.',
      );
    }

    return stored.challenge;
  }

  /** Remove all expired challenges from the in-memory store. */
  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, stored] of this.challenges.entries()) {
      if (now - stored.createdAt > WebAuthnService.CHALLENGE_TTL_MS) {
        this.challenges.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired WebAuthn challenges`);
    }
  }
}
