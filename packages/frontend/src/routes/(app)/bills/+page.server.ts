import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;

		const [upcoming, subscriptions, summary] = await Promise.all([
			api('/subscriptions/upcoming?days=90', {
				accessToken: locals.accessToken
			}),
			api('/subscriptions', {
				accessToken: locals.accessToken
			}).catch(() => []),
			api(`/bills/summary?year=${year}&month=${month}`, {
				accessToken: locals.accessToken
			}).catch(() => ({ totalDue: 0, totalPaid: 0, totalUnpaid: 0, billCount: 0 }))
		]);

		return { upcoming, subscriptions, summary };
	} catch {
		return {
			upcoming: [],
			subscriptions: [],
			summary: { totalDue: 0, totalPaid: 0, totalUnpaid: 0, billCount: 0 }
		};
	}
};

export const actions: Actions = {
	markPaid: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/bills/${id}/paid`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to mark bill as paid' });
		}
	}
};
