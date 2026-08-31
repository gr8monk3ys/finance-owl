import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals, url }) => {
  const yearParam = url.searchParams.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  try {
    const [years, review] = await Promise.all([
      api('/year-review/years', { accessToken: locals.accessToken }),
      api(`/year-review/${selectedYear}`, { accessToken: locals.accessToken }),
    ]);

    return { years, review, selectedYear };
  } catch {
    return {
      years: [],
      review: null,
      selectedYear,
    };
  }
};

export const actions: Actions = {
  generate: async ({ request, locals }) => {
    const formData = await request.formData();
    const year = parseInt(formData.get('year') as string, 10);

    if (!year || year < 2000 || year > 2100) {
      return fail(400, { error: 'Invalid year' });
    }

    try {
      await api(`/year-review/${year}/generate`, {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to generate review' });
    }
  },
};
