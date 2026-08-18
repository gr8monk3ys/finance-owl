import type { PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const user = await api('/auth/me', { accessToken: locals.accessToken });
    return { user };
  } catch {
    return { user: locals.user };
  }
};
