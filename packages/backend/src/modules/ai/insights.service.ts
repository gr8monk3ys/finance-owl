import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { OllamaClient } from './ollama.client';
import * as schema from '../../database/schema';

interface WeeklyInsight {
  title: string;
  body: string;
  data: {
    thisWeekTotal: number;
    lastWeekTotal: number;
    fourWeekAverage: number;
    topCategories: Array<{ name: string; total: number }>;
    weekOverWeekChange: number;
  };
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private ollamaClient: OllamaClient,
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
  ) {}

  async generateWeeklyInsight(userId: string): Promise<WeeklyInsight | null> {
    const today = new Date();
    const thisWeekStart = this.getWeekStart(today);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const fourWeeksAgo = new Date(thisWeekStart);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const formatDate = (d: Date): string => d.toISOString().split('T')[0];

    // Gather spending data for different periods
    const [thisWeekSpending, lastWeekSpending, fourWeekSpending, topCategories] =
      await Promise.all([
        this.getSpendingTotal(
          userId,
          formatDate(thisWeekStart),
          formatDate(today),
        ),
        this.getSpendingTotal(
          userId,
          formatDate(lastWeekStart),
          formatDate(thisWeekStart),
        ),
        this.getSpendingTotal(
          userId,
          formatDate(fourWeeksAgo),
          formatDate(thisWeekStart),
        ),
        this.getTopCategories(
          userId,
          formatDate(thisWeekStart),
          formatDate(today),
        ),
      ]);

    const fourWeekAverage = fourWeekSpending / 4;
    const weekOverWeekChange =
      lastWeekSpending > 0
        ? ((thisWeekSpending - lastWeekSpending) / lastWeekSpending) * 100
        : 0;

    const insightData = {
      thisWeekTotal: thisWeekSpending,
      lastWeekTotal: lastWeekSpending,
      fourWeekAverage,
      topCategories,
      weekOverWeekChange,
    };

    // Generate narrative if Ollama is available
    if (this.ollamaClient.isAvailable()) {
      const narrative = await this.generateNarrative(insightData);

      if (narrative) {
        // Save as notification
        await this.db.insert(schema.notifications).values({
          userId,
          type: 'insight',
          title: narrative.title,
          body: narrative.body,
          data: JSON.stringify(insightData),
        });

        return {
          title: narrative.title,
          body: narrative.body,
          data: insightData,
        };
      }
    }

    // Fallback: generate a simple summary without AI
    const title = 'Weekly Spending Summary';
    const changeDirection = weekOverWeekChange >= 0 ? 'up' : 'down';
    const body =
      `You spent $${thisWeekSpending.toFixed(2)} this week, ` +
      `${changeDirection} ${Math.abs(weekOverWeekChange).toFixed(1)}% from last week ($${lastWeekSpending.toFixed(2)}). ` +
      `Your 4-week average is $${fourWeekAverage.toFixed(2)}.` +
      (topCategories.length > 0
        ? ` Top category: ${topCategories[0].name} ($${topCategories[0].total.toFixed(2)}).`
        : '');

    await this.db.insert(schema.notifications).values({
      userId,
      type: 'insight',
      title,
      body,
      data: JSON.stringify(insightData),
    });

    return { title, body, data: insightData };
  }

  async getInsights(
    userId: string,
    limit: number = 10,
  ): Promise<
    Array<{
      id: string;
      title: string;
      body: string;
      data: unknown;
      read: boolean;
      createdAt: Date;
    }>
  > {
    const rows = await this.db
      .select({
        id: schema.notifications.id,
        title: schema.notifications.title,
        body: schema.notifications.body,
        data: schema.notifications.data,
        read: schema.notifications.read,
        createdAt: schema.notifications.createdAt,
      })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.type, 'insight'),
        ),
      )
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null,
    }));
  }

  private async getSpendingTotal(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const result = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(${schema.transactions.amount})), 0)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          sql`${schema.transactions.amount} > 0`,
        ),
      );

    return result[0]?.total ?? 0;
  }

  private async getTopCategories(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ name: string; total: number }>> {
    const rows = await this.db
      .select({
        name: sql<string>`COALESCE(${schema.categories.name}, 'Uncategorized')`,
        total: sql<number>`SUM(ABS(${schema.transactions.amount}))`,
      })
      .from(schema.transactions)
      .leftJoin(
        schema.categories,
        eq(schema.transactions.categoryId, schema.categories.id),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          gte(schema.transactions.date, startDate),
          lte(schema.transactions.date, endDate),
          sql`${schema.transactions.amount} > 0`,
        ),
      )
      .groupBy(schema.categories.name)
      .orderBy(sql`SUM(ABS(${schema.transactions.amount})) DESC`)
      .limit(5);

    return rows.map((r) => ({ name: r.name, total: r.total }));
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    // Monday as start of week
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async generateNarrative(data: {
    thisWeekTotal: number;
    lastWeekTotal: number;
    fourWeekAverage: number;
    topCategories: Array<{ name: string; total: number }>;
    weekOverWeekChange: number;
  }): Promise<{ title: string; body: string } | null> {
    const categoriesSummary =
      data.topCategories.length > 0
        ? data.topCategories
            .map((c) => `${c.name}: $${c.total.toFixed(2)}`)
            .join(', ')
        : 'No categorized spending';

    const prompt = `You are a personal finance assistant. Generate a brief weekly spending insight.

Data:
- This week's spending: $${data.thisWeekTotal.toFixed(2)}
- Last week's spending: $${data.lastWeekTotal.toFixed(2)}
- 4-week average: $${data.fourWeekAverage.toFixed(2)}
- Week-over-week change: ${data.weekOverWeekChange.toFixed(1)}%
- Top categories: ${categoriesSummary}

Respond in JSON format only:
{"title": "short title (max 60 chars)", "body": "2-3 sentence insight with actionable advice"}`;

    const response = await this.ollamaClient.generate(prompt, {
      temperature: 0.5,
    });

    if (!response) return null;

    try {
      // Extract JSON from the response, handling potential markdown wrapping
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as {
        title: string;
        body: string;
      };

      if (parsed.title && parsed.body) {
        return parsed;
      }

      return null;
    } catch {
      this.logger.debug('Failed to parse AI-generated insight narrative');
      return null;
    }
  }
}
