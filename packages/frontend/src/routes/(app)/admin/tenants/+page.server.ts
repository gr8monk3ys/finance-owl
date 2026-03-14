import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const accessToken = locals.accessToken;

	try {
		const [tenants, stats] = await Promise.all([
			api('/admin/tenants', { accessToken }),
			api('/admin/tenants/stats', { accessToken })
		]);

		return {
			tenants: tenants ?? [],
			stats: stats ?? { tenants: { total: 0, active: 0, trial: 0, suspended: 0 }, totalMembers: 0, planBreakdown: [] }
		};
	} catch {
		// User is not a platform admin - redirect to dashboard
		throw redirect(303, '/dashboard');
	}
};

export const actions: Actions = {
	suspendTenant: async ({ request, locals }) => {
		const formData = await request.formData();
		const tenantId = formData.get('tenantId') as string;

		if (!tenantId) {
			return fail(400, { error: 'Tenant ID is required' });
		}

		try {
			await api(`/admin/tenants/${tenantId}/suspend`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { suspended: true };
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'Failed to suspend tenant'
			});
		}
	},

	activateTenant: async ({ request, locals }) => {
		const formData = await request.formData();
		const tenantId = formData.get('tenantId') as string;

		if (!tenantId) {
			return fail(400, { error: 'Tenant ID is required' });
		}

		try {
			await api(`/admin/tenants/${tenantId}/activate`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { activated: true };
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'Failed to activate tenant'
			});
		}
	},

	createTenant: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const slug = formData.get('slug') as string;

		if (!name || !slug) {
			return fail(400, { error: 'Name and slug are required' });
		}

		try {
			await api('/admin/tenants', {
				method: 'POST',
				accessToken: locals.accessToken,
				body: { name, slug }
			});
			return { created: true };
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'Failed to create tenant'
			});
		}
	}
};
