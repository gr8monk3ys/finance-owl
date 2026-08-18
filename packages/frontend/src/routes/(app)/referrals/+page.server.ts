import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [code, stats, referralList] = await Promise.all([
      api('/referrals/code', { accessToken: locals.accessToken }),
      api('/referrals/stats', { accessToken: locals.accessToken }),
      api('/referrals/referrals', { accessToken: locals.accessToken }),
    ]);

    const leaderboard = await api('/referrals/leaderboard', {
      accessToken: locals.accessToken,
    }).catch(() => []);

    return { code, stats, referrals: referralList, leaderboard };
  } catch {
    return {
      code: null,
      stats: {
        totalReferrals: 0,
        totalEarnings: 0,
        pendingReferrals: 0,
        completedReferrals: 0,
        rewardedReferrals: 0,
      },
      referrals: [],
      leaderboard: [],
    };
  }
};

export const actions: Actions = {
  apply: async ({ request, locals }) => {
    const formData = await request.formData();
    const code = (formData.get('code') as string)?.trim();

    if (!code) {
      return fail(400, { error: 'Referral code is required' });
    }

    try {
      await api('/referrals/apply', {
        method: 'POST',
        body: { code },
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to apply referral code' });
    }
  },
};
