import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [challenges, templates, stats] = await Promise.all([
			api('/challenges', { accessToken: locals.accessToken }),
			api('/challenges/templates', { accessToken: locals.accessToken }),
			api('/challenges/stats', { accessToken: locals.accessToken })
		]);

		return { challenges, templates, stats };
	} catch {
		return {
			challenges: [],
			templates: [],
			stats: {
				totalCompleted: 0,
				totalSaved: 0,
				longestStreak: 0,
				activeChallenges: 0
			}
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			type: formData.get('type') as string,
			name: (formData.get('name') as string) || undefined,
			description: (formData.get('description') as string) || undefined,
			targetAmount: formData.get('targetAmount')
				? parseFloat(formData.get('targetAmount') as string)
				: undefined
		};

		if (!data.type) {
			return fail(400, { error: 'Challenge type is required' });
		}

		try {
			await api('/challenges', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to create challenge' });
		}
	},

	addEntry: async ({ request, locals }) => {
		const formData = await request.formData();
		const challengeId = formData.get('challengeId') as string;
		const data = {
			amount: parseFloat(formData.get('amount') as string),
			note: (formData.get('note') as string) || undefined
		};

		if (!challengeId || !data.amount) {
			return fail(400, { error: 'Challenge ID and amount are required' });
		}

		try {
			await api(`/challenges/${challengeId}/entries`, {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to add entry' });
		}
	},

	abandon: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/challenges/${id}/abandon`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to abandon challenge' });
		}
	}
};
