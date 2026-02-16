import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const dashboard = await api('/smart-savings/dashboard', {
			accessToken: locals.accessToken
		});

		return { dashboard };
	} catch {
		return {
			dashboard: {
				analysis: null,
				rules: [],
				projected: {
					monthlyEstimate: 0,
					activeRuleCount: 0,
					projection: []
				},
				history: {
					transfers: [],
					totalSaved: 0
				}
			}
		};
	}
};

export const actions: Actions = {
	analyze: async ({ locals }) => {
		try {
			const analysis = await api('/smart-savings/analyze', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true, analysis };
		} catch (e) {
			return fail(500, { error: 'Failed to analyze spending patterns' });
		}
	},

	createRule: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const ruleType = formData.get('ruleType') as string;
		const amount = formData.get('amount') ? Number(formData.get('amount')) : undefined;
		const roundUpTo = formData.get('roundUpTo') ? Number(formData.get('roundUpTo')) : undefined;
		const sourceAccountId = (formData.get('sourceAccountId') as string) || undefined;
		const targetGoalId = (formData.get('targetGoalId') as string) || undefined;

		try {
			await api('/smart-savings/rules', {
				method: 'POST',
				body: { name, ruleType, amount, roundUpTo, sourceAccountId, targetGoalId },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: 'Failed to create rule' });
		}
	},

	toggleRule: async ({ request, locals }) => {
		const formData = await request.formData();
		const ruleId = formData.get('ruleId') as string;
		const isActive = Number(formData.get('isActive'));

		try {
			await api(`/smart-savings/rules/${ruleId}`, {
				method: 'PATCH',
				body: { isActive },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: 'Failed to update rule' });
		}
	},

	deleteRule: async ({ request, locals }) => {
		const formData = await request.formData();
		const ruleId = formData.get('ruleId') as string;

		try {
			await api(`/smart-savings/rules/${ruleId}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: 'Failed to delete rule' });
		}
	}
};
