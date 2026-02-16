import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

@Injectable()
export class OllamaClient implements OnModuleInit {
  private readonly logger = new Logger(OllamaClient.name);
  private baseUrl: string;
  private model: string;
  private available = false;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434',
    );
    this.model = this.configService.get<string>('OLLAMA_MODEL', 'llama3');
  }

  async onModuleInit() {
    await this.checkHealth();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      this.available = res.ok;
      if (this.available) {
        this.logger.log('Ollama is available');
      } else {
        this.logger.warn('Ollama returned non-OK status');
      }
    } catch {
      this.available = false;
      this.logger.warn(
        'Ollama is not available — AI features will be disabled',
      );
    }
    return this.available;
  }

  isAvailable(): boolean {
    return this.available;
  }

  async generate(prompt: string, options?: { temperature?: number }): Promise<string | null> {
    if (!this.available) return null;

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.1,
          },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        this.logger.warn(`Ollama generate failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      return data.response.trim();
    } catch (error) {
      this.logger.warn(`Ollama generate error: ${error}`);
      // Mark as unavailable if connection failed
      this.available = false;
      return null;
    }
  }

  getStatus() {
    return {
      available: this.available,
      model: this.model,
      url: this.baseUrl,
    };
  }
}
