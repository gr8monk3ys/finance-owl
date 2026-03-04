import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [flags, households, transactions] = await Promise.all([
			api('/flags', { accessToken: locals.accessToken }),
			api('/households', { accessToken: locals.accessToken }),
			api('/transactions?limit=50', { accessToken: locals.accessToken }).catch(() => [])
		]);

		// If user has a household, also load household flags
		let householdFlags: Record<string, unknown>[] = [];
		if (households.length > 0) {
			try {
				householdFlags = await api(`/flags/household/${households[0].id}`, {
					accessToken: locals.accessToken
				});
			} catch {
				// Household flags might fail if no shared accounts
			}
		}

		return {
			flags,
			householdFlags,
			householdId: households[0]?.id ?? null,
			transactions: transactions?.transactions ?? transactions ?? []
		};
	} catch {
		return {
			flags: [],
			householdFlags: [],
			householdId: null,
			transactions: []
		};
	}
};

export const actions: Actions = {
	flag: async ({ request, locals }) => {
		const formData = await request.formData();
		const transactionId = formData.get('transactionId') as string;
		const reason = formData.get('reason') as string;

		if (!transactionId) {
			return fail(400, { error: 'Transaction ID is required' });
		}

		try {
			await api('/flags', {
				method: 'POST',
				body: { transactionId, reason: reason || undefined },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to flag transaction' });
		}
	},

	resolve: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const comment = formData.get('comment') as string;

		try {
			await api(`/flags/${id}/resolve`, {
				method: 'PATCH',
				body: comment ? { comment } : undefined,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to resolve flag' });
		}
	}
};
