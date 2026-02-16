import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { DATABASE_TOKEN, type DrizzleDB } from '../../database/database.module';
import * as schema from '../../database/schema';

export interface HouseholdWithMembers {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
  members: {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    userName: string | null;
    userEmail: string | null;
  }[];
}

export interface SharedAccountInfo {
  id: string;
  accountId: string;
  accountName: string | null;
  accountType: string | null;
  institutionName: string | null;
  currentBalance: number | null;
  sharedBy: string;
  sharedByName: string | null;
  sharedAt: string;
}

@Injectable()
export class HouseholdsService {
  constructor(@Inject(DATABASE_TOKEN) private db: DrizzleDB) {}

  async create(userId: string, name: string) {
    const inviteCode = crypto.randomUUID().slice(0, 8);

    const [household] = await this.db
      .insert(schema.households)
      .values({
        name,
        ownerId: userId,
        inviteCode,
      })
      .returning();

    // Add the owner as a member with 'owner' role
    await this.db.insert(schema.householdMembers).values({
      householdId: household.id,
      userId,
      role: 'owner',
    });

    return household;
  }

  async findUserHouseholds(userId: string) {
    const memberships = await this.db
      .select({
        householdId: schema.householdMembers.householdId,
        role: schema.householdMembers.role,
      })
      .from(schema.householdMembers)
      .where(eq(schema.householdMembers.userId, userId));

    if (memberships.length === 0) return [];

    const householdIds = memberships.map((m) => m.householdId);

    const households = await this.db
      .select()
      .from(schema.households)
      .where(inArray(schema.households.id, householdIds));

    return households.map((h) => ({
      ...h,
      role: memberships.find((m) => m.householdId === h.id)?.role,
    }));
  }

  async findOne(userId: string, householdId: string): Promise<HouseholdWithMembers> {
    await this.assertMember(userId, householdId);

    const [household] = await this.db
      .select()
      .from(schema.households)
      .where(eq(schema.households.id, householdId))
      .limit(1);

    if (!household) throw new NotFoundException('Household not found');

    const members = await this.db
      .select({
        id: schema.householdMembers.id,
        userId: schema.householdMembers.userId,
        role: schema.householdMembers.role,
        joinedAt: schema.householdMembers.joinedAt,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.householdMembers)
      .leftJoin(
        schema.users,
        eq(schema.householdMembers.userId, schema.users.id),
      )
      .where(eq(schema.householdMembers.householdId, householdId));

    return { ...household, members };
  }

  async updateName(userId: string, householdId: string, name: string) {
    await this.assertOwner(userId, householdId);

    const [updated] = await this.db
      .update(schema.households)
      .set({ name, updatedAt: new Date().toISOString() })
      .where(eq(schema.households.id, householdId))
      .returning();

    return updated;
  }

  async generateInviteCode(userId: string, householdId: string) {
    await this.assertOwner(userId, householdId);

    const inviteCode = crypto.randomUUID().slice(0, 8);

    const [updated] = await this.db
      .update(schema.households)
      .set({ inviteCode, updatedAt: new Date().toISOString() })
      .where(eq(schema.households.id, householdId))
      .returning();

    return updated;
  }

  async joinByInviteCode(userId: string, inviteCode: string) {
    const [household] = await this.db
      .select()
      .from(schema.households)
      .where(eq(schema.households.inviteCode, inviteCode))
      .limit(1);

    if (!household) throw new NotFoundException('Invalid invite code');

    // Check if already a member
    const [existing] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.householdId, household.id),
          eq(schema.householdMembers.userId, userId),
        ),
      )
      .limit(1);

    if (existing) throw new ConflictException('Already a member of this household');

    await this.db.insert(schema.householdMembers).values({
      householdId: household.id,
      userId,
      role: 'viewer',
    });

    return household;
  }

  async updateMemberRole(
    userId: string,
    householdId: string,
    memberId: string,
    role: 'owner' | 'editor' | 'viewer',
  ) {
    await this.assertOwner(userId, householdId);

    const [member] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.id, memberId),
          eq(schema.householdMembers.householdId, householdId),
        ),
      )
      .limit(1);

    if (!member) throw new NotFoundException('Member not found');

    // Can't change the owner's role
    if (member.role === 'owner') {
      throw new BadRequestException('Cannot change the owner role');
    }

    const [updated] = await this.db
      .update(schema.householdMembers)
      .set({ role })
      .where(eq(schema.householdMembers.id, memberId))
      .returning();

    return updated;
  }

  async removeMember(userId: string, householdId: string, memberId: string) {
    await this.assertOwner(userId, householdId);

    const [member] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.id, memberId),
          eq(schema.householdMembers.householdId, householdId),
        ),
      )
      .limit(1);

    if (!member) throw new NotFoundException('Member not found');

    if (member.userId === userId) {
      throw new BadRequestException('Cannot remove yourself as the owner');
    }

    await this.db
      .delete(schema.householdMembers)
      .where(eq(schema.householdMembers.id, memberId));
  }

  async shareAccount(userId: string, householdId: string, accountId: string) {
    await this.assertMemberWithRole(userId, householdId, ['owner', 'editor']);

    // Verify the account belongs to the user
    const [account] = await this.db
      .select()
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.id, accountId),
          eq(schema.accounts.userId, userId),
        ),
      )
      .limit(1);

    if (!account) throw new NotFoundException('Account not found');

    // Check if already shared
    const [existing] = await this.db
      .select()
      .from(schema.sharedAccounts)
      .where(
        and(
          eq(schema.sharedAccounts.householdId, householdId),
          eq(schema.sharedAccounts.accountId, accountId),
        ),
      )
      .limit(1);

    if (existing) throw new ConflictException('Account already shared');

    const [shared] = await this.db
      .insert(schema.sharedAccounts)
      .values({
        householdId,
        accountId,
        sharedBy: userId,
      })
      .returning();

    return shared;
  }

  async unshareAccount(userId: string, householdId: string, accountId: string) {
    await this.assertMemberWithRole(userId, householdId, ['owner', 'editor']);

    await this.db
      .delete(schema.sharedAccounts)
      .where(
        and(
          eq(schema.sharedAccounts.householdId, householdId),
          eq(schema.sharedAccounts.accountId, accountId),
        ),
      );
  }

  async getSharedAccounts(
    userId: string,
    householdId: string,
  ): Promise<SharedAccountInfo[]> {
    await this.assertMember(userId, householdId);

    const shared = await this.db
      .select({
        id: schema.sharedAccounts.id,
        accountId: schema.sharedAccounts.accountId,
        accountName: schema.accounts.name,
        accountType: schema.accounts.type,
        institutionName: schema.accounts.institutionName,
        currentBalance: schema.accounts.currentBalance,
        sharedBy: schema.sharedAccounts.sharedBy,
        sharedByName: schema.users.name,
        sharedAt: schema.sharedAccounts.sharedAt,
      })
      .from(schema.sharedAccounts)
      .leftJoin(
        schema.accounts,
        eq(schema.sharedAccounts.accountId, schema.accounts.id),
      )
      .leftJoin(
        schema.users,
        eq(schema.sharedAccounts.sharedBy, schema.users.id),
      )
      .where(eq(schema.sharedAccounts.householdId, householdId));

    return shared;
  }

  async leave(userId: string, householdId: string) {
    const [household] = await this.db
      .select()
      .from(schema.households)
      .where(eq(schema.households.id, householdId))
      .limit(1);

    if (!household) throw new NotFoundException('Household not found');

    if (household.ownerId === userId) {
      throw new BadRequestException(
        'Owner cannot leave. Transfer ownership or delete the household.',
      );
    }

    await this.db
      .delete(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.householdId, householdId),
          eq(schema.householdMembers.userId, userId),
        ),
      );

    // Also remove any shared accounts by this user
    await this.db
      .delete(schema.sharedAccounts)
      .where(
        and(
          eq(schema.sharedAccounts.householdId, householdId),
          eq(schema.sharedAccounts.sharedBy, userId),
        ),
      );
  }

  async delete(userId: string, householdId: string) {
    await this.assertOwner(userId, householdId);

    // Delete shared accounts first
    await this.db
      .delete(schema.sharedAccounts)
      .where(eq(schema.sharedAccounts.householdId, householdId));

    // Delete members
    await this.db
      .delete(schema.householdMembers)
      .where(eq(schema.householdMembers.householdId, householdId));

    // Delete the household
    await this.db
      .delete(schema.households)
      .where(eq(schema.households.id, householdId));
  }

  // -- Helpers --

  private async assertMember(userId: string, householdId: string) {
    const [member] = await this.db
      .select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.householdId, householdId),
          eq(schema.householdMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!member) throw new ForbiddenException('Not a member of this household');
    return member;
  }

  private async assertOwner(userId: string, householdId: string) {
    const member = await this.assertMember(userId, householdId);
    if (member.role !== 'owner') {
      throw new ForbiddenException('Only the owner can perform this action');
    }
    return member;
  }

  private async assertMemberWithRole(
    userId: string,
    householdId: string,
    roles: string[],
  ) {
    const member = await this.assertMember(userId, householdId);
    if (!roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return member;
  }
}
