import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { referralCodes, referrals } from './referrals.schema';
import { users } from '../../database/schema/users';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

@Injectable()
export class ReferralsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async getOrCreateCode(userId: string) {
    const [existing] = await this.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, userId))
      .limit(1);

    if (existing) return existing;

    const [created] = await this.db
      .insert(referralCodes)
      .values({
        userId,
        code: generateCode(),
      })
      .returning();

    return created;
  }

  async getReferralStats(userId: string) {
    const [codeRecord] = await this.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, userId))
      .limit(1);

    if (!codeRecord) {
      return {
        totalReferrals: 0,
        totalEarnings: 0,
        pendingReferrals: 0,
        completedReferrals: 0,
        rewardedReferrals: 0,
      };
    }

    const allReferrals = await this.db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    const pendingReferrals = allReferrals.filter((r) => r.status === 'pending').length;
    const completedReferrals = allReferrals.filter((r) => r.status === 'completed').length;
    const rewardedReferrals = allReferrals.filter((r) => r.status === 'rewarded').length;

    return {
      totalReferrals: codeRecord.totalReferrals,
      totalEarnings: codeRecord.totalEarnings,
      pendingReferrals,
      completedReferrals,
      rewardedReferrals,
    };
  }

  async getReferrals(userId: string) {
    return this.db
      .select({
        id: referrals.id,
        referredUserId: referrals.referredUserId,
        status: referrals.status,
        rewardAmount: referrals.rewardAmount,
        completedAt: referrals.completedAt,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));
  }

  async applyReferralCode(userId: string, code: string) {
    const [codeRecord] = await this.db
      .select()
      .from(referralCodes)
      .where(and(eq(referralCodes.code, code.toUpperCase()), eq(referralCodes.isActive, true)))
      .limit(1);

    if (!codeRecord) throw new NotFoundException('Invalid or inactive referral code');
    if (codeRecord.userId === userId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    const [existingReferral] = await this.db
      .select()
      .from(referrals)
      .where(eq(referrals.referredUserId, userId))
      .limit(1);

    if (existingReferral) {
      throw new BadRequestException('You have already used a referral code');
    }

    const [referral] = await this.db
      .insert(referrals)
      .values({
        referrerId: codeRecord.userId,
        referredUserId: userId,
        referralCodeId: codeRecord.id,
        status: 'pending',
      })
      .returning();

    await this.db
      .update(referralCodes)
      .set({
        totalReferrals: codeRecord.totalReferrals + 1,
        updatedAt: new Date(),
      })
      .where(eq(referralCodes.id, codeRecord.id));

    return referral;
  }

  async completeReferral(referralId: string) {
    const [referral] = await this.db
      .select()
      .from(referrals)
      .where(eq(referrals.id, referralId))
      .limit(1);

    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status !== 'pending') {
      throw new BadRequestException('Referral is not in pending status');
    }

    const rewardAmount = 10.0;

    const [updated] = await this.db
      .update(referrals)
      .set({
        status: 'completed',
        rewardAmount,
        completedAt: new Date().toISOString(),
      })
      .where(eq(referrals.id, referralId))
      .returning();

    const [codeRecord] = await this.db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.id, referral.referralCodeId))
      .limit(1);

    if (codeRecord) {
      await this.db
        .update(referralCodes)
        .set({
          totalEarnings: codeRecord.totalEarnings + rewardAmount,
          updatedAt: new Date(),
        })
        .where(eq(referralCodes.id, codeRecord.id));
    }

    return updated;
  }

  async getLeaderboard() {
    return this.db
      .select({
        userId: referralCodes.userId,
        code: referralCodes.code,
        totalReferrals: referralCodes.totalReferrals,
        totalEarnings: referralCodes.totalEarnings,
      })
      .from(referralCodes)
      .where(eq(referralCodes.isActive, true))
      .orderBy(desc(referralCodes.totalReferrals))
      .limit(20);
  }
}
