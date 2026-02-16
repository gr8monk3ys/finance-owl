import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { communityPosts, postLikes, postReplies } from './social.schema';

@Injectable()
export class SocialService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getPosts(category?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const query = this.db
      .select()
      .from(communityPosts)
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit)
      .offset(offset);

    if (category) {
      return query.where(eq(communityPosts.category, category));
    }

    return query;
  }

  async getPostById(id: string) {
    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, id))
      .limit(1);

    if (!post) throw new NotFoundException('Post not found');

    return post;
  }

  async createPost(
    userId: string,
    data: {
      title: string;
      content: string;
      category: string;
      isAnonymous?: boolean;
    },
  ) {
    const validCategories = ['tip', 'question', 'achievement', 'discussion'];
    if (!validCategories.includes(data.category)) {
      throw new BadRequestException(
        `Category must be one of: ${validCategories.join(', ')}`,
      );
    }

    const [post] = await this.db
      .insert(communityPosts)
      .values({
        userId,
        title: data.title,
        content: data.content,
        category: data.category,
        isAnonymous: data.isAnonymous ?? false,
      })
      .returning();

    return post;
  }

  async likePost(userId: string, postId: string) {
    await this.getPostById(postId);

    const [existingLike] = await this.db
      .select()
      .from(postLikes)
      .where(
        and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)),
      )
      .limit(1);

    if (existingLike) {
      throw new BadRequestException('You have already liked this post');
    }

    await this.db.insert(postLikes).values({ userId, postId });

    await this.db
      .update(communityPosts)
      .set({
        likesCount: sql`${communityPosts.likesCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId));

    return { liked: true };
  }

  async unlikePost(userId: string, postId: string) {
    const [existingLike] = await this.db
      .select()
      .from(postLikes)
      .where(
        and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)),
      )
      .limit(1);

    if (!existingLike) {
      throw new BadRequestException('You have not liked this post');
    }

    await this.db
      .delete(postLikes)
      .where(eq(postLikes.id, existingLike.id));

    await this.db
      .update(communityPosts)
      .set({
        likesCount: sql`MAX(${communityPosts.likesCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId));

    return { liked: false };
  }

  async addReply(userId: string, postId: string, content: string) {
    await this.getPostById(postId);

    const [reply] = await this.db
      .insert(postReplies)
      .values({ userId, postId, content })
      .returning();

    await this.db
      .update(communityPosts)
      .set({
        repliesCount: sql`${communityPosts.repliesCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId));

    return reply;
  }

  async getReplies(postId: string) {
    return this.db
      .select()
      .from(postReplies)
      .where(eq(postReplies.postId, postId))
      .orderBy(desc(postReplies.createdAt));
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.getPostById(postId);

    if (post.userId !== userId) {
      throw new BadRequestException('You can only delete your own posts');
    }

    await this.db
      .delete(communityPosts)
      .where(eq(communityPosts.id, postId));
  }
}
