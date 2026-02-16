import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from './jobs.module';
import { RagService } from '../ai/rag.service';
import { InsightsService } from '../ai/insights.service';
import { AnomalyDetectionService } from '../ai/anomaly-detection.service';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface EmbedTransactionsJobData {
  userId: string;
  transactionIds: string[];
}

@Processor(QUEUES.AI_CATEGORIZE)
export class AiJobProcessor extends WorkerHost {
  private readonly logger = new Logger(AiJobProcessor.name);

  constructor(
    private ragService: RagService,
    private insightsService: InsightsService,
    private anomalyDetectionService: AnomalyDetectionService,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'embed-transactions':
        await this.handleEmbedTransactions(job as Job<EmbedTransactionsJobData>);
        break;

      case 'weekly-insights':
        await this.handleWeeklyInsights();
        break;

      default:
        this.logger.debug(`Unknown job name on AI queue: ${job.name}`);
    }
  }

  private async handleEmbedTransactions(
    job: Job<EmbedTransactionsJobData>,
  ): Promise<void> {
    const { userId, transactionIds } = job.data;
    this.logger.log(
      `Embedding ${transactionIds.length} transactions for user ${userId}`,
    );

    await this.ragService.embedTransactions(userId, transactionIds);

    this.logger.log(
      `Embedding complete for ${transactionIds.length} transactions`,
    );
  }

  private async handleWeeklyInsights(): Promise<void> {
    this.logger.log('Running weekly insights and anomaly detection');

    const users = await this.db
      .select({ id: schema.users.id })
      .from(schema.users);

    for (const user of users) {
      try {
        await this.insightsService.generateWeeklyInsight(user.id);
        this.logger.debug(`Generated weekly insight for user ${user.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to generate insight for user ${user.id}: ${error}`,
        );
      }

      try {
        await this.anomalyDetectionService.detectAnomalies(user.id);
        this.logger.debug(`Anomaly detection complete for user ${user.id}`);
      } catch (error) {
        this.logger.error(
          `Anomaly detection failed for user ${user.id}: ${error}`,
        );
      }
    }

    this.logger.log('Weekly insights and anomaly detection complete');
  }
}
