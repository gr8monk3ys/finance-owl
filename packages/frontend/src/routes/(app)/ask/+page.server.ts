import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [status, insightsResponse] = await Promise.all([
			api('/ai/status', { accessToken: locals.accessToken }).catch(() => ({
				available: false,
				model: 'unknown',
				url: ''
			})),
			api('/ai/insights?limit=5', { accessToken: locals.accessToken }).catch(() => ({
				insights: []
			}))
		]);

		return {
			aiStatus: status,
			insights: insightsResponse.insights ?? []
		};
	} catch {
		return {
			aiStatus: { available: false, model: 'unknown', url: '' },
			insights: []
		};
	}
};

export const actions: Actions = {
	ask: async ({ request, locals }) => {
		const formData = await request.formData();
		const question = (formData.get('question') as string)?.trim();

		if (!question) {
			return fail(400, { error: 'Please enter a question.' });
		}

		try {
			const result = await api('/ai/query', {
				method: 'POST',
				body: { question },
				accessToken: locals.accessToken
			});

			return { success: true, answer: result.answer, sources: result.sources ?? [] };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to get answer from AI.' });
		}
	},

	detectAnomalies: async ({ locals }) => {
		try {
			const result = await api('/ai/detect-anomalies', {
				method: 'POST',
				accessToken: locals.accessToken
			});

			return { anomaliesDetected: true, anomalies: result.anomalies ?? [] };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to detect anomalies.' });
		}
	}
};
