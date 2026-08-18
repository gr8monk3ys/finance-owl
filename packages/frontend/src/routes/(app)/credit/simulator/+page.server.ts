import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [profile, simulations] = await Promise.all([
      api('/credit-simulator/profile', { accessToken: locals.accessToken }),
      api('/credit-simulator/simulations', { accessToken: locals.accessToken }),
    ]);

    return {
      profile: profile ?? null,
      simulations: simulations ?? [],
    };
  } catch {
    return {
      profile: null,
      simulations: [],
    };
  }
};

export const actions: Actions = {
  saveProfile: async ({ request, locals }) => {
    const formData = await request.formData();
    const data = {
      currentScore: parseInt(formData.get('currentScore') as string, 10),
      scoreDate: new Date().toISOString().split('T')[0],
      paymentHistory: parseFloat(formData.get('paymentHistory') as string),
      creditUtilization: parseFloat(formData.get('creditUtilization') as string),
      accountAge: parseInt(formData.get('accountAge') as string, 10),
      totalAccounts: parseInt(formData.get('totalAccounts') as string, 10),
      hardInquiries: parseInt(formData.get('hardInquiries') as string, 10),
      derogatoryMarks: parseInt(formData.get('derogatoryMarks') as string, 10),
      totalDebt: parseFloat(formData.get('totalDebt') as string),
      availableCredit: parseFloat(formData.get('availableCredit') as string),
    };

    if (isNaN(data.currentScore) || data.currentScore < 300 || data.currentScore > 850) {
      return fail(400, { error: 'Credit score must be between 300 and 850' });
    }

    try {
      await api('/credit-simulator/profile', {
        method: 'PUT',
        body: data,
        accessToken: locals.accessToken,
      });
      return { profileSaved: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to save credit profile' });
    }
  },

  simulate: async ({ request, locals }) => {
    const formData = await request.formData();
    const scenarioType = formData.get('scenarioType') as string;
    const parametersRaw = formData.get('parameters') as string;

    let parameters: Record<string, number> = {};
    try {
      parameters = JSON.parse(parametersRaw || '{}');
    } catch {
      return fail(400, { error: 'Invalid simulation parameters' });
    }

    try {
      const result = await api('/credit-simulator/simulate', {
        method: 'POST',
        body: { type: scenarioType, parameters },
        accessToken: locals.accessToken,
      });
      return { simulationResult: result };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to run simulation' });
    }
  },
};
