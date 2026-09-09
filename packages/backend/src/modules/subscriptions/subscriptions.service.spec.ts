import { describe, it, expect } from 'vitest';
import { SubscriptionsService } from './subscriptions.service';
import type { DrizzleDB } from '../../database/database.module';

interface SummaryRow {
  estimatedAmount: number;
  frequency: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
}

/**
 * `getSummary` issues exactly one query and then does arithmetic, so the mock
 * only has to resolve that one chain -- no call ordering to encode.
 */
function serviceReturning(rows: SummaryRow[]): SubscriptionsService {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => Promise.resolve(rows),
  };
  return new SubscriptionsService({ select: () => chain } as unknown as DrizzleDB);
}

const row = (frequency: string, estimatedAmount: number): SummaryRow => ({
  estimatedAmount,
  frequency,
  categoryId: null,
  categoryName: null,
  categoryColor: null,
});

describe('SubscriptionsService.getSummary', () => {
  it('prorates every cadence onto a monthly figure', async () => {
    const summary = await serviceReturning([
      row('weekly', 12),
      row('biweekly', 20),
      row('monthly', 15),
      row('quarterly', 30),
      row('annual', 120),
    ]).getSummary('user_1');

    // 52 and 26 charges a year, not the 4.33/2.17 approximations that used to
    // make annualTotal disagree with 12x monthlyTotal.
    const expected = (12 * 52 + 20 * 26 + 15 * 12 + 30 * 4 + 120) / 12;
    expect(summary.monthlyTotal).toBeCloseTo(Math.round(expected * 100) / 100, 2);
    expect(summary.activeCount).toBe(5);
  });

  it('costs a semiannual bill at two charges a year, not twelve', async () => {
    // Detection has always been able to emit `semiannual`; /summary used to hit
    // a `?? 1` fallback and bill it as full monthly spend.
    const summary = await serviceReturning([row('semiannual', 600)]).getSummary('user_1');

    expect(summary.monthlyTotal).toBe(100);
    expect(summary.annualTotal).toBe(1200);
  });

  it('costs a bimonthly bill at six charges a year', async () => {
    const summary = await serviceReturning([row('bimonthly', 90)]).getSummary('user_1');

    expect(summary.monthlyTotal).toBe(45);
    expect(summary.annualTotal).toBe(540);
  });

  it('keeps the annual total at exactly twelve times the monthly total', async () => {
    const summary = await serviceReturning([
      row('weekly', 9.99),
      row('semiannual', 249),
      row('annual', 79),
    ]).getSummary('user_1');

    expect(summary.annualTotal).toBeCloseTo(summary.monthlyTotal * 12, 1);
  });

  it('groups spend by category, largest first', async () => {
    const summary = await serviceReturning([
      { ...row('monthly', 10), categoryId: 'cat_a', categoryName: 'Streaming' },
      { ...row('monthly', 50), categoryId: 'cat_b', categoryName: 'Fitness' },
      { ...row('annual', 120), categoryId: 'cat_a', categoryName: 'Streaming' },
    ]).getSummary('user_1');

    expect(summary.byCategory).toHaveLength(2);
    expect(summary.byCategory[0]).toMatchObject({ categoryId: 'cat_b', total: 50, count: 1 });
    expect(summary.byCategory[1]).toMatchObject({ categoryId: 'cat_a', total: 20, count: 2 });
  });

  it('reports zeroes for a user with no active subscriptions', async () => {
    const summary = await serviceReturning([]).getSummary('user_1');

    expect(summary).toEqual({
      monthlyTotal: 0,
      annualTotal: 0,
      activeCount: 0,
      byCategory: [],
    });
  });
});
