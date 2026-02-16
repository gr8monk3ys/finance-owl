import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface FlagWithDetails {
  id: string;
  transactionId: string;
  transactionName: string | null;
  transactionAmount: number | null;
  transactionDate: string | null;
  flaggedBy: string;
  flaggedByName: string | null;
  reason: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

@Injectable()
export class FlaggingService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async flag(userId: string, transactionId: string, reason?: string) {
    // Verify transaction exists and user has access
    const [transaction] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, transactionId))
      .limit(1);

    if (!transaction) throw new NotFoundException('Transaction not found');

    // User can flag their own transactions or shared ones
    if (transaction.userId !== userId) {
      // Check if the transaction's account is shared in a household the user belongs to
      const hasAccess = await this.checkSharedAccess(userId, transaction.accountId);
      if (!hasAccess) {
        throw new ForbiddenException('No access to this transaction');
      }
    }

    const [flag] = await this.db
      .insert(schema.transactionFlags)
      .values({
        transactionId,
        flaggedBy: userId,
        reason,
      })
      .returning();

    return flag;
  }

  async resolve(userId: string, flagId: string) {
    const [flag] = await this.db
      .select()
      .from(schema.transactionFlags)
      .where(eq(schema.transactionFlags.id, flagId))
      .limit(1);

    if (!flag) throw new NotFoundException('Flag not found');

    // Get the transaction to verify access
    const [transaction] = await this.db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, flag.transactionId))
      .limit(1);

    if (transaction) {
      if (transaction.userId !== userId) {
        const hasAccess = await this.checkSharedAccess(
          userId,
          transaction.accountId,
        );
        if (!hasAccess) {
          throw new ForbiddenException('No access to resolve this flag');
        }
      }
    }

    const [updated] = await this.db
      .update(schema.transactionFlags)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(schema.transactionFlags.id, flagId))
      .returning();

    return updated;
  }

  async findByHousehold(
    userId: string,
    householdId: string,
    status?: 'open' | 'resolved',
  ): Promise<FlagWithDetails[]> {
    // Verify user is a member
    const [membership] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.householdId, householdId),
          eq(schema.householdMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('Not a member of this household');
    }

    // Get shared account IDs for this household
    const sharedAccountRows = await this.db
      .select({ accountId: schema.sharedAccounts.accountId })
      .from(schema.sharedAccounts)
      .where(eq(schema.sharedAccounts.householdId, householdId));

    const accountIds = sharedAccountRows.map((r) => r.accountId);
    if (accountIds.length === 0) return [];

    // Get transaction IDs for those accounts
    const transactionRows = await this.db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(inArray(schema.transactions.accountId, accountIds));

    const transactionIds = transactionRows.map((r) => r.id);
    if (transactionIds.length === 0) return [];

    // Build query for flags
    const flagsQuery = this.db
      .select({
        id: schema.transactionFlags.id,
        transactionId: schema.transactionFlags.transactionId,
        transactionName: schema.transactions.name,
        transactionAmount: schema.transactions.amount,
        transactionDate: schema.transactions.date,
        flaggedBy: schema.transactionFlags.flaggedBy,
        flaggedByName: schema.users.name,
        reason: schema.transactionFlags.reason,
        status: schema.transactionFlags.status,
        resolvedBy: schema.transactionFlags.resolvedBy,
        resolvedAt: schema.transactionFlags.resolvedAt,
        createdAt: schema.transactionFlags.createdAt,
      })
      .from(schema.transactionFlags)
      .leftJoin(
        schema.transactions,
        eq(schema.transactionFlags.transactionId, schema.transactions.id),
      )
      .leftJoin(
        schema.users,
        eq(schema.transactionFlags.flaggedBy, schema.users.id),
      )
      .where(
        status
          ? and(
              inArray(schema.transactionFlags.transactionId, transactionIds),
              eq(schema.transactionFlags.status, status),
            )
          : inArray(schema.transactionFlags.transactionId, transactionIds),
      );

    const flags = await flagsQuery;

    // Resolve "resolvedByName" for each flag
    const resolverIds = flags
      .filter((f) => f.resolvedBy)
      .map((f) => f.resolvedBy!);

    let resolverMap: Record<string, string> = {};
    if (resolverIds.length > 0) {
      const resolvers = await this.db
        .select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users)
        .where(inArray(schema.users.id, resolverIds));
      resolverMap = Object.fromEntries(resolvers.map((r) => [r.id, r.name]));
    }

    return flags.map((f) => ({
      ...f,
      resolvedByName: f.resolvedBy ? resolverMap[f.resolvedBy] ?? null : null,
    }));
  }

  async findByUser(userId: string): Promise<FlagWithDetails[]> {
    // Get flags on transactions owned by this user OR flagged by this user
    const flags = await this.db
      .select({
        id: schema.transactionFlags.id,
        transactionId: schema.transactionFlags.transactionId,
        transactionName: schema.transactions.name,
        transactionAmount: schema.transactions.amount,
        transactionDate: schema.transactions.date,
        flaggedBy: schema.transactionFlags.flaggedBy,
        flaggedByName: schema.users.name,
        reason: schema.transactionFlags.reason,
        status: schema.transactionFlags.status,
        resolvedBy: schema.transactionFlags.resolvedBy,
        resolvedAt: schema.transactionFlags.resolvedAt,
        createdAt: schema.transactionFlags.createdAt,
      })
      .from(schema.transactionFlags)
      .leftJoin(
        schema.transactions,
        eq(schema.transactionFlags.transactionId, schema.transactions.id),
      )
      .leftJoin(
        schema.users,
        eq(schema.transactionFlags.flaggedBy, schema.users.id),
      )
      .where(eq(schema.transactionFlags.flaggedBy, userId));

    return flags.map((f) => ({
      ...f,
      resolvedByName: null,
    }));
  }

  private async checkSharedAccess(
    userId: string,
    accountId: string,
  ): Promise<boolean> {
    // Get households user belongs to
    const memberships = await this.db
      .select({ householdId: schema.householdMembers.householdId })
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.userId, userId));

    if (memberships.length === 0) return false;

    const householdIds = memberships.map((m) => m.householdId);

    // Check if the account is shared in any of those households
    const [shared] = await this.db
      .select()
      .from(schema.sharedAccounts)
      .where(
        and(
          inArray(schema.sharedAccounts.householdId, householdIds),
          eq(schema.sharedAccounts.accountId, accountId),
        ),
      )
      .limit(1);

    return !!shared;
  }
}
