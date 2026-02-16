import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HibpBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
  LogoPath: string;
}

@Injectable()
export class HibpProvider {
  private readonly logger = new Logger(HibpProvider.name);
  private readonly apiKey: string;
  private lastRequestTime = 0;
  private readonly rateLimitMs = 1500; // 1.5s between requests per HIBP API requirements

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('HIBP_API_KEY', '');
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      const delay = this.rateLimitMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }

  async getBreachesForEmail(email: string): Promise<HibpBreach[]> {
    if (!this.apiKey) {
      this.logger.warn(
        'HIBP_API_KEY is not configured — breach checks will not work',
      );
      return [];
    }

    await this.rateLimit();

    const encodedEmail = encodeURIComponent(email);
    const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodedEmail}?truncateResponse=false`;

    try {
      const res = await fetch(url, {
        headers: {
          'hibp-api-key': this.apiKey,
          'User-Agent': 'FinanceOwl-IdentityMonitor',
        },
      });

      if (res.status === 404) {
        // No breaches found — this is a good thing
        return [];
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        this.logger.warn(
          `HIBP rate limited. Retry after ${retryAfter ?? 'unknown'} seconds`,
        );
        throw new Error('Rate limited by HaveIBeenPwned API. Please try again later.');
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `HIBP API error: ${res.status} ${res.statusText} — ${body}`,
        );
        throw new Error(`HaveIBeenPwned API error: ${res.status}`);
      }

      return (await res.json()) as HibpBreach[];
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Rate limited')
      ) {
        throw error;
      }
      this.logger.error(`Failed to check email breaches: ${error}`);
      throw new Error('Failed to check email for breaches');
    }
  }

  async checkPasswordRange(
    hashPrefix: string,
  ): Promise<Map<string, number>> {
    if (hashPrefix.length !== 5) {
      throw new Error('Hash prefix must be exactly 5 characters');
    }

    await this.rateLimit();

    const url = `https://api.pwnedpasswords.com/range/${hashPrefix}`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'FinanceOwl-IdentityMonitor',
        },
      });

      if (res.status === 429) {
        throw new Error('Rate limited by PwnedPasswords API. Please try again later.');
      }

      if (!res.ok) {
        throw new Error(`PwnedPasswords API error: ${res.status}`);
      }

      const text = await res.text();
      const results = new Map<string, number>();

      for (const line of text.split('\r\n')) {
        if (!line) continue;
        const [suffix, countStr] = line.split(':');
        results.set(suffix.toUpperCase(), parseInt(countStr, 10));
      }

      return results;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Rate limited')
      ) {
        throw error;
      }
      this.logger.error(`Failed to check password range: ${error}`);
      throw new Error('Failed to check password exposure');
    }
  }
}
