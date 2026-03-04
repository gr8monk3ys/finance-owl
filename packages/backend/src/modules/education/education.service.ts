import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { articleProgress } from './education.schema';
import { articles, topics, type Article, type Topic } from './articles';
import { creditScores } from '../credit/credit.schema';
import { debts } from '../debt-payoff/debt-payoff.schema';
import { savingsGoals } from '../savings-goals/savings-goals.schema';

@Injectable()
export class EducationService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  getTopics(): (Topic & { articleCount: number })[] {
    return topics.map((topic) => ({
      ...topic,
      articleCount: articles.filter((a) => a.topic === topic.id).length,
    }));
  }

  getArticles(filters?: {
    topic?: string;
    difficulty?: string;
    search?: string;
  }): Omit<Article, 'content'>[] {
    let result = [...articles];

    if (filters?.topic) {
      result = result.filter((a) => a.topic === filters.topic);
    }

    if (filters?.difficulty) {
      result = result.filter((a) => a.difficulty === filters.difficulty);
    }

    if (filters?.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.summary.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    // Return without content to reduce payload
    return result.map(({ content, ...rest }) => rest);
  }

  getArticle(slug: string): Article {
    const article = articles.find((a) => a.slug === slug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Populate related articles with basic info
    return article;
  }

  getRelatedArticles(slug: string): Omit<Article, 'content'>[] {
    const article = articles.find((a) => a.slug === slug);
    if (!article) {
      return [];
    }

    return article.relatedArticleIds
      .map((id) => articles.find((a) => a.id === id))
      .filter((a): a is Article => a !== undefined)
      .map(({ content, ...rest }) => rest);
  }

  async getPersonalizedRecommendations(
    userId: string,
  ): Promise<Omit<Article, 'content'>[]> {
    const recommendations: Article[] = [];

    // Check user's financial situation to personalize (with graceful fallbacks)
    let latestCreditScore: { score: number } | undefined;
    let userDebts: Record<string, unknown>[] = [];
    let userSavings: Record<string, unknown>[] = [];

    try {
      const [score] = await this.db
        .select({ score: creditScores.score })
        .from(creditScores)
        .where(eq(creditScores.userId, userId))
        .orderBy(desc(creditScores.createdAt))
        .limit(1);
      latestCreditScore = score;
    } catch {
      // Table may not exist yet
    }

    try {
      userDebts = await this.db
        .select()
        .from(debts)
        .where(
          and(eq(debts.userId, userId), eq(debts.isPaidOff, 0)),
        )
        .limit(1);
    } catch {
      // Table may not exist yet
    }

    try {
      userSavings = await this.db
        .select()
        .from(savingsGoals)
        .where(eq(savingsGoals.userId, userId))
        .limit(1);
    } catch {
      // Table may not exist yet
    }

    // Get articles already read
    const readArticles = await this.db
      .select({ articleSlug: articleProgress.articleSlug })
      .from(articleProgress)
      .where(eq(articleProgress.userId, userId));

    const readSlugs = new Set(readArticles.map((r) => r.articleSlug));

    // Low credit score -> credit articles
    if (latestCreditScore && latestCreditScore.score < 670) {
      recommendations.push(
        ...articles.filter((a) => a.topic === 'credit' && !readSlugs.has(a.slug)),
      );
    }

    // Has debt -> debt management articles
    if (userDebts.length > 0) {
      recommendations.push(
        ...articles.filter((a) => a.topic === 'debt' && !readSlugs.has(a.slug)),
      );
    }

    // No or low savings -> saving articles
    if (userSavings.length === 0) {
      recommendations.push(
        ...articles.filter((a) => a.topic === 'saving' && !readSlugs.has(a.slug)),
      );
    }

    // No credit score at all -> credit basics
    if (!latestCreditScore) {
      recommendations.push(
        ...articles.filter(
          (a) =>
            a.topic === 'credit' &&
            a.difficulty === 'beginner' &&
            !readSlugs.has(a.slug),
        ),
      );
    }

    // Always include some budgeting basics for everyone
    if (recommendations.length < 3) {
      recommendations.push(
        ...articles.filter(
          (a) =>
            a.topic === 'budgeting' &&
            a.difficulty === 'beginner' &&
            !readSlugs.has(a.slug) &&
            !recommendations.some((r) => r.id === a.id),
        ),
      );
    }

    // If still not enough, add investing 101
    if (recommendations.length < 3) {
      recommendations.push(
        ...articles.filter(
          (a) =>
            a.topic === 'investing' &&
            a.difficulty === 'beginner' &&
            !readSlugs.has(a.slug) &&
            !recommendations.some((r) => r.id === a.id),
        ),
      );
    }

    // Deduplicate and limit
    const seen = new Set<string>();
    const unique = recommendations.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    return unique.slice(0, 8).map(({ content, ...rest }) => rest);
  }

  async trackProgress(userId: string, articleSlug: string) {
    // Verify article exists
    const article = articles.find((a) => a.slug === articleSlug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    // Check if already tracked
    const [existing] = await this.db
      .select()
      .from(articleProgress)
      .where(
        and(
          eq(articleProgress.userId, userId),
          eq(articleProgress.articleSlug, articleSlug),
        ),
      )
      .limit(1);

    if (existing) {
      // Update readAt timestamp
      const [updated] = await this.db
        .update(articleProgress)
        .set({ readAt: new Date().toISOString() })
        .where(eq(articleProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [progress] = await this.db
      .insert(articleProgress)
      .values({
        userId,
        articleSlug,
      })
      .returning();

    return progress;
  }

  async getProgress(userId: string) {
    const progress = await this.db
      .select()
      .from(articleProgress)
      .where(eq(articleProgress.userId, userId))
      .orderBy(desc(articleProgress.readAt));

    return {
      articlesRead: progress.filter((p) => p.readAt).length,
      totalArticles: articles.length,
      bookmarked: progress.filter((p) => p.isBookmarked).length,
      progress,
    };
  }

  async toggleBookmark(userId: string, articleSlug: string) {
    // Verify article exists
    const article = articles.find((a) => a.slug === articleSlug);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const [existing] = await this.db
      .select()
      .from(articleProgress)
      .where(
        and(
          eq(articleProgress.userId, userId),
          eq(articleProgress.articleSlug, articleSlug),
        ),
      )
      .limit(1);

    if (existing) {
      const newValue = existing.isBookmarked ? 0 : 1;
      const [updated] = await this.db
        .update(articleProgress)
        .set({ isBookmarked: newValue })
        .where(eq(articleProgress.id, existing.id))
        .returning();
      return updated;
    }

    // Create new entry with bookmark
    const [progress] = await this.db
      .insert(articleProgress)
      .values({
        userId,
        articleSlug,
        isBookmarked: 1,
      })
      .returning();

    return progress;
  }
}
