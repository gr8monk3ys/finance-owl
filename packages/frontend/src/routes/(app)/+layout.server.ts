import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/auth/login');
  }

  // The backend has no tenants module (#197), so there is no branding to
  // resolve. `null` keeps the default Finance Owl branding.
  return {
    user: locals.user,
    tenant: null,
  };
};
