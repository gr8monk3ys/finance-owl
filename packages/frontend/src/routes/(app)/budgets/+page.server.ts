import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [budgets, categories, summary] = await Promise.all([
			api('/budgets', { accessToken: locals.accessToken }),
			api('/categories', { accessToken: locals.accessToken }),
			api('/budgets/summary', { accessToken: locals.accessToken })
		]);

		return { budgets, categories, summary };
	} catch {
		return {
			budgets: [],
			categories: [],
			summary: {
				totalBudgeted: 0,
				totalSpent: 0,
				totalRemaining: 0,
				percentUsed: 0,
				budgetCount: 0,
				overBudgetCount: 0
			}
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			categoryId: formData.get('categoryId') as string,
			amount: parseFloat(formData.get('amount') as string),
			period: formData.get('period') as string,
			rollover: formData.get('rollover') === 'on'
		};

		if (!data.categoryId || !data.amount || !data.period) {
			return fail(400, { error: 'Category, amount, and period are required' });
		}

		try {
			await api('/budgets', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to create budget' });
		}
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data = {
			amount: parseFloat(formData.get('amount') as string),
			rollover: formData.get('rollover') === 'on'
		};

		try {
			await api(`/budgets/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to update budget' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/budgets/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to delete budget' });
		}
	}
};
