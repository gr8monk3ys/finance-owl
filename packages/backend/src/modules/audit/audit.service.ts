import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    details?: string,
    ipAddress?: string,
  ) {
    await this.db.insert(schema.auditLog).values({
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
    });
  }

  async findByUser(userId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const logs = await this.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.userId, userId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.userId, userId));

    return {
      data: logs,
      total: countResult?.count ?? 0,
      page,
      limit,
    };
  }
}
