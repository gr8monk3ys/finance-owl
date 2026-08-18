import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [providers, savings, attempts] = await Promise.all([
      api('/bill-negotiation/tracking/providers', {
        accessToken: locals.accessToken,
      }).catch(() => ({})),
      api('/bill-negotiation/tracking/savings', {
        accessToken: locals.accessToken,
      }).catch(() => ({
        totalAnnualSavings: 0,
        totalMonthlySavings: 0,
        successfulAttempts: 0,
        totalAttempts: 0,
        successRate: 0,
        byCategory: [],
        recentSuccesses: [],
      })),
      api('/bill-negotiation/tracking/attempts', {
        accessToken: locals.accessToken,
      }).catch(() => []),
    ]);

    return { providers, savings, attempts };
  } catch {
    return {
      providers: {},
      savings: {
        totalAnnualSavings: 0,
        totalMonthlySavings: 0,
        successfulAttempts: 0,
        totalAttempts: 0,
        successRate: 0,
        byCategory: [],
        recentSuccesses: [],
      },
      attempts: [],
    };
  }
};

export const actions: Actions = {
  getStrategy: async ({ request, locals }) => {
    const formData = await request.formData();
    const billType = formData.get('billType') as string;
    const provider = formData.get('provider') as string;
    const currentAmount = formData.get('currentAmount') as string;

    try {
      const strategy = await api(
        `/bill-negotiation/tracking/strategy/${encodeURIComponent(billType)}?provider=${encodeURIComponent(provider)}&currentAmount=${currentAmount}`,
        { accessToken: locals.accessToken },
      );
      return { success: true, strategy };
    } catch (e) {
      return fail(500, { error: 'Failed to generate strategy' });
    }
  },

  getProviderScript: async ({ request, locals }) => {
    const formData = await request.formData();
    const provider = formData.get('provider') as string;
    const billType = (formData.get('billType') as string) || 'other';
    const currentAmount = formData.get('currentAmount') as string;
    const targetAmount = formData.get('targetAmount') as string;

    try {
      const scriptData = await api(
        `/bill-negotiation/tracking/script/${encodeURIComponent(provider)}?billType=${billType}&currentAmount=${currentAmount}&targetAmount=${targetAmount}`,
        { accessToken: locals.accessToken },
      );
      return { success: true, scriptData };
    } catch (e) {
      return fail(500, { error: 'Failed to get provider script' });
    }
  },

  generateEmail: async ({ request, locals }) => {
    const formData = await request.formData();
    const provider = formData.get('provider') as string;
    const billType = formData.get('billType') as string;
    const currentAmount = Number(formData.get('currentAmount'));
    const targetAmount = Number(formData.get('targetAmount'));

    try {
      const email = await api('/bill-negotiation/tracking/email-template', {
        method: 'POST',
        body: { provider, billType, currentAmount, targetAmount },
        accessToken: locals.accessToken,
      });
      return { success: true, email };
    } catch (e) {
      return fail(500, { error: 'Failed to generate email template' });
    }
  },

  startAttempt: async ({ request, locals }) => {
    const formData = await request.formData();
    const provider = formData.get('provider') as string;
    const billType = formData.get('billType') as string;
    const originalAmount = Number(formData.get('originalAmount'));
    const targetAmount = Number(formData.get('targetAmount'));
    const method = (formData.get('method') as string) || 'phone';
    const notes = (formData.get('notes') as string) || undefined;

    try {
      await api('/bill-negotiation/tracking/start', {
        method: 'POST',
        body: { provider, billType, originalAmount, targetAmount, method, notes },
        accessToken: locals.accessToken,
      });
      return { success: true, started: true };
    } catch (e) {
      return fail(500, { error: 'Failed to start negotiation attempt' });
    }
  },

  updateAttempt: async ({ request, locals }) => {
    const formData = await request.formData();
    const attemptId = formData.get('attemptId') as string;
    const status = formData.get('status') as string;
    const negotiatedAmount = formData.get('negotiatedAmount')
      ? Number(formData.get('negotiatedAmount'))
      : undefined;
    const notes = (formData.get('notes') as string) || undefined;

    try {
      await api(`/bill-negotiation/tracking/${attemptId}/update`, {
        method: 'PATCH',
        body: { status, negotiatedAmount, notes },
        accessToken: locals.accessToken,
      });
      return { success: true, updated: true };
    } catch (e) {
      return fail(500, { error: 'Failed to update negotiation attempt' });
    }
  },
};
