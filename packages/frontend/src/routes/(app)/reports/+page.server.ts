import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	const now = new Date();
	const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
	const endDate = now.toISOString().split('T')[0];

	const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
	const incomeStartDate = sixMonthsAgo.toISOString().split('T')[0];

	try {
		const [spending, incomeExpense, netWorth, trends] = await Promise.all([
			api(`/reports/spending?startDate=${startDate}&endDate=${endDate}&groupBy=category`, {
				accessToken: locals.accessToken
			}),
			api(
				`/reports/income-expense?startDate=${incomeStartDate}&endDate=${endDate}&groupBy=month`,
				{ accessToken: locals.accessToken }
			),
			api('/reports/net-worth', { accessToken: locals.accessToken }),
			api('/reports/trends?months=6', { accessToken: locals.accessToken })
		]);

		return { spending, incomeExpense, netWorth, trends };
	} catch {
		return {
			spending: [],
			incomeExpense: [],
			netWorth: {
				totalAssets: 0,
				totalLiabilities: 0,
				netWorth: 0,
				accounts: []
			},
			trends: []
		};
	}
};

export const actions: Actions = {
	export: async ({ request, locals }) => {
		const formData = await request.formData();
		const type = (formData.get('type') as string) || 'transactions';
		const startDate = formData.get('startDate') as string;
		const endDate = formData.get('endDate') as string;

		const params = new URLSearchParams({ type });
		if (startDate) params.set('startDate', startDate);
		if (endDate) params.set('endDate', endDate);

		try {
			const csv = await api(`/reports/export/csv?${params.toString()}`, {
				accessToken: locals.accessToken,
				rawText: true
			});

			return { csv, filename: `financeowl-${type}-${new Date().toISOString().split('T')[0]}.csv` };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to export CSV' });
		}
	}
};
