import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [
			dashboard,
			netWorth,
			netWorthHistory,
			monthlyTrend,
			budgetSummary,
			budgets,
			upcomingBills,
			savingsGoals,
			accounts,
			creditScore,
			widgetLayout,
			safeToSpend
		] = await Promise.all([
			api('/analytics/dashboard', { accessToken: locals.accessToken }),
			api('/accounts/net-worth', { accessToken: locals.accessToken }),
			api('/analytics/net-worth/history?days=90', { accessToken: locals.accessToken }),
			api('/analytics/spending/trend?months=6', { accessToken: locals.accessToken }),
			api('/budgets/summary', { accessToken: locals.accessToken }).catch(() => null),
			api('/budgets', { accessToken: locals.accessToken }).catch(() => []),
			api('/subscriptions/upcoming?days=30', { accessToken: locals.accessToken }).catch(
				() => []
			),
			api('/savings-goals', { accessToken: locals.accessToken }).catch(() => []),
			api('/accounts', { accessToken: locals.accessToken }).catch(() => []),
			api('/credit/score', { accessToken: locals.accessToken }).catch(() => null),
			api('/dashboard/layout', { accessToken: locals.accessToken }).catch(() => null),
			api('/analytics/safe-to-spend', { accessToken: locals.accessToken }).catch(() => null)
		]);

		return {
			dashboard,
			netWorth,
			netWorthHistory,
			monthlyTrend,
			budgetSummary,
			budgets,
			upcomingBills,
			savingsGoals,
			accounts,
			creditScore,
			widgetLayout,
			safeToSpend
		};
	} catch {
		return {
			dashboard: {
				currentMonthSpending: 0,
				lastMonthSpending: 0,
				spendingChange: 0,
				categoryBreakdown: [],
				topMerchants: [],
				recentTransactions: []
			},
			netWorth: { assets: 0, liabilities: 0, netWorth: 0, accountCount: 0 },
			netWorthHistory: [],
			monthlyTrend: [],
			budgetSummary: null,
			budgets: [],
			upcomingBills: [],
			savingsGoals: [],
			accounts: [],
			creditScore: null,
			widgetLayout: null,
			safeToSpend: null
		};
	}
};

export const actions: Actions = {
	saveLayout: async ({ request, locals }) => {
		const formData = await request.formData();
		const widgets = formData.get('widgets');

		if (!widgets || typeof widgets !== 'string') {
			return { success: false, error: 'Invalid layout data' };
		}

		try {
			await api('/dashboard/layout', {
				method: 'PUT',
				body: { widgets: JSON.parse(widgets) },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch {
			return { success: false, error: 'Failed to save layout' };
		}
	},

	resetLayout: async ({ locals }) => {
		try {
			const layout = await api('/dashboard/layout/reset', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true, layout };
		} catch {
			return { success: false, error: 'Failed to reset layout' };
		}
	}
};
