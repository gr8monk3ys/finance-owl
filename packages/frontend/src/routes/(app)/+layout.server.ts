import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	// Resolve tenant branding from the current domain (optional, graceful fallback)
	let tenant = null;
	try {
		const host = url.hostname;
		if (host && host !== 'localhost') {
			tenant = await api(`/tenants/resolve?domain=${encodeURIComponent(host)}`);
		}
	} catch {
		// Tenant resolution is optional - continue in single-tenant mode
	}

	return {
		user: locals.user,
		tenant
	};
};
