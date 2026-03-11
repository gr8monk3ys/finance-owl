import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	const accessToken = locals.accessToken;

	let tenants: Record<string, unknown>[] = [];
	let stats: Record<string, unknown> | null = null;

	try {
		[tenants, stats] = await Promise.all([
			api('/admin/tenants', { accessToken }),
			api('/admin/tenants/stats', { accessToken })
		]);
	} catch {
		// User may not be a platform admin - return empty data
	}

	return {
		tenants: tenants ?? [],
		stats: stats ?? { tenants: { total: 0, active: 0, trial: 0, suspended: 0 }, totalMembers: 0, planBreakdown: [] }
	};
};
