import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { error, redirect } from '@sveltejs/kit';
import { getErrorStatus } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals, params }) => {
  const accessToken = locals.accessToken;
  const { id } = params;

  try {
    const [tenant, members] = await Promise.all([
      api(`/admin/tenants/${id}`, { accessToken }),
      api(`/admin/tenants/${id}/members`, { accessToken }),
    ]);

    if (!tenant) {
      throw error(404, 'Tenant not found');
    }

    return {
      tenant,
      members: members ?? [],
    };
  } catch (e: unknown) {
    const status = getErrorStatus(e);
    if (status === 404) {
      throw error(404, 'Tenant not found');
    }
    if (status === 403 || status === 401) {
      throw redirect(303, '/dashboard');
    }
    // Re-throw SvelteKit errors (redirects, HttpErrors) as-is
    if (e && typeof e === 'object' && 'status' in e) {
      throw e;
    }
    throw error(500, 'Failed to load tenant details');
  }
};
