import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { Public, CurrentUser } from '../../common/decorators';
import { OllamaClient } from './ollama.client';
import { RagService } from './rag.service';
import { InsightsService } from './insights.service';
import { AnomalyDetectionService } from './anomaly-detection.service';

@Controller('ai')
export class AiController {
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
    return { ...status, available };
  }

  @Post('query')
  async query(
    @CurrentUser('id') userId: string,
    @Body('question') question: string,
  ) {
    if (!question || question.trim().length === 0) {
      return { answer: 'Please provide a question.', sources: [] };
    }

    return this.ragService.query(userId, question.trim());
  }

  @Get('insights')
  async getInsights(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const insights = await this.insightsService.getInsights(
      userId,
      isNaN(parsedLimit) ? 10 : parsedLimit,
    );
    return { insights };
  }

  @Post('detect-anomalies')
  async detectAnomalies(@CurrentUser('id') userId: string) {
    const anomalies =
      await this.anomalyDetectionService.detectAnomalies(userId);
    return { anomalies };
  }
}
