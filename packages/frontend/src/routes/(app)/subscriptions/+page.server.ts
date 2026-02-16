import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [subscriptions, summary, upcoming, categories, priceChanges, duplicates] =
			await Promise.all([
				api('/subscriptions', { accessToken: locals.accessToken }),
				api('/subscriptions/summary', { accessToken: locals.accessToken }),
				api('/subscriptions/upcoming?days=30', { accessToken: locals.accessToken }),
				api('/categories', { accessToken: locals.accessToken }),
				api('/subscriptions/price-changes', { accessToken: locals.accessToken }).catch(() => []),
				api('/subscriptions/duplicates', { accessToken: locals.accessToken }).catch(() => [])
			]);

		return { subscriptions, summary, upcoming, categories, priceChanges, duplicates };
	} catch {
		return {
			subscriptions: [],
			summary: { monthlyTotal: 0, annualTotal: 0, activeCount: 0, byCategory: [] },
			upcoming: [],
			categories: [],
			priceChanges: [],
			duplicates: []
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name') as string,
			merchantName: (formData.get('merchantName') as string) || undefined,
			estimatedAmount: parseFloat(formData.get('estimatedAmount') as string),
			frequency: formData.get('frequency') as string,
			categoryId: (formData.get('categoryId') as string) || undefined,
			nextExpectedDate: (formData.get('nextExpectedDate') as string) || undefined
		};

		if (!data.name || !data.estimatedAmount || !data.frequency) {
			return fail(400, { error: 'Name, amount, and frequency are required' });
		}

		try {
			await api('/subscriptions', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to create subscription' });
		}
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data: Record<string, any> = {};

		const name = formData.get('name') as string;
		if (name) data.name = name;

		const estimatedAmount = formData.get('estimatedAmount') as string;
		if (estimatedAmount) data.estimatedAmount = parseFloat(estimatedAmount);

		const frequency = formData.get('frequency') as string;
		if (frequency) data.frequency = frequency;

		const categoryId = formData.get('categoryId') as string;
		if (categoryId) data.categoryId = categoryId;

		const nextExpectedDate = formData.get('nextExpectedDate') as string;
		if (nextExpectedDate) data.nextExpectedDate = nextExpectedDate;

		try {
			await api(`/subscriptions/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update subscription' });
		}
	},

	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/subscriptions/${id}/confirm`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to confirm subscription' });
		}
	},

	dismiss: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/subscriptions/${id}/dismiss`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to dismiss subscription' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/subscriptions/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to delete subscription' });
		}
	},

	detect: async ({ locals }) => {
		try {
			await api('/subscriptions/detect', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true, detected: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to detect subscriptions' });
		}
	}
};
