import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals, url }) => {
	const months = parseInt(url.searchParams.get('months') || '6', 10) || 6;

	try {
		const [forecast, cashFlow] = await Promise.all([
			api(`/forecasting/forecast?months=${months}`, { accessToken: locals.accessToken }),
			api('/forecasting/cash-flow', { accessToken: locals.accessToken })
		]);

		return { forecast, cashFlow, months };
	} catch {
		return {
			forecast: {
				currentBalance: 0,
				months: []
			},
			cashFlow: {
				monthlyRecurringIncome: 0,
				monthlyRecurringExpenses: 0,
				netMonthlyCashFlow: 0,
				incomeItems: [],
				expenseItems: []
			},
			months
		};
	}
};
