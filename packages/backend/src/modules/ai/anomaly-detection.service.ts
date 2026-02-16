import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gte, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface AnomalyResult {
  transactionId: string;
  date: string;
  merchantName: string;
  amount: number;
  categoryName: string | null;
  mean: number;
  stddev: number;
  zScore: number;
  reason: string;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async detectAnomalies(userId: string): Promise<AnomalyResult[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Get recent transactions (last 7 days)
    const recentTx = await this.db
      .select({
        id: schema.transactions.id,
        date: schema.transactions.date,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        amount: schema.transactions.amount,
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, sevenDaysAgoStr),
        ),
      );

    if (recentTx.length === 0) return [];

    // Get historical stats per merchant/category combo
    const stats = await this.db
      .select({
        merchantName: schema.transactions.merchantName,
        categoryId: schema.transactions.categoryId,
        mean: sql<number>`AVG(ABS(${schema.transactions.amount}))`,
        stddev: sql<number>`
          CASE
            WHEN COUNT(*) < 3 THEN NULL
            ELSE (
              SUM(ABS(${schema.transactions.amount}) * ABS(${schema.transactions.amount})) / COUNT(*)
              - (SUM(ABS(${schema.transactions.amount})) / COUNT(*))
              * (SUM(ABS(${schema.transactions.amount})) / COUNT(*))
            )
          END
        `,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .groupBy(
        schema.transactions.merchantName,
        schema.transactions.categoryId,
      );

    // Build a lookup map by merchant+category
    const statsMap = new Map<string, { mean: number; stddev: number; count: number }>();
    for (const stat of stats) {
      const key = `${stat.merchantName || ''}|${stat.categoryId || ''}`;
      // stddev from the variance (take sqrt)
      const variance = stat.stddev;
      const stddev =
        variance !== null && variance > 0 ? Math.sqrt(variance) : 0;
      statsMap.set(key, {
        mean: stat.mean,
        stddev,
        count: stat.count,
      });
    }

    const anomalies: AnomalyResult[] = [];

    for (const tx of recentTx) {
      const key = `${tx.merchantName || ''}|${tx.categoryId || ''}`;
      const stat = statsMap.get(key);

      // Need at least 3 historical transactions to detect anomalies
      if (!stat || stat.count < 3 || stat.stddev === 0) continue;

      const absAmount = Math.abs(tx.amount);
      const zScore = (absAmount - stat.mean) / stat.stddev;

      // Flag if z-score exceeds 2 standard deviations
      if (Math.abs(zScore) > 2) {
        const merchant = tx.merchantName || tx.name;
        const direction = zScore > 0 ? 'higher' : 'lower';

        anomalies.push({
          transactionId: tx.id,
          date: tx.date,
          merchantName: merchant,
          amount: tx.amount,
          categoryName: tx.categoryName,
          mean: stat.mean,
          stddev: stat.stddev,
          zScore,
          reason: `$${absAmount.toFixed(2)} is ${Math.abs(zScore).toFixed(1)}x standard deviations ${direction} than your typical ${merchant} transaction ($${stat.mean.toFixed(2)} avg)`,
        });
      }
    }

    // Sort by z-score magnitude (most anomalous first)
    anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    // Save anomaly notifications for new anomalies
    for (const anomaly of anomalies) {
      await this.saveAnomalyNotification(userId, anomaly);
    }

    return anomalies;
  }

  async detectForAllUsers(): Promise<void> {
    const users = await this.db
      .select({ id: schema.users.id })
      .from(schema.users);

    this.logger.log(
      `Running anomaly detection for ${users.length} users`,
    );

    for (const user of users) {
      try {
        const anomalies = await this.detectAnomalies(user.id);
        if (anomalies.length > 0) {
          this.logger.log(
            `Found ${anomalies.length} anomalies for user ${user.id}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Anomaly detection failed for user ${user.id}: ${error}`,
        );
      }
    }
  }

  private async saveAnomalyNotification(
    userId: string,
    anomaly: AnomalyResult,
  ): Promise<void> {
    // Check if we already notified about this transaction
    const existing = await this.db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.type, 'anomaly'),
          sql`json_extract(${schema.notifications.data}, '$.transactionId') = ${anomaly.transactionId}`,
        ),
      )
      .limit(1);

    if (existing.length > 0) return;

    await this.db.insert(schema.notifications).values({
      userId,
      type: 'anomaly',
      title: `Unusual transaction: ${anomaly.merchantName}`,
      body: anomaly.reason,
      data: JSON.stringify({
        transactionId: anomaly.transactionId,
        amount: anomaly.amount,
        zScore: anomaly.zScore,
        mean: anomaly.mean,
      }),
    });
  }
}
