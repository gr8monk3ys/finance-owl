import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import * as schema from '../../database/schema';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DATABASE_TOKEN) private db: DrizzleDB,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Invalidate net-worth and analytics caches after account changes.
   */
  private async invalidateAccountCaches(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.delPattern(`accounts:${userId}:*`),
      this.cacheService.delPattern(`analytics:${userId}:*`),
      this.cacheService.delPattern(`financial-health:${userId}:*`),
    ]);
  }

  async findAll(userId: string) {
    return this.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .orderBy(schema.accounts.institutionName, schema.accounts.name);
  }

  async findById(userId: string, accountId: string) {
    const [account] = await this.db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.userId, userId)))
      .limit(1);

    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async createManual(
    userId: string,
    data: {
      name: string;
      type: string;
      institutionName?: string;
      balance?: number;
      currency?: string;
    },
  ) {
    const [account] = await this.db
      .insert(schema.accounts)
      .values({
        userId,
        name: data.name,
        type: data.type,
        institutionName: data.institutionName ?? null,
        currentBalance: data.balance ?? 0,
        currency: data.currency ?? 'USD',
        isManual: true,
      })
      .returning();

    await this.invalidateAccountCaches(userId);
    return account;
  }

  async update(
    userId: string,
    accountId: string,
    data: {
      name?: string;
      type?: string;
      institutionName?: string;
      currentBalance?: number;
      isHidden?: boolean;
    },
  ) {
    // Verify ownership
    await this.findById(userId, accountId);

    const [updated] = await this.db
      .update(schema.accounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.userId, userId)))
      .returning();

    await this.invalidateAccountCaches(userId);
    return updated;
  }

  async remove(userId: string, accountId: string) {
    const account = await this.findById(userId, accountId);

    if (!account.isManual) {
      throw new Error('Cannot delete a linked account. Unlink the institution instead.');
    }

    await this.db
      .delete(schema.accounts)
      .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.userId, userId)));

    await this.invalidateAccountCaches(userId);
  }

  async getNetWorth(userId: string) {
    const cacheKey = `accounts:${userId}:net-worth`;
    return this.cacheService.wrap(cacheKey, 300, () => this._getNetWorth(userId));
  }

  private async _getNetWorth(userId: string) {
    const accounts = await this.findAll(userId);

    let assets = 0;
    let liabilities = 0;

    for (const acct of accounts) {
      if (acct.isHidden) continue;
      const balance = this.toNumber(acct.currentBalance);

      if (['credit_card', 'loan', 'mortgage'].includes(acct.type)) {
        liabilities += Math.abs(balance);
      } else {
        assets += balance;
      }
    }

    return {
      assets,
      liabilities,
      netWorth: assets - liabilities,
      accountCount: accounts.filter((a) => !a.isHidden).length,
    };
  }

  private toNumber(value: number | string | null | undefined): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return 0;
  }
}
