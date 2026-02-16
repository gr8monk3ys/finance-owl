import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals, url }) => {
	const period = url.searchParams.get('period') || '1Y';

	try {
		const [performance, holdings, summary] = await Promise.all([
			api(`/investments/performance?period=${period}`, {
				accessToken: locals.accessToken
			}),
			api('/investments/holdings', { accessToken: locals.accessToken }),
			api('/investments/summary', { accessToken: locals.accessToken })
		]);

		return { performance, holdings, summary, period };
	} catch {
		return {
			performance: {
				totalReturn: 0,
				totalReturnPercent: 0,
				periodData: []
			},
			holdings: [],
			summary: {
				totalValue: 0,
				totalCostBasis: 0,
				totalGainLoss: 0,
				totalGainLossPercent: 0,
				holdingCount: 0
			},
			period
		};
	}
};
