import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OllamaClient } from './ollama.client';

interface ChromaDocument {
  id: string;
  text: string;
  metadata: Record<string, any>;
}

interface ChromaQueryResult {
  id: string;
  document: string;
  metadata: Record<string, any>;
  distance: number;
}

@Injectable()
export class ChromaDBService implements OnModuleInit {
  private readonly logger = new Logger(ChromaDBService.name);
  private baseUrl: string;
  private embeddingModel: string;
  private collectionId: string | null = null;
  private available = false;

  constructor(
    private configService: ConfigService,
    private ollamaClient: OllamaClient,
  ) {
    this.baseUrl = this.configService.get<string>(
      'CHROMADB_URL',
      'http://localhost:8000',
    );
    this.embeddingModel = this.configService.get<string>(
      'EMBEDDING_MODEL',
      'nomic-embed-text',
    );
  }

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Check if ChromaDB is reachable
      const heartbeat = await fetch(`${this.baseUrl}/api/v1/heartbeat`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!heartbeat.ok) {
        this.logger.warn('ChromaDB returned non-OK status');
        return;
      }

      // Create or get the 'transactions' collection
      const res = await fetch(`${this.baseUrl}/api/v1/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'transactions',
          get_or_create: true,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        this.logger.warn(
          `Failed to create/get ChromaDB collection: ${res.status}`,
        );
        return;
      }

      const collection = (await res.json()) as { id: string };
      this.collectionId = collection.id;
      this.available = true;
      this.logger.log('ChromaDB is available');
    } catch {
      this.available = false;
      this.logger.warn(
        'ChromaDB is not available -- vector search will be disabled',
      );
    }
  }

  isAvailable(): boolean {
    return this.available && this.collectionId !== null;
  }

  async getEmbedding(text: string): Promise<number[] | null> {
    if (!this.ollamaClient.isAvailable()) return null;

    const ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434',
    );

    try {
      const res = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt: text,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        this.logger.warn(`Embedding request failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as { embedding: number[] };
      return data.embedding;
    } catch (error) {
      this.logger.warn(`Embedding error: ${error}`);
      return null;
    }
  }

  async addDocuments(docs: ChromaDocument[]): Promise<void> {
    if (!this.isAvailable()) return;
    if (docs.length === 0) return;

    // Generate embeddings for all documents
    const embeddings: number[][] = [];
    for (const doc of docs) {
      const embedding = await this.getEmbedding(doc.text);
      if (!embedding) {
        this.logger.warn(
          `Failed to generate embedding for document ${doc.id}, skipping batch`,
        );
        return;
      }
      embeddings.push(embedding);
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/collections/${this.collectionId}/add`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: docs.map((d) => d.id),
            embeddings,
            documents: docs.map((d) => d.text),
            metadatas: docs.map((d) => d.metadata),
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`ChromaDB add failed: ${res.status} - ${body}`);
      }
    } catch (error) {
      this.logger.warn(`ChromaDB add error: ${error}`);
      this.available = false;
    }
  }

  async query(
    queryText: string,
    nResults: number = 5,
  ): Promise<ChromaQueryResult[]> {
    if (!this.isAvailable()) return [];

    const embedding = await this.getEmbedding(queryText);
    if (!embedding) return [];

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/collections/${this.collectionId}/query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query_embeddings: [embedding],
            n_results: nResults,
            include: ['documents', 'metadatas', 'distances'],
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`ChromaDB query failed: ${res.status}`);
        return [];
      }

      const data = (await res.json()) as {
        ids: string[][];
        documents: string[][];
        metadatas: Record<string, any>[][];
        distances: number[][];
      };

      if (
        !data.ids ||
        data.ids.length === 0 ||
        data.ids[0].length === 0
      ) {
        return [];
      }

      return data.ids[0].map((id, i) => ({
        id,
        document: data.documents[0][i],
        metadata: data.metadatas[0][i],
        distance: data.distances[0][i],
      }));
    } catch (error) {
      this.logger.warn(`ChromaDB query error: ${error}`);
      this.available = false;
      return [];
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.isAvailable()) return;
    if (ids.length === 0) return;

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/collections/${this.collectionId}/delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!res.ok) {
        this.logger.warn(`ChromaDB delete failed: ${res.status}`);
      }
    } catch (error) {
      this.logger.warn(`ChromaDB delete error: ${error}`);
    }
  }
}
