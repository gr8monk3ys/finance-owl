import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage, getErrorStatus } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals, url }) => {
  const success = url.searchParams.get('success') === 'true';
  const canceled = url.searchParams.get('canceled') === 'true';

  try {
    const [plans, subscription, features, invoicesList] = await Promise.all([
      api('/billing/plans', { accessToken: locals.accessToken }),
      api('/billing/subscription', { accessToken: locals.accessToken }),
      api('/billing/features', { accessToken: locals.accessToken }),
      api('/billing/invoices', { accessToken: locals.accessToken }).catch(() => []),
    ]);

    return {
      plans: plans || [],
      subscription: subscription || null,
      features: features || { plan: 'free', features: [], limits: {} },
      invoices: invoicesList || [],
      success,
      canceled,
    };
  } catch {
    return {
      plans: [],
      subscription: null,
      features: { plan: 'free', features: [], limits: {} },
      invoices: [],
      success: false,
      canceled: false,
    };
  }
};

export const actions: Actions = {
  checkout: async ({ request, locals }) => {
    const formData = await request.formData();
    const planId = formData.get('planId') as string;
    const interval = (formData.get('interval') as string) || 'month';

    try {
      const result = await api('/billing/checkout', {
        method: 'POST',
        body: { planId, interval },
        accessToken: locals.accessToken,
      });

      if (result?.url) {
        throw redirect(303, result.url);
      }
    } catch (e: unknown) {
      if (getErrorStatus(e) === 303) throw e;
      return { error: getErrorMessage(e) || 'Failed to create checkout session' };
    }
  },

  portal: async ({ locals }) => {
    try {
      const result = await api('/billing/portal', {
        method: 'POST',
        accessToken: locals.accessToken,
      });

      if (result?.url) {
        throw redirect(303, result.url);
      }
    } catch (e: unknown) {
      if (getErrorStatus(e) === 303) throw e;
      return { error: getErrorMessage(e) || 'Failed to open billing portal' };
    }
  },

  cancel: async ({ request, locals }) => {
    const formData = await request.formData();
    const atPeriodEnd = formData.get('atPeriodEnd') !== 'false';

    try {
      await api('/billing/cancel', {
        method: 'POST',
        body: { atPeriodEnd },
        accessToken: locals.accessToken,
      });

      return { success: 'Subscription cancellation scheduled.' };
    } catch (e: unknown) {
      return { error: getErrorMessage(e) || 'Failed to cancel subscription' };
    }
  },

  resume: async ({ locals }) => {
    try {
      await api('/billing/resume', {
        method: 'POST',
        accessToken: locals.accessToken,
      });

      return { success: 'Subscription resumed successfully.' };
    } catch (e: unknown) {
      return { error: getErrorMessage(e) || 'Failed to resume subscription' };
    }
  },
};
