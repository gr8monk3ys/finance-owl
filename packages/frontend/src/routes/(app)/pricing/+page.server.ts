import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [plans, features] = await Promise.all([
			api('/billing/plans', { accessToken: locals.accessToken }),
			api('/billing/features', { accessToken: locals.accessToken }).catch(() => ({
				plan: 'free',
				features: [],
				limits: {}
			}))
		]);

		return {
			plans: plans || [],
			features: features || { plan: 'free', features: [], limits: {} }
		};
	} catch {
		return {
			plans: [],
			features: { plan: 'free', features: [], limits: {} }
		};
	}
};

export const actions: Actions = {
	checkout: async ({ request, locals }) => {
		const formData = await request.formData();
		const planId = formData.get('planId') as string;
		const interval = (formData.get('interval') as string) || 'month';

		try {
			const result = await api('/billing/checkout', {
				method: 'POST',
				body: { planId, interval },
				accessToken: locals.accessToken
			});

			if (result?.url) {
				throw redirect(303, result.url);
			}
		} catch (e: any) {
			if (e?.status === 303) throw e;
			return { error: e.message || 'Failed to create checkout session' };
		}
	}
};
