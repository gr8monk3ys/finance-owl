import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [recommendations, states, unclaimedResults] = await Promise.all([
			api('/recommendations', { accessToken: locals.accessToken }).catch(() => []),
			api('/unclaimed/states', { accessToken: locals.accessToken }).catch(() => []),
			api('/unclaimed/results', { accessToken: locals.accessToken }).catch(() => [])
		]);

		return {
			recommendations,
			states,
			unclaimedResults
		};
	} catch {
		return {
			recommendations: [],
			states: [],
			unclaimedResults: []
		};
	}
};

export const actions: Actions = {
	search: async ({ request, locals }) => {
		const formData = await request.formData();
		const firstName = formData.get('firstName') as string;
		const lastName = formData.get('lastName') as string;
		const state = formData.get('state') as string;

		if (!firstName || !lastName || !state) {
			return fail(400, { error: 'First name, last name, and state are required' });
		}

		try {
			const result = await api('/unclaimed/search', {
				method: 'POST',
				body: { firstName, lastName, state },
				accessToken: locals.accessToken
			});
			return { success: true, searchResult: result };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to search for unclaimed money' });
		}
	},

	updateResultStatus: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const status = formData.get('status') as string;

		try {
			await api(`/unclaimed/results/${id}`, {
				method: 'PATCH',
				body: { status },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update result status' });
		}
	},

	generateRecommendations: async ({ locals }) => {
		try {
			await api('/recommendations/generate', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to generate recommendations' });
		}
	},

	dismissRecommendation: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/recommendations/${id}/dismiss`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to dismiss recommendation' });
		}
	}
};
