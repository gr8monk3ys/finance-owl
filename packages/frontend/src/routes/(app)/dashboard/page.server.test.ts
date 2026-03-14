import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

function createFormRequest(values: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(values)) {
		formData.set(key, value);
	}

	return {
		formData: async () => formData
	} as Request;
}

describe('dashboard page server', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('loads dashboard dependencies and preserves optional fallbacks', async () => {
		const mockApi = vi
			.spyOn(global, 'fetch')
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						currentMonthSpending: 1200,
						lastMonthSpending: 980,
						spendingChange: 22.4,
						categoryBreakdown: [],
						topMerchants: [],
						recentTransactions: []
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ assets: 5000, liabilities: 1200, netWorth: 3800, accountCount: 3 }),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
			.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }))
			.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }))
			.mockResolvedValueOnce(new Response('no summary', { status: 500 }))
			.mockResolvedValueOnce(new Response('no budgets', { status: 500 }))
			.mockResolvedValueOnce(new Response('no bills', { status: 500 }))
			.mockResolvedValueOnce(new Response('no goals', { status: 500 }))
			.mockResolvedValueOnce(new Response('no accounts', { status: 500 }))
			.mockResolvedValueOnce(new Response('no credit', { status: 500 }))
			.mockResolvedValueOnce(new Response('no layout', { status: 500 }))
			.mockResolvedValueOnce(new Response('no safe-to-spend', { status: 500 }));

		const data = (await load({
			locals: { accessToken: 'access-token' }
		} as never)) as any;

		expect(data.dashboard.currentMonthSpending).toBe(1200);
		expect(data.netWorth.netWorth).toBe(3800);
		expect(data.budgetSummary).toBeNull();
		expect(data.budgets).toEqual([]);
		expect(data.widgetLayout).toBeNull();
		expect(mockApi).toHaveBeenCalledTimes(20);
	});

	it('returns the empty dashboard shell when core requests fail', async () => {
		global.fetch = vi.fn().mockRejectedValue(new Error('dashboard offline')) as typeof fetch;

		const data = (await load({
			locals: { accessToken: 'access-token' }
		} as never)) as any;

		expect(data.dashboard.recentTransactions).toEqual([]);
		expect(data.netWorth).toEqual({ assets: 0, liabilities: 0, netWorth: 0, accountCount: 0 });
		expect(data.budgets).toEqual([]);
		expect(data.safeToSpend).toBeNull();
	});

	it('rejects invalid layout payloads before calling the API', async () => {
		const result = await actions.saveLayout({
			request: createFormRequest({ widgets: '' }),
			locals: { accessToken: 'access-token' }
		} as never);

		expect(result).toEqual({ success: false, error: 'Invalid layout data' });
	});

	it('saves and resets widget layouts through the API', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ widgets: [{ id: 'net-worth', visible: true }] }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			) as typeof fetch;

		const saveResult = await actions.saveLayout({
			request: createFormRequest({ widgets: JSON.stringify([{ id: 'net-worth', visible: true }]) }),
			locals: { accessToken: 'access-token' }
		} as never);

		const resetResult = await actions.resetLayout({
			locals: { accessToken: 'access-token' }
		} as never);

		expect(saveResult).toEqual({ success: true });
		expect(resetResult).toEqual({
			success: true,
			layout: { widgets: [{ id: 'net-worth', visible: true }] }
		});
	});
});
