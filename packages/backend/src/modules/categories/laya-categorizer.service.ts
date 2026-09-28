import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, isNull, or } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

/**
 * Suggests a category for an uncategorized transaction using laya
 * (https://github.com/NandhaKishorM/laya), a small decision model served by
 * `laya-serve` over `POST /v1/systemone`.
 *
 * The transaction's text is sent with a single `choice` question whose options
 * are the user's categories (their own plus the system defaults). Laya answers
 * in one forward pass and generates nothing, so it can run self-hosted next to
 * the rest of the stack. Transaction text never leaves infrastructure you
 * control, which suits a privacy-first finance app.
 *
 * Off unless `LAYA_URL` is set. Laya's accuracy is roughly 0.7-0.8, so a
 * suggestion is only returned at `answer_confidence >= LAYA_CATEGORIZE_MIN_CONFIDENCE`
 * (default 0.7), it is only ever applied to a transaction that has no category,
 * and it is recorded as `categorizationSource: 'ai'` so a later user correction
 * is tracked like any other. Every failure is "no suggestion".
 */

export interface CategorizableTransaction {
  name: string;
  merchantName?: string | null;
  description?: string | null;
  amount?: number | null;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
}

/** laya-serve refuses more than 100 options per question; stay well inside it. */
const MAX_OPTIONS = 64;
const DEFAULT_MIN_CONFIDENCE = 0.7;
const DEFAULT_TIMEOUT_MS = 2000;

function positiveNumber(raw: unknown, fallback: number, max = Infinity): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value <= max ? value : fallback;
}

@Injectable()
export class LayaCategorizerService {
  private readonly logger = new Logger(LayaCategorizerService.name);
  private readonly endpoint: string | null;
  private readonly apiKey: string | undefined;
  private readonly minConfidence: number;
  private readonly timeoutMs: number;

  constructor(
    @Inject(DATABASE_TOKEN) private readonly db: DrizzleDB,
    config: ConfigService,
  ) {
    const url = config.get<string>('LAYA_URL')?.trim();
    const base = url ? url.replace(/\/+$/, '') : '';
    this.endpoint = base ? (base.endsWith('/v1/systemone') ? base : `${base}/v1/systemone`) : null;
    this.apiKey = config.get<string>('LAYA_API_KEY')?.trim() || undefined;
    this.minConfidence = positiveNumber(
      config.get('LAYA_CATEGORIZE_MIN_CONFIDENCE'),
      DEFAULT_MIN_CONFIDENCE,
      1,
    );
    this.timeoutMs = positiveNumber(config.get('LAYA_TIMEOUT_MS'), DEFAULT_TIMEOUT_MS);
  }

  get enabled(): boolean {
    return this.endpoint !== null;
  }

  /** Categories this user can assign, keyed by a unique display name. */
  private async categoryOptions(userId: string): Promise<Map<string, string>> {
    const rows = await this.db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        userId: schema.categories.userId,
      })
      .from(schema.categories)
      .where(or(eq(schema.categories.userId, userId), isNull(schema.categories.userId)))
      .orderBy(schema.categories.sortOrder, schema.categories.name);

    // A user's own category wins over a system default with the same name.
    const byName = new Map<string, string>();
    for (const row of [...rows].sort((a, b) => Number(!a.userId) - Number(!b.userId))) {
      const name = row.name.trim();
      if (name && !byName.has(name)) byName.set(name, row.id);
    }
    return byName;
  }

  private describe(tx: CategorizableTransaction): string {
    const lines = [`Transaction: ${tx.name}`];
    if (tx.merchantName) lines.push(`Merchant: ${tx.merchantName}`);
    if (tx.description) lines.push(`Description: ${tx.description}`);
    if (typeof tx.amount === 'number') lines.push(`Amount: ${tx.amount}`);
    return lines.join('\n');
  }

  /**
   * Suggest a category for one transaction, or `null` when laya is off,
   * unsure, unreachable, or picks something that is not one of the options.
   */
  async suggest(userId: string, tx: CategorizableTransaction): Promise<CategorySuggestion | null> {
    if (!this.endpoint || !tx.name?.trim()) return null;

    try {
      const options = await this.categoryOptions(userId);
      if (options.size < 2 || options.size > MAX_OPTIONS) return null;

      const criteria: Record<string, string> = {};
      for (const name of options.keys()) criteria[name] = name;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state: this.describe(tx),
          questions: {
            category: {
              type: 'choice',
              instructions: 'Which spending category does this bank transaction belong to?',
              criteria,
            },
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return null;

      const body = (await res.json()) as {
        answers?: { category?: { choice?: unknown; answer_confidence?: unknown } };
      };
      const answer = body.answers?.category;
      const choice = typeof answer?.choice === 'string' ? answer.choice : null;
      const confidence =
        typeof answer?.answer_confidence === 'number' ? answer.answer_confidence : 0;
      if (!choice || confidence < this.minConfidence) return null;

      const categoryId = options.get(choice);
      if (!categoryId) return null;
      return { categoryId, categoryName: choice, confidence };
    } catch (err) {
      this.logger.debug(`laya categorization skipped: ${(err as Error).message}`);
      return null;
    }
  }
}
