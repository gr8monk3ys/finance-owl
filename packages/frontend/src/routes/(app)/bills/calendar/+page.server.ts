import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals, url }) => {
  const now = new Date();
  const year = parseInt(url.searchParams.get('year') ?? String(now.getFullYear()), 10);
  const month = parseInt(url.searchParams.get('month') ?? String(now.getMonth() + 1), 10);

  try {
    const [calendar, summary, upcoming] = await Promise.all([
      api(`/bills/calendar?year=${year}&month=${month}`, {
        accessToken: locals.accessToken,
      }),
      api(`/bills/summary?year=${year}&month=${month}`, {
        accessToken: locals.accessToken,
      }),
      api('/bills/upcoming?days=90', {
        accessToken: locals.accessToken,
      }),
    ]);

    return { calendar, summary, upcoming, year, month };
  } catch {
    return {
      calendar: [],
      summary: {
        totalDue: 0,
        totalPaid: 0,
        totalUpcoming: 0,
        billCount: 0,
        paidCount: 0,
        overdueCount: 0,
      },
      upcoming: [],
      year,
      month,
    };
  }
};

export const actions: Actions = {
  markPaid: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    if (!id) {
      return fail(400, { error: 'Bill ID is required' });
    }

    try {
      await api(`/bills/${id}/paid`, {
        method: 'PATCH',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to mark bill as paid' });
    }
  },
};
