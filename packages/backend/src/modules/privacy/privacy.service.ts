import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import {
  privacyConsents,
  dataExportRequests,
  dataDeletionRequests,
} from './privacy.schema';

@Injectable()
export class PrivacyService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getConsents(userId: string) {
    return this.db
      .select()
      .from(privacyConsents)
      .where(eq(privacyConsents.userId, userId))
      .orderBy(desc(privacyConsents.createdAt));
  }

  async updateConsent(
    userId: string,
    consentType: string,
    isGranted: boolean,
    ipAddress?: string,
  ) {
    const [existing] = await this.db
      .select()
      .from(privacyConsents)
      .where(
        and(
          eq(privacyConsents.userId, userId),
          eq(privacyConsents.consentType, consentType),
        ),
      )
      .limit(1);

    const nowStr = new Date().toISOString();

    if (existing) {
      const [updated] = await this.db
        .update(privacyConsents)
        .set({
          isGranted,
          grantedAt: isGranted ? nowStr : existing.grantedAt,
          revokedAt: isGranted ? null : nowStr,
          ipAddress,
          updatedAt: new Date(),
        })
        .where(eq(privacyConsents.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(privacyConsents)
      .values({
        userId,
        consentType,
        isGranted,
        grantedAt: isGranted ? nowStr : null,
        revokedAt: isGranted ? null : nowStr,
        ipAddress,
      })
      .returning();

    return created;
  }

  async requestDataExport(userId: string, format: string = 'json') {
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [request] = await this.db
      .insert(dataExportRequests)
      .values({
        userId,
        format,
        expiresAt,
      })
      .returning();

    return request;
  }

  async getExportStatus(userId: string, requestId: string) {
    const [request] = await this.db
      .select()
      .from(dataExportRequests)
      .where(
        and(
          eq(dataExportRequests.id, requestId),
          eq(dataExportRequests.userId, userId),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Export request not found');

    return request;
  }

  async requestDeletion(userId: string, reason?: string) {
    const scheduledAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [request] = await this.db
      .insert(dataDeletionRequests)
      .values({
        userId,
        reason,
        scheduledAt,
      })
      .returning();

    return request;
  }

  async confirmDeletion(userId: string, requestId: string) {
    const [request] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(
        and(
          eq(dataDeletionRequests.id, requestId),
          eq(dataDeletionRequests.userId, userId),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Deletion request not found');

    const [updated] = await this.db
      .update(dataDeletionRequests)
      .set({ status: 'confirmed' })
      .where(eq(dataDeletionRequests.id, requestId))
      .returning();

    return updated;
  }

  async getDeletionStatus(userId: string, requestId: string) {
    const [request] = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(
        and(
          eq(dataDeletionRequests.id, requestId),
          eq(dataDeletionRequests.userId, userId),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Deletion request not found');

    return request;
  }

  async getPrivacyDashboard(userId: string) {
    const consents = await this.db
      .select()
      .from(privacyConsents)
      .where(eq(privacyConsents.userId, userId))
      .orderBy(desc(privacyConsents.createdAt));

    const exports = await this.db
      .select()
      .from(dataExportRequests)
      .where(eq(dataExportRequests.userId, userId))
      .orderBy(desc(dataExportRequests.createdAt));

    const deletions = await this.db
      .select()
      .from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.userId, userId))
      .orderBy(desc(dataDeletionRequests.createdAt));

    return { consents, exports, deletions };
  }
}
