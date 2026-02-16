import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals, url }) => {
	const period = url.searchParams.get('period') || '1Y';

	try {
		const [holdings, summary, allocation, rebalance, performance] = await Promise.all([
			api('/investments/holdings', { accessToken: locals.accessToken }),
			api('/investments/summary', { accessToken: locals.accessToken }),
			api('/investments/allocation', { accessToken: locals.accessToken }),
			api('/investments/rebalance', { accessToken: locals.accessToken }),
			api(`/investments/performance?period=${period}`, {
				accessToken: locals.accessToken
			})
		]);

		return { holdings, summary, allocation, rebalance, performance, period };
	} catch {
		return {
			holdings: [],
			summary: {
				totalValue: 0,
				totalCostBasis: 0,
				totalGainLoss: 0,
				totalGainLossPercent: 0,
				holdingCount: 0
			},
			allocation: [],
			rebalance: [],
			performance: {
				totalReturn: 0,
				totalReturnPercent: 0,
				periodData: []
			},
			period
		};
	}
};

export const actions: Actions = {
	sync: async ({ locals }) => {
		try {
			await api('/investments/sync', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to trigger investment sync' });
		}
	}
};
