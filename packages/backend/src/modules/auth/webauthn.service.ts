import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/types';

// SimpleWebAuthn is ESM-only -- use dynamic imports
async function loadWebAuthn() {
  const mod = await import('@simplewebauthn/server');
  return mod;
}

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private rpName: string;
  private rpID: string;
  private origin: string;

  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private configService: ConfigService,
    private cacheService: CacheService,
  ) {
    this.rpName = this.configService.get('WEBAUTHN_RP_NAME', 'FinanceOwl');
    this.rpID = this.configService.get('WEBAUTHN_RP_ID', 'localhost');
    this.origin = this.configService.get('WEBAUTHN_ORIGIN', 'http://localhost:3000');
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
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    await this.setChallenge(userId, options.challenge);
    return options;
  }

  async verifyRegistration(userId: string, body: unknown) {
    const { verifyRegistrationResponse } = await loadWebAuthn();
    const regBody = body as RegistrationResponseJSON;

    const expectedChallenge = await this.getAndValidateChallenge(userId);

    const verification = await verifyRegistrationResponse({
      response: regBody,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('WebAuthn verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await this.db.insert(schema.webauthnCredentials).values({
      id: credential.id,
      userId,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: regBody.response?.transports ? JSON.stringify(regBody.response.transports) : null,
    });

    return { verified: true };
  }

  async generateAuthenticationOptions(userId?: string) {
    const { generateAuthenticationOptions } = await loadWebAuthn();

    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;

    if (userId) {
      const creds = await this.db
        .select()
        .from(schema.webauthnCredentials)
        .where(eq(schema.webauthnCredentials.userId, userId));

      allowCredentials = creds.map((cred) => ({
        id: cred.id,
        transports: cred.transports
          ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
          : undefined,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials,
      userVerification: 'required',
    });

    // Store challenge keyed by a temp ID when no userId
    const challengeKey = userId || 'anonymous';
    await this.setChallenge(challengeKey, options.challenge);

    return options;
  }

  async verifyAuthentication(body: unknown, userId?: string) {
    const { verifyAuthenticationResponse } = await loadWebAuthn();

    const credential_body = body as AuthenticationResponseJSON;
    const credentialId = credential_body.id;

    const [credential] = await this.db
      .select()
      .from(schema.webauthnCredentials)
      .where(eq(schema.webauthnCredentials.id, credentialId))
      .limit(1);

    if (!credential) {
      throw new BadRequestException('Credential not found');
    }

    const challengeKey = userId || 'anonymous';
    const expectedChallenge = await this.getAndValidateChallenge(challengeKey);

    const verification = await verifyAuthenticationResponse({
      response: credential_body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.id,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64')),
        counter: credential.counter,
        transports: credential.transports
          ? (JSON.parse(credential.transports) as AuthenticatorTransportFuture[])
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

  /** Store a challenge in the cache with a 5-minute TTL. */
  private async setChallenge(key: string, challenge: string): Promise<void> {
    await this.cacheService.set(`webauthn:challenge:${key}`, challenge, 300);
  }

  /**
   * Retrieve and validate a challenge, removing it on retrieval (single-use).
   * Throws if the challenge does not exist or has expired.
   */
  private async getAndValidateChallenge(key: string): Promise<string> {
    const cacheKey = `webauthn:challenge:${key}`;
    const challenge = await this.cacheService.get<string>(cacheKey);
    if (!challenge) {
      throw new BadRequestException('No challenge found. Please request a new challenge.');
    }

    // Always delete the challenge (single-use)
    await this.cacheService.del(cacheKey);

    return challenge;
  }
}
