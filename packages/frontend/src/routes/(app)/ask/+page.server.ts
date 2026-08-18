import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [status, insightsResponse] = await Promise.all([
      api('/ai/status', { accessToken: locals.accessToken }).catch(() => ({
        available: false,
        model: 'unknown',
        url: '',
        message: "AI features require Ollama. Run 'docker compose up ollama' to enable.",
      })),
      api('/ai/insights?limit=5', { accessToken: locals.accessToken }).catch(() => ({
        insights: [],
        aiAvailable: false,
        message: "AI features require Ollama. Run 'docker compose up ollama' to enable.",
      })),
    ]);

    return {
      aiStatus: status,
      insights: insightsResponse.insights ?? [],
      insightsAiAvailable: insightsResponse.aiAvailable ?? status.available ?? false,
      insightsMessage: insightsResponse.message ?? null,
    };
  } catch {
    return {
      aiStatus: {
        available: false,
        model: 'unknown',
        url: '',
        message: "AI features require Ollama. Run 'docker compose up ollama' to enable.",
      },
      insights: [],
      insightsAiAvailable: false,
      insightsMessage: "AI features require Ollama. Run 'docker compose up ollama' to enable.",
    };
  }
};

export const actions: Actions = {
  ask: async ({ request, locals }) => {
    const formData = await request.formData();
    const question = (formData.get('question') as string)?.trim();

    if (!question) {
      return fail(400, { error: 'Please enter a question.' });
    }

    try {
      const result = await api('/ai/query', {
        method: 'POST',
        body: { question },
        accessToken: locals.accessToken,
      });

      if (result.available === false) {
        return fail(503, {
          error: result.message || 'AI features are unavailable. Ensure Ollama is running.',
        });
      }

      if (result.error) {
        return fail(500, { error: result.error });
      }

      return { success: true, answer: result.answer, sources: result.sources ?? [] };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to get answer from AI.' });
    }
  },

  detectAnomalies: async ({ locals }) => {
    try {
      const result = await api('/ai/detect-anomalies', {
        method: 'POST',
        accessToken: locals.accessToken,
      });

      if (result.error) {
        return fail(500, { error: result.error });
      }

      return { anomaliesDetected: true, anomalies: result.anomalies ?? [] };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to detect anomalies.' });
    }
  },
};
