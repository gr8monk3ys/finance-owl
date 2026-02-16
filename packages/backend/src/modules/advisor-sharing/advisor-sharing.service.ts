import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { advisorShares, advisorAccessLogs } from './advisor-sharing.schema';

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

@Injectable()
export class AdvisorSharingService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async createShare(
    userId: string,
    data: {
      advisorEmail: string;
      advisorName: string;
      permissions: string[];
      expiresAt?: string;
    },
  ) {
    const [share] = await this.db
      .insert(advisorShares)
      .values({
        userId,
        advisorEmail: data.advisorEmail,
        advisorName: data.advisorName,
        token: generateToken(),
        permissions: JSON.stringify(data.permissions),
        expiresAt: data.expiresAt,
      })
      .returning();

    return {
      ...share,
      permissions: JSON.parse(share.permissions),
    };
  }

  async getShares(userId: string) {
    const shares = await this.db
      .select()
      .from(advisorShares)
      .where(eq(advisorShares.userId, userId))
      .orderBy(desc(advisorShares.createdAt));

    return shares.map((share) => ({
      ...share,
      permissions: JSON.parse(share.permissions),
    }));
  }

  async revokeShare(userId: string, shareId: string) {
    const [share] = await this.db
      .select()
      .from(advisorShares)
      .where(
        and(eq(advisorShares.id, shareId), eq(advisorShares.userId, userId)),
      )
      .limit(1);

    if (!share) throw new NotFoundException('Share not found');

    await this.db
      .update(advisorShares)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(advisorShares.id, shareId));
  }

  async getShareByToken(token: string) {
    const [share] = await this.db
      .select()
      .from(advisorShares)
      .where(
        and(eq(advisorShares.token, token), eq(advisorShares.isActive, true)),
      )
      .limit(1);

    if (!share) throw new NotFoundException('Share not found or has been revoked');

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      throw new NotFoundException('Share link has expired');
    }

    await this.db
      .update(advisorShares)
      .set({ lastAccessedAt: new Date().toISOString() })
      .where(eq(advisorShares.id, share.id));

    return {
      ...share,
      permissions: JSON.parse(share.permissions),
    };
  }

  async logAccess(shareId: string, action: string, ipAddress?: string) {
    const [log] = await this.db
      .insert(advisorAccessLogs)
      .values({
        shareId,
        action,
        ipAddress,
      })
      .returning();

    return log;
  }

  async getAccessLogs(userId: string, shareId: string) {
    const [share] = await this.db
      .select()
      .from(advisorShares)
      .where(
        and(eq(advisorShares.id, shareId), eq(advisorShares.userId, userId)),
      )
      .limit(1);

    if (!share) throw new NotFoundException('Share not found');

    return this.db
      .select()
      .from(advisorAccessLogs)
      .where(eq(advisorAccessLogs.shareId, shareId))
      .orderBy(desc(advisorAccessLogs.accessedAt));
  }
}
