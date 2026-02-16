import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const households = await api('/households', { accessToken: locals.accessToken });

		if (households.length > 0) {
			const household = households[0];
			const [details, sharedAccounts] = await Promise.all([
				api(`/households/${household.id}`, { accessToken: locals.accessToken }),
				api(`/households/${household.id}/accounts`, { accessToken: locals.accessToken })
			]);

			// Also fetch user's own accounts for the share dropdown
			const accounts = await api('/accounts', { accessToken: locals.accessToken });

			return {
				household: details,
				sharedAccounts,
				accounts,
				households
			};
		}

		return {
			household: null,
			sharedAccounts: [],
			accounts: [],
			households: []
		};
	} catch {
		return {
			household: null,
			sharedAccounts: [],
			accounts: [],
			households: []
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;

		if (!name) {
			return fail(400, { error: 'Household name is required' });
		}

		try {
			await api('/households', {
				method: 'POST',
				body: { name },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to create household' });
		}
	},

	join: async ({ request, locals }) => {
		const formData = await request.formData();
		const inviteCode = formData.get('inviteCode') as string;

		if (!inviteCode) {
			return fail(400, { error: 'Invite code is required' });
		}

		try {
			await api('/households/join', {
				method: 'POST',
				body: { inviteCode },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to join household' });
		}
	},

	updateName: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		try {
			await api(`/households/${id}`, {
				method: 'PATCH',
				body: { name },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update name' });
		}
	},

	generateInviteCode: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/households/${id}/invite-code`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to generate invite code' });
		}
	},

	updateRole: async ({ request, locals }) => {
		const formData = await request.formData();
		const householdId = formData.get('householdId') as string;
		const memberId = formData.get('memberId') as string;
		const role = formData.get('role') as string;

		try {
			await api(`/households/${householdId}/members/${memberId}/role`, {
				method: 'PATCH',
				body: { role },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update role' });
		}
	},

	removeMember: async ({ request, locals }) => {
		const formData = await request.formData();
		const householdId = formData.get('householdId') as string;
		const memberId = formData.get('memberId') as string;

		try {
			await api(`/households/${householdId}/members/${memberId}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to remove member' });
		}
	},

	shareAccount: async ({ request, locals }) => {
		const formData = await request.formData();
		const householdId = formData.get('householdId') as string;
		const accountId = formData.get('accountId') as string;

		try {
			await api(`/households/${householdId}/accounts/${accountId}/share`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to share account' });
		}
	},

	unshareAccount: async ({ request, locals }) => {
		const formData = await request.formData();
		const householdId = formData.get('householdId') as string;
		const accountId = formData.get('accountId') as string;

		try {
			await api(`/households/${householdId}/accounts/${accountId}/share`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to unshare account' });
		}
	},

	leave: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/households/${id}/leave`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to leave household' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/households/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to delete household' });
		}
	}
};
