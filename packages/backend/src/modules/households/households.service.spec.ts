import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../../database/schema';
import { HouseholdsService } from './households.service';

function mockQuery(data: any) {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'where',
    'leftJoin',
    'innerJoin',
    'orderBy',
    'limit',
    'offset',
    'set',
    'values',
    'returning',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.then = (resolve: any, reject?: any) => Promise.resolve(data).then(resolve, reject);
  return chain;
}

const dialect = new PgDialect();

/** Bound parameters of the condition passed to `.where()`, so tests can see what a query filters on. */
function whereParams(query: any): unknown[] {
  return dialect.sqlToQuery(query.where.mock.calls[0][0]).params;
}

describe('HouseholdsService', () => {
  let service: HouseholdsService;
  let mockDb: any;

  const ownerId = 'user-owner';
  const editorId = 'user-editor';
  const viewerId = 'user-viewer';
  const householdId = 'hh-1';

  const household = {
    id: householdId,
    name: 'Home',
    ownerId,
    inviteCode: 'abcd1234',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const membership = (userId: string, role: string, id = `m-${userId}`) => ({
    id,
    householdId,
    userId,
    role,
    joinedAt: '2026-01-01T00:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new HouseholdsService(mockDb);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('creates the household with an 8-char invite code and adds the creator as owner', async () => {
      const householdInsert = mockQuery([household]);
      const memberInsert = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(householdInsert).mockReturnValueOnce(memberInsert);

      const result = await service.create(ownerId, 'Home');

      expect(result).toEqual(household);
      const householdValues = householdInsert.values.mock.calls[0][0];
      expect(householdValues.name).toBe('Home');
      expect(householdValues.ownerId).toBe(ownerId);
      expect(householdValues.inviteCode).toMatch(/^[0-9a-f]{8}$/);
      expect(memberInsert.values).toHaveBeenCalledWith({
        householdId,
        userId: ownerId,
        role: 'owner',
      });
    });
  });

  // ---------------------------------------------------------------------------
  // findUserHouseholds
  // ---------------------------------------------------------------------------
  describe('findUserHouseholds', () => {
    it('returns an empty list without querying households when the user has no memberships', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      const result = await service.findUserHouseholds(viewerId);

      expect(result).toEqual([]);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it("attaches the user's role in each household", async () => {
      const other = { ...household, id: 'hh-2', name: 'Cabin' };
      mockDb.select
        .mockReturnValueOnce(
          mockQuery([
            { householdId, role: 'owner' },
            { householdId: 'hh-2', role: 'viewer' },
          ]),
        )
        .mockReturnValueOnce(mockQuery([household, other]));

      const result = await service.findUserHouseholds(ownerId);

      expect(result).toEqual([
        { ...household, role: 'owner' },
        { ...other, role: 'viewer' },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns the household with its members for a member', async () => {
      const members = [
        { ...membership(ownerId, 'owner'), userName: 'Owner', userEmail: 'o@test.com' },
      ];
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer')]))
        .mockReturnValueOnce(mockQuery([household]))
        .mockReturnValueOnce(mockQuery(members));

      const result = await service.findOne(viewerId, householdId);

      expect(result).toEqual({ ...household, members });
    });

    it('throws ForbiddenException for a non-member before reading the household', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.findOne('stranger', householdId)).rejects.toThrow(ForbiddenException);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when the household row is missing', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(mockQuery([]));

      await expect(service.findOne(ownerId, householdId)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // owner-only operations
  // ---------------------------------------------------------------------------
  describe('owner-only operations', () => {
    const ownerOnly: [string, (s: HouseholdsService, userId: string) => Promise<unknown>][] = [
      ['updateName', (s, u) => s.updateName(u, householdId, 'New')],
      ['generateInviteCode', (s, u) => s.generateInviteCode(u, householdId)],
      ['updateMemberRole', (s, u) => s.updateMemberRole(u, householdId, 'm-x', 'editor')],
      ['removeMember', (s, u) => s.removeMember(u, householdId, 'm-x')],
      ['delete', (s, u) => s.delete(u, householdId)],
    ];

    for (const [name, call] of ownerOnly) {
      for (const role of ['editor', 'viewer']) {
        it(`${name} rejects a ${role} with ForbiddenException and writes nothing`, async () => {
          mockDb.select.mockReturnValueOnce(mockQuery([membership('someone', role)]));

          await expect(call(service, 'someone')).rejects.toThrow(
            'Only the owner can perform this action',
          );
          expect(mockDb.insert).not.toHaveBeenCalled();
          expect(mockDb.update).not.toHaveBeenCalled();
          expect(mockDb.delete).not.toHaveBeenCalled();
        });
      }

      it(`${name} rejects a non-member with ForbiddenException`, async () => {
        mockDb.select.mockReturnValueOnce(mockQuery([]));

        await expect(call(service, 'stranger')).rejects.toThrow('Not a member of this household');
        expect(mockDb.update).not.toHaveBeenCalled();
        expect(mockDb.delete).not.toHaveBeenCalled();
      });
    }
  });

  describe('updateName', () => {
    it('updates the name and bumps updatedAt for the owner', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]));
      const update = mockQuery([{ ...household, name: 'New' }]);
      mockDb.update.mockReturnValueOnce(update);

      const result = await service.updateName(ownerId, householdId, 'New');

      expect(result.name).toBe('New');
      const set = update.set.mock.calls[0][0];
      expect(set.name).toBe('New');
      expect(Number.isNaN(Date.parse(set.updatedAt))).toBe(false);
    });
  });

  describe('generateInviteCode', () => {
    it('rotates to a fresh 8-char code', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]));
      const update = mockQuery([household]);
      mockDb.update.mockReturnValueOnce(update);

      await service.generateInviteCode(ownerId, householdId);

      expect(update.set.mock.calls[0][0].inviteCode).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  // ---------------------------------------------------------------------------
  // joinByInviteCode
  // ---------------------------------------------------------------------------
  describe('joinByInviteCode', () => {
    it('adds the user as a viewer, never with an elevated role', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([household])).mockReturnValueOnce(mockQuery([]));
      const insert = mockQuery(undefined);
      mockDb.insert.mockReturnValueOnce(insert);

      const result = await service.joinByInviteCode(viewerId, 'abcd1234');

      expect(result).toEqual(household);
      expect(insert.values).toHaveBeenCalledWith({
        householdId,
        userId: viewerId,
        role: 'viewer',
      });
    });

    it('throws NotFoundException for an unknown invite code', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.joinByInviteCode(viewerId, 'nope')).rejects.toThrow(
        'Invalid invite code',
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user is already a member', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([household]))
        .mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer')]));

      await expect(service.joinByInviteCode(viewerId, 'abcd1234')).rejects.toThrow(
        ConflictException,
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // updateMemberRole
  // ---------------------------------------------------------------------------
  describe('updateMemberRole', () => {
    it("changes a non-owner member's role", async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer', 'm-v')]));
      const update = mockQuery([membership(viewerId, 'editor', 'm-v')]);
      mockDb.update.mockReturnValueOnce(update);

      const result = await service.updateMemberRole(ownerId, householdId, 'm-v', 'editor');

      expect(result.role).toBe('editor');
      expect(update.set).toHaveBeenCalledWith({ role: 'editor' });
    });

    it('refuses to change the owner role', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner', 'm-o')]));

      await expect(service.updateMemberRole(ownerId, householdId, 'm-o', 'viewer')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the member is not in this household', async () => {
      const memberLookup = mockQuery([]);
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(memberLookup);

      await expect(
        service.updateMemberRole(ownerId, householdId, 'm-elsewhere', 'editor'),
      ).rejects.toThrow('Member not found');
      expect(whereParams(memberLookup)).toEqual(
        expect.arrayContaining(['m-elsewhere', householdId]),
      );
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember
  // ---------------------------------------------------------------------------
  describe('removeMember', () => {
    it('deletes the member row', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer', 'm-v')]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.removeMember(ownerId, householdId, 'm-v');

      expect(mockDb.delete).toHaveBeenCalledWith(schema.householdMembers);
    });

    it('refuses to let the owner remove themselves', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner', 'm-o')]));

      await expect(service.removeMember(ownerId, householdId, 'm-o')).rejects.toThrow(
        'Cannot remove yourself as the owner',
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a member not in this household', async () => {
      const memberLookup = mockQuery([]);
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(memberLookup);

      await expect(service.removeMember(ownerId, householdId, 'm-missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(whereParams(memberLookup)).toEqual(expect.arrayContaining(['m-missing', householdId]));
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // shareAccount / unshareAccount
  // ---------------------------------------------------------------------------
  describe('shareAccount', () => {
    for (const [userId, role] of [
      [ownerId, 'owner'],
      [editorId, 'editor'],
    ] as const) {
      it(`lets the ${role} share their own account`, async () => {
        const shared = { id: 's-1', householdId, accountId: 'acct-1', sharedBy: userId };
        mockDb.select
          .mockReturnValueOnce(mockQuery([membership(userId, role)]))
          .mockReturnValueOnce(mockQuery([{ id: 'acct-1', userId }]))
          .mockReturnValueOnce(mockQuery([]));
        const insert = mockQuery([shared]);
        mockDb.insert.mockReturnValueOnce(insert);

        const result = await service.shareAccount(userId, householdId, 'acct-1');

        expect(result).toEqual(shared);
        expect(insert.values).toHaveBeenCalledWith({
          householdId,
          accountId: 'acct-1',
          sharedBy: userId,
        });
      });
    }

    it('rejects a viewer with ForbiddenException', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer')]));

      await expect(service.shareAccount(viewerId, householdId, 'acct-1')).rejects.toThrow(
        'Insufficient permissions',
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when sharing an account the user doesn't own", async () => {
      const accountLookup = mockQuery([]);
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(editorId, 'editor')]))
        .mockReturnValueOnce(accountLookup);

      await expect(
        service.shareAccount(editorId, householdId, 'someone-elses-acct'),
      ).rejects.toThrow('Account not found');
      expect(whereParams(accountLookup)).toEqual(
        expect.arrayContaining(['someone-elses-acct', editorId]),
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the account is already shared', async () => {
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]))
        .mockReturnValueOnce(mockQuery([{ id: 'acct-1', userId: ownerId }]))
        .mockReturnValueOnce(mockQuery([{ id: 's-1' }]));

      await expect(service.shareAccount(ownerId, householdId, 'acct-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('unshareAccount', () => {
    it('deletes the share for an editor', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([membership(editorId, 'editor')]));
      mockDb.delete.mockReturnValueOnce(mockQuery(undefined));

      await service.unshareAccount(editorId, householdId, 'acct-1');

      expect(mockDb.delete).toHaveBeenCalledWith(schema.sharedAccounts);
    });

    it('rejects a viewer and deletes nothing', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer')]));

      await expect(service.unshareAccount(viewerId, householdId, 'acct-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('getSharedAccounts', () => {
    it('returns the shared accounts for any member, including viewers', async () => {
      const rows = [
        {
          id: 's-1',
          accountId: 'acct-1',
          accountName: 'Joint Checking',
          accountType: 'checking',
          institutionName: 'Bank',
          currentBalance: 1200,
          sharedBy: ownerId,
          sharedByName: 'Owner',
          sharedAt: '2026-01-02T00:00:00.000Z',
        },
      ];
      mockDb.select
        .mockReturnValueOnce(mockQuery([membership(viewerId, 'viewer')]))
        .mockReturnValueOnce(mockQuery(rows));

      await expect(service.getSharedAccounts(viewerId, householdId)).resolves.toEqual(rows);
    });

    it('rejects a non-member', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.getSharedAccounts('stranger', householdId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // leave / delete
  // ---------------------------------------------------------------------------
  describe('leave', () => {
    it("removes the membership and the leaver's shared accounts", async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([household]));
      mockDb.delete.mockReturnValue(mockQuery(undefined));

      await service.leave(viewerId, householdId);

      expect(mockDb.delete.mock.calls.map((c: any[]) => c[0])).toEqual([
        schema.householdMembers,
        schema.sharedAccounts,
      ]);
    });

    it('refuses to let the owner leave', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([household]));

      await expect(service.leave(ownerId, householdId)).rejects.toThrow(BadRequestException);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown household', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([]));

      await expect(service.leave(viewerId, 'hh-missing')).rejects.toThrow('Household not found');
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes shared accounts, members, then the household', async () => {
      mockDb.select.mockReturnValueOnce(mockQuery([membership(ownerId, 'owner')]));
      mockDb.delete.mockReturnValue(mockQuery(undefined));

      await service.delete(ownerId, householdId);

      expect(mockDb.delete.mock.calls.map((c: any[]) => c[0])).toEqual([
        schema.sharedAccounts,
        schema.householdMembers,
        schema.households,
      ]);
    });
  });
});
