import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals, url }) => {
	const years = url.searchParams.get('years') || '30';

	try {
		const [fees, impact10, impact20, impact30, alternatives, summary] = await Promise.all([
			api('/investments/fees', { accessToken: locals.accessToken }),
			api('/investments/fees/impact?years=10', { accessToken: locals.accessToken }),
			api('/investments/fees/impact?years=20', { accessToken: locals.accessToken }),
			api(`/investments/fees/impact?years=${years}`, { accessToken: locals.accessToken }),
			api('/investments/fees/alternatives', { accessToken: locals.accessToken }),
			api('/investments/fees/summary', { accessToken: locals.accessToken })
		]);

		return { fees, impact10, impact20, impact30, alternatives, summary, years };
	} catch {
		return {
			fees: {
				totalAnnualFees: 0,
				weightedExpenseRatio: 0,
				holdings: [],
				feesByCategory: []
			},
			impact10: {
				currentPortfolioValue: 0,
				projectedWithCurrentFees: 0,
				projectedWithLowCostFees: 0,
				lifetimeSavings: 0,
				years: 10
			},
			impact20: {
				currentPortfolioValue: 0,
				projectedWithCurrentFees: 0,
				projectedWithLowCostFees: 0,
				lifetimeSavings: 0,
				years: 20
			},
			impact30: {
				currentPortfolioValue: 0,
				projectedWithCurrentFees: 0,
				projectedWithLowCostFees: 0,
				lifetimeSavings: 0,
				years: 30
			},
			alternatives: [],
			summary: {
				totalPortfolioValue: 0,
				totalAnnualFees: 0,
				weightedExpenseRatio: 0,
				feeScore: 'C' as const,
				feeScoreDescription: 'No data available.',
				holdingCount: 0,
				highFeeCount: 0
			},
			years
		};
	}
};
