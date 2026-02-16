import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [suggestions, patterns, insights, predictions] = await Promise.all([
			api('/budgets/suggestions', { accessToken: locals.accessToken }),
			api('/budgets/seasonal-patterns', { accessToken: locals.accessToken }),
			api('/budgets/insights', { accessToken: locals.accessToken }),
			api('/budgets/predictions', { accessToken: locals.accessToken })
		]);

		return {
			suggestions: suggestions ?? [],
			patterns: patterns ?? [],
			insights: insights ?? [],
			predictions: predictions ?? []
		};
	} catch {
		return {
			suggestions: [],
			patterns: [],
			insights: [],
			predictions: []
		};
	}
};

export const actions: Actions = {
	'auto-adjust': async ({ request, locals }) => {
		const formData = await request.formData();
		const sensitivity = formData.get('sensitivity') as string;

		if (!sensitivity || !['conservative', 'moderate', 'aggressive'].includes(sensitivity)) {
			return fail(400, { error: 'Invalid sensitivity level' });
		}

		try {
			const results = await api('/budgets/auto-adjust', {
				method: 'POST',
				body: { sensitivity },
				accessToken: locals.accessToken
			});
			return { success: true, adjustments: results };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to auto-adjust budgets' });
		}
	},

	'accept-suggestion': async ({ request, locals }) => {
		const formData = await request.formData();
		const categoryId = formData.get('categoryId') as string;
		const amount = parseFloat(formData.get('amount') as string);

		if (!categoryId || !amount) {
			return fail(400, { error: 'Category and amount are required' });
		}

		try {
			await api('/budgets', {
				method: 'POST',
				body: { categoryId, amount, period: 'monthly' },
				accessToken: locals.accessToken
			});
			return { success: true, accepted: categoryId };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to create budget' });
		}
	}
};
