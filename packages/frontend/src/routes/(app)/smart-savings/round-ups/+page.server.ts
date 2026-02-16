import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [config, stats, pending, savingsGoals, accounts] = await Promise.all([
			api('/round-ups/config', { accessToken: locals.accessToken }).catch(() => null),
			api('/round-ups/stats', { accessToken: locals.accessToken }).catch(() => null),
			api('/round-ups/pending', { accessToken: locals.accessToken }).catch(() => []),
			api('/savings-goals', { accessToken: locals.accessToken }).catch(() => []),
			api('/accounts', { accessToken: locals.accessToken }).catch(() => [])
		]);

		return {
			config,
			stats,
			pending,
			savingsGoals,
			accounts
		};
	} catch {
		return {
			config: null,
			stats: null,
			pending: [],
			savingsGoals: [],
			accounts: []
		};
	}
};

export const actions: Actions = {
	updateConfig: async ({ request, locals }) => {
		const formData = await request.formData();

		const enabled = formData.get('enabled') === 'true';
		const roundTo = Number(formData.get('roundTo')) || 1;
		const multiplier = Number(formData.get('multiplier')) || 1;
		const maxDailyRoundUp = Number(formData.get('maxDailyRoundUp')) || 10;
		const savingsGoalId = (formData.get('savingsGoalId') as string) || null;
		const accountId = (formData.get('accountId') as string) || null;

		try {
			await api('/round-ups/config', {
				method: 'PUT',
				body: { enabled, roundTo, multiplier, maxDailyRoundUp, savingsGoalId, accountId },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: 'Failed to update round-up configuration' });
		}
	},

	processRoundUps: async ({ locals }) => {
		try {
			const result = await api('/round-ups/process', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true, result };
		} catch (e) {
			return fail(500, { error: 'Failed to process round-ups' });
		}
	}
};
