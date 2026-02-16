import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	const accessToken = locals.accessToken;
	const { id } = params;

	try {
		const [tenant, members] = await Promise.all([
			api(`/tenants/${id}`, { accessToken }),
			api(`/tenants/${id}/members`, { accessToken })
		]);

		if (!tenant) {
			throw error(404, 'Tenant not found');
		}

		return {
			tenant,
			members: members ?? []
		};
	} catch (e: any) {
		if (e?.status === 404) {
			throw error(404, 'Tenant not found');
		}
		throw error(500, 'Failed to load tenant details');
	}
};
