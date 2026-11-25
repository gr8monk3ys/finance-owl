import type { PageServerLoad, Actions } from './$types';
import { api } from '#lib/server/api.ts';
import { getErrorMessage } from '#lib/server/error.ts';

const EMPTY_DASHBOARD = { consents: [], exports: [], deletions: [] };

export const load: PageServerLoad = async ({ locals }) => {
  // The backend privacy module was removed (#197), so this call 404s. Fall back
  // to an empty dashboard so the page, and its delete-account form, still render.
  const dashboard = await api('/privacy/dashboard', { accessToken: locals.accessToken }).catch(
    () => null,
  );
  return { dashboard: dashboard ?? EMPTY_DASHBOARD };
};

export const actions: Actions = {
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
      await api('/account/delete', {
        method: 'POST',
        body: { reason },
        accessToken: locals.accessToken,
      });
      return { success: true, message: 'Deletion request submitted' };
    } catch (e: unknown) {
      return { error: getErrorMessage(e) };
    }
  },
};
