import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

function createFormRequest(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return {
    formData: async () => formData,
  } as Request;
}

describe('budgets page server', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads budgets, categories, and summary data', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'budget_1' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'category_1' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            totalBudgeted: 1000,
            totalSpent: 600,
            totalRemaining: 400,
            percentUsed: 60,
            budgetCount: 1,
            overBudgetCount: 0,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ) as typeof fetch;

    const data = (await load({
      locals: { accessToken: 'access-token' },
    } as never)) as any;

    expect(data.budgets).toEqual([{ id: 'budget_1' }]);
    expect(data.categories).toEqual([{ id: 'category_1' }]);
    expect(data.summary.totalBudgeted).toBe(1000);
  });

  it('returns the empty budget state when API requests fail', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'budgets offline' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const data = (await load({
      locals: { accessToken: 'access-token' },
    } as never)) as any;

    expect(data.budgets).toEqual([]);
    expect(data.categories).toEqual([]);
    expect(data.summary).toEqual({
      totalBudgeted: 0,
      totalSpent: 0,
      totalRemaining: 0,
      percentUsed: 0,
      budgetCount: 0,
      overBudgetCount: 0,
    });
  });

  it('rejects incomplete budget creation requests', async () => {
    const result = await actions.create({
      request: createFormRequest({ categoryId: '', amount: '', period: '' }),
      locals: { accessToken: 'access-token' },
    } as never);

    expect(result).toMatchObject({
      status: 400,
      data: { error: 'Category, amount, and period are required' },
    });
  });

  it('creates, updates, and deletes budgets', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ) as typeof fetch;

    const createResult = await actions.create({
      request: createFormRequest({
        categoryId: 'groceries',
        amount: '150',
        period: 'monthly',
        rollover: 'on',
      }),
      locals: { accessToken: 'access-token' },
    } as never);
    const updateResult = await actions.update({
      request: createFormRequest({ id: 'budget_1', amount: '225', rollover: 'on' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const deleteResult = await actions.delete({
      request: createFormRequest({ id: 'budget_1' }),
      locals: { accessToken: 'access-token' },
    } as never);

    expect(createResult).toEqual({ success: true });
    expect(updateResult).toEqual({ success: true });
    expect(deleteResult).toEqual({ success: true });
  });
});
