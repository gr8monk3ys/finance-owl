import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const shares = await api('/advisor-sharing/shares', {
			accessToken: locals.accessToken
		});

		return { shares };
	} catch {
		return { shares: [] };
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const advisorEmail = (formData.get('advisorEmail') as string)?.trim();
		const advisorName = (formData.get('advisorName') as string)?.trim();
		const expiresAt = (formData.get('expiresAt') as string) || undefined;

		const permissionKeys = ['accounts', 'transactions', 'budgets', 'investments', 'reports'];
		const permissions = permissionKeys.filter(
			(key) => formData.get(`permission_${key}`) === 'on'
		);

		if (!advisorEmail || !advisorName) {
			return fail(400, { error: 'Advisor email and name are required' });
		}

		if (permissions.length === 0) {
			return fail(400, { error: 'At least one permission must be selected' });
		}

		try {
			await api('/advisor-sharing/shares', {
				method: 'POST',
				body: { advisorEmail, advisorName, permissions, expiresAt },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to create share' });
		}
	},

	revoke: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/advisor-sharing/shares/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to revoke share' });
		}
	}
};
