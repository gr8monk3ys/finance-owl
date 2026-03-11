import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [subscriptions, history, savings, providers] = await Promise.all([
			api('/subscriptions', { accessToken: locals.accessToken }),
			api('/subscriptions/cancellation/history', { accessToken: locals.accessToken }),
			api('/subscriptions/cancellation/savings', { accessToken: locals.accessToken }),
			api('/subscriptions/cancellation/providers', { accessToken: locals.accessToken })
		]);

		// Filter to only active subscriptions
		const activeSubscriptions = (subscriptions as Record<string, unknown>[]).filter(
			(s: Record<string, unknown>) => s.isActive
		);

		return {
			subscriptions: activeSubscriptions,
			history,
			savings,
			providers
		};
	} catch {
		return {
			subscriptions: [],
			history: [],
			savings: {
				totalCancelled: 0,
				totalPending: 0,
				estimatedMonthlySavings: 0,
				estimatedAnnualSavings: 0,
				cancelledSubscriptions: []
			},
			providers: []
		};
	}
};

export const actions: Actions = {
	initiate: async ({ request, locals }) => {
		const formData = await request.formData();
		const subscriptionId = formData.get('subscriptionId') as string;
		const reason = formData.get('reason') as string;

		if (!subscriptionId) {
			return fail(400, { error: 'Subscription is required' });
		}

		try {
			const result = await api(`/subscriptions/cancellation/initiate/${subscriptionId}`, {
				method: 'POST',
				body: { reason: reason || undefined },
				accessToken: locals.accessToken
			});
			return { success: true, cancellationId: (result as Record<string, unknown>).id };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to initiate cancellation' });
		}
	},

	lookupProvider: async ({ request, locals }) => {
		const formData = await request.formData();
		const providerName = formData.get('providerName') as string;

		if (!providerName) {
			return fail(400, { error: 'Provider name is required' });
		}

		try {
			const result = await api(
				`/subscriptions/cancellation/provider/${encodeURIComponent(providerName)}`,
				{ accessToken: locals.accessToken }
			);
			return { success: true, providerResult: result };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to look up provider' });
		}
	}
};
