import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [score, history, goals] = await Promise.all([
      api('/financial-health/score', { accessToken: locals.accessToken }),
      api('/financial-health/score/history', { accessToken: locals.accessToken }),
      api('/financial-health/goals', { accessToken: locals.accessToken }),
    ]);

    return { score, history, goals };
  } catch {
    return {
      score: null,
      history: [],
      goals: [],
    };
  }
};

export const actions: Actions = {
  calculate: async ({ locals }) => {
    try {
      await api('/financial-health/score/calculate', {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to calculate score' });
    }
  },

  createGoal: async ({ request, locals }) => {
    const formData = await request.formData();
    const data = {
      category: formData.get('category') as string,
      targetValue: parseFloat(formData.get('targetValue') as string),
      currentValue: parseFloat(formData.get('currentValue') as string) || 0,
      description: (formData.get('description') as string) || undefined,
    };

    if (!data.category || !data.targetValue) {
      return fail(400, { error: 'Category and target value are required' });
    }

    try {
      await api('/financial-health/goals', {
        method: 'POST',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to create goal' });
    }
  },

  updateGoal: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const data = {
      currentValue: parseFloat(formData.get('currentValue') as string),
      isAchieved: formData.get('isAchieved') === 'on',
    };

    try {
      await api(`/financial-health/goals/${id}`, {
        method: 'PATCH',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to update goal' });
    }
  },
};
