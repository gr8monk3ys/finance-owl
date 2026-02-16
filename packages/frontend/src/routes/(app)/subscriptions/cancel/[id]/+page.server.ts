import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	try {
		const [subscription, instructions, cancellations, stats] = await Promise.all([
			api(`/subscriptions/${id}`, { accessToken: locals.accessToken }),
			api(`/subscriptions/${id}/cancel-instructions`, { accessToken: locals.accessToken }),
			api('/subscriptions/cancellations', { accessToken: locals.accessToken }),
			api('/subscriptions/cancellations/stats', { accessToken: locals.accessToken })
		]);

		// Find existing cancellation request for this subscription
		const existingRequest = cancellations.find(
			(c: any) => c.subscriptionId === id && c.status !== 'failed'
		);

		return {
			subscription,
			instructions,
			existingRequest: existingRequest || null,
			stats
		};
	} catch {
		return {
			subscription: null,
			instructions: null,
			existingRequest: null,
			stats: { totalRequested: 0, totalCompleted: 0, totalPending: 0, estimatedMonthlySavings: 0, estimatedAnnualSavings: 0 }
		};
	}
};

export const actions: Actions = {
	requestCancellation: async ({ params, request, locals }) => {
		const formData = await request.formData();
		const reason = formData.get('reason') as string;

		try {
			const result = await api(`/subscriptions/${params.id}/cancel`, {
				method: 'POST',
				body: { reason: reason || undefined },
				accessToken: locals.accessToken
			});
			return { success: true, cancellationRequest: result };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to request cancellation' });
		}
	},

	updateStatus: async ({ request, locals }) => {
		const formData = await request.formData();
		const cancellationId = formData.get('cancellationId') as string;
		const status = formData.get('status') as string;
		const notes = formData.get('notes') as string;

		try {
			await api(`/subscriptions/cancellations/${cancellationId}/status`, {
				method: 'PATCH',
				body: { status, notes: notes || undefined },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update status' });
		}
	},

	confirmCancellation: async ({ request, locals }) => {
		const formData = await request.formData();
		const cancellationId = formData.get('cancellationId') as string;

		try {
			await api(`/subscriptions/cancellations/${cancellationId}/confirm`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true, confirmed: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to confirm cancellation' });
		}
	}
};
