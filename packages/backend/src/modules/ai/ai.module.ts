import { Module } from '@nestjs/common';
import { OllamaClient } from './ollama.client';
import { ChromaDBService } from './chromadb.service';
import { CategorizationService } from './categorization.service';
import { RagService } from './rag.service';
import { InsightsService } from './insights.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AiController } from './ai.controller';
import { AiJobProcessor } from '../jobs/embedding-sync.processor';
import { WeeklyInsightsScheduler } from '../jobs/weekly-insights.scheduler';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  providers: [
    OllamaClient,
    ChromaDBService,
    CategorizationService,
    RagService,
    InsightsService,
    AnomalyDetectionService,
    AiJobProcessor,
    WeeklyInsightsScheduler,
  ],
  controllers: [AiController],
  exports: [
    OllamaClient,
    ChromaDBService,
    CategorizationService,
    RagService,
    InsightsService,
    AnomalyDetectionService,
  ],
})
export class AiModule {}
