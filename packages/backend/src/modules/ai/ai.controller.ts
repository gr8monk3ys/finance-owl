import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { Public, CurrentUser } from '../../common/decorators';
import { OllamaClient } from './ollama.client';
import { RagService } from './rag.service';
import { InsightsService } from './insights.service';
import { AnomalyDetectionService } from './anomaly-detection.service';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private ollamaClient: OllamaClient,
    private ragService: RagService,
    private insightsService: InsightsService,
    private anomalyDetectionService: AnomalyDetectionService,
  ) {}

  @Public()
  @Get('status')
  async getStatus() {
    const status = this.ollamaClient.getStatus();
    const available = await this.ollamaClient.checkHealth();
    return {
      ...status,
      available,
      message: available
        ? undefined
        : "AI features require Ollama. Run 'docker compose up ollama' to enable.",
    };
  }

  @Post('query')
  async query(
    @CurrentUser('id') userId: string,
    @Body('question') question: string,
  ) {
    if (!question || question.trim().length === 0) {
      return { available: true, answer: 'Please provide a question.', sources: [] };
    }

    if (!this.ollamaClient.isAvailable()) {
      return {
        available: false,
        answer: null,
        sources: [],
        message: "AI features require Ollama. Run 'docker compose up ollama' to enable.",
      };
    }

    try {
      const result = await this.ragService.query(userId, question.trim());
      return { available: true, ...result };
    } catch (error) {
      this.logger.error(`AI query failed: ${error}`);
      return {
        available: true,
        answer: null,
        sources: [],
        error: 'Something went wrong while processing your question. Please try again.',
      };
    }
  }

  @Get('insights')
  async getInsights(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const aiAvailable = this.ollamaClient.isAvailable();
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    try {
      const insights = await this.insightsService.getInsights(
        userId,
        isNaN(parsedLimit) ? 10 : parsedLimit,
      );
      return {
        insights,
        aiAvailable,
        message: aiAvailable
          ? undefined
          : "AI-generated insights require Ollama. Run 'docker compose up ollama' to enable richer analysis.",
      };
    } catch (error) {
      this.logger.error(`Insights fetch failed: ${error}`);
      return {
        insights: [],
        aiAvailable,
        error: 'Failed to load insights.',
      };
    }
  }

  @Post('detect-anomalies')
  async detectAnomalies(@CurrentUser('id') userId: string) {
    try {
      const anomalies =
        await this.anomalyDetectionService.detectAnomalies(userId);
      return { anomalies };
    } catch (error) {
      this.logger.error(`Anomaly detection failed: ${error}`);
      return {
        anomalies: [],
        error: 'Failed to run anomaly detection. Please try again.',
      };
    }
  }
}
