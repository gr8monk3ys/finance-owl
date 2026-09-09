import { describe, it, expect, vi } from 'vitest';
import { CancellationService } from './cancellation.service';
import type { DrizzleDB } from '../../database/database.module';

interface StatsRow {
  status: string;
  subscriptionName: string | null;
  merchantName: string | null;
  estimatedAmount: number | null;
  frequency: string | null;
  cancelledAt: string | null;
}

/** `getCancellationStats` runs one query, so the mock resolves one chain. */
function serviceReturning(rows: StatsRow[]): CancellationService {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => Promise.resolve(rows),
  };
  return new CancellationService({ select: () => chain } as unknown as DrizzleDB);
}

const completed = (merchantName: string, estimatedAmount: number, frequency: string): StatsRow => ({
  status: 'completed',
  subscriptionName: merchantName,
  merchantName,
  estimatedAmount,
  frequency,
  cancelledAt: '2026-02-01T00:00:00.000Z',
});

const pending = (): StatsRow => ({
  status: 'pending',
  subscriptionName: 'Hulu',
  merchantName: 'Hulu',
  estimatedAmount: 17.99,
  frequency: 'monthly',
  cancelledAt: null,
});

describe('CancellationService.getCancellationStats', () => {
  it('counts requests by state', async () => {
    const stats = await serviceReturning([
      completed('Netflix', 15.99, 'monthly'),
      pending(),
      { ...pending(), status: 'in_progress' },
      { ...pending(), status: 'failed' },
    ]).getCancellationStats('user_1');

    expect(stats.totalRequested).toBe(4);
    expect(stats.totalCompleted).toBe(1);
    expect(stats.totalPending).toBe(2);
  });

  it('projects savings from the cadence, not a flat monthly assumption', async () => {
    // A semiannual bill used to be counted as twelve charges a year by the
    // `?? 12` fallback in the old stats endpoint.
    const stats = await serviceReturning([
      completed('Auto Insurance', 600, 'semiannual'),
    ]).getCancellationStats('user_1');

    expect(stats.estimatedMonthlySavings).toBe(100);
    expect(stats.estimatedAnnualSavings).toBe(1200);
  });

  it('reports weekly savings at 52 charges a year, matching every other endpoint', async () => {
    // The savings endpoint used weekly = 4.33/month (51.96/yr) while the stats
    // endpoint used 52/yr, so the same user saw two different numbers.
    const stats = await serviceReturning([
      completed('Meal Kit', 10, 'weekly'),
    ]).getCancellationStats('user_1');

    expect(stats.estimatedAnnualSavings).toBe(520);
    expect(stats.estimatedAnnualSavings).toBeCloseTo(stats.estimatedMonthlySavings * 12, 1);
  });

  it('lists the cancelled subscriptions behind the savings figure', async () => {
    const stats = await serviceReturning([
      completed('Netflix', 15.99, 'monthly'),
      pending(),
    ]).getCancellationStats('user_1');

    expect(stats.cancelledSubscriptions).toEqual([
      {
        name: 'Netflix',
        amount: 15.99,
        frequency: 'monthly',
        cancelledAt: '2026-02-01T00:00:00.000Z',
      },
    ]);
  });

  it('counts a completed request with no linked subscription without crediting savings', async () => {
    const stats = await serviceReturning([
      {
        status: 'completed',
        subscriptionName: null,
        merchantName: null,
        estimatedAmount: null,
        frequency: null,
        cancelledAt: null,
      },
    ]).getCancellationStats('user_1');

    expect(stats.totalCompleted).toBe(1);
    expect(stats.estimatedMonthlySavings).toBe(0);
    expect(stats.cancelledSubscriptions).toEqual([]);
  });

  it('reports zeroes for a user who has never cancelled anything', async () => {
    const stats = await serviceReturning([]).getCancellationStats('user_1');

    expect(stats).toEqual({
      totalRequested: 0,
      totalPending: 0,
      totalCompleted: 0,
      estimatedMonthlySavings: 0,
      estimatedAnnualSavings: 0,
      cancelledSubscriptions: [],
    });
  });
});

describe('CancellationService.requestCancellation', () => {
  function serviceForSubscription(subscription: Record<string, unknown> | undefined) {
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: 'req_1' }]) });
    const selectChain = {
      from: () => selectChain,
      where: () => selectChain,
      limit: () => Promise.resolve(subscription ? [subscription] : []),
    };
    const db = {
      select: () => selectChain,
      insert: () => ({ values }),
    } as unknown as DrizzleDB;

    return { service: new CancellationService(db), values };
  }

  it('persists the real catalog playbook for a known provider', async () => {
    // The write path used to read a 12-entry table that had never heard of
    // Peloton, so it stored generic boilerplate over the real instructions.
    const { service, values } = serviceForSubscription({
      id: 'sub_1',
      name: 'Peloton Membership',
      merchantName: 'Peloton',
    });

    const result = await service.requestCancellation('user_1', 'sub_1', 'too expensive');

    const persisted = values.mock.calls[0][0];
    expect(persisted.method).toBe('self_service');
    expect(persisted.reason).toBe('too expensive');
    expect(JSON.parse(persisted.cancellationInstructions).join(' ').toLowerCase()).toContain(
      'peloton',
    );
    expect(JSON.parse(persisted.providerContactInfo)).toMatchObject({
      website: expect.stringContaining('onepeloton.com'),
    });
    expect(result.cancellationInstructions).toEqual(JSON.parse(persisted.cancellationInstructions));
  });

  it('falls back to generic advice for an unknown merchant', async () => {
    const { service, values } = serviceForSubscription({
      id: 'sub_2',
      name: 'Corner Bodega 44',
      merchantName: null,
    });

    await service.requestCancellation('user_1', 'sub_2');

    const persisted = values.mock.calls[0][0];
    expect(persisted.method).toBe('self_service');
    expect(JSON.parse(persisted.cancellationInstructions)[0]).toContain('Corner Bodega 44');
    expect(JSON.parse(persisted.providerContactInfo)).toEqual({
      phone: null,
      email: null,
      website: null,
      chatUrl: null,
    });
  });

  it('refuses a subscription the user does not own', async () => {
    const { service } = serviceForSubscription(undefined);

    await expect(service.requestCancellation('user_1', 'sub_x')).rejects.toThrow(
      'Subscription not found',
    );
  });
});
