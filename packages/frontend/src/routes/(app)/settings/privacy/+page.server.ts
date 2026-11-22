import type { PageServerLoad, Actions } from './$types';
import { api } from '#lib/server/api.ts';
import { getErrorMessage } from '#lib/server/error.ts';

export const load: PageServerLoad = async ({ locals }) => {
  const dashboard = await api('/privacy/dashboard', { accessToken: locals.accessToken });
  return { dashboard: dashboard ?? { consents: [], exports: [], deletions: [] } };
};

export const actions = {
  updateConsent: async ({ request, locals }) => {
    const fd = await request.formData();
    const consentType = fd.get('consentType') as string;
    const isGranted = fd.get('isGranted') === 'true';
    try {
      await api('/privacy/consents', {
        method: 'PATCH',
        body: { consentType, isGranted },
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return { error: getErrorMessage(e) };
    }
  },
  requestExport: async ({ locals }) => {
    try {
      await api('/privacy/export', {
        method: 'POST',
        body: { format: 'json' },
        accessToken: locals.accessToken,
      });
      return { success: true, message: 'Data export requested' };
    } catch (e: unknown) {
      return { error: getErrorMessage(e) };
    }
  },
  requestDeletion: async ({ request, locals }) => {
    const fd = await request.formData();
    const reason = fd.get('reason') as string;
    try {
      await api('/privacy/deletion', {
        method: 'POST',
        body: { reason },
        accessToken: locals.accessToken,
      });
      return { success: true, message: 'Deletion request submitted' };
    } catch (e: unknown) {
      return { error: getErrorMessage(e) };
    }
  },
} satisfies Actions;
