import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
  let credentials: Array<{
    id: string;
    deviceType?: string;
    backedUp?: boolean;
    createdAt: string;
  }> = [];
  let sessions: Array<{
    id: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: string;
    expiresAt: string;
  }> = [];
  let totpEnabled = false;

  try {
    const [creds, sess, user] = await Promise.all([
      api('/auth/webauthn/credentials', { accessToken: locals.accessToken }),
      api('/auth/sessions', { accessToken: locals.accessToken }),
      api('/auth/me', { accessToken: locals.accessToken }),
    ]);

    credentials = creds || [];
    sessions = sess || [];
    totpEnabled = user?.totpEnabled ?? false;
  } catch {
    // Use defaults on failure
  }

  return { credentials, sessions, totpEnabled, user: locals.user };
};

export const actions: Actions = {
  changePassword: async ({ request, locals }) => {
    const formData = await request.formData();
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!currentPassword || !newPassword) {
      return fail(400, { passwordError: 'All fields are required.' });
    }

    if (newPassword.length < 8) {
      return fail(400, { passwordError: 'New password must be at least 8 characters.' });
    }

    if (newPassword !== confirmPassword) {
      return fail(400, { passwordError: 'New passwords do not match.' });
    }

    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        accessToken: locals.accessToken,
      });
      return { passwordSuccess: true };
    } catch (e: unknown) {
      return fail(400, { passwordError: getErrorMessage(e) || 'Failed to change password.' });
    }
  },

  logoutAll: async ({ locals }) => {
    try {
      await api('/auth/logout-all', {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { logoutAllSuccess: true };
    } catch (e: unknown) {
      return fail(500, { logoutAllError: getErrorMessage(e) || 'Failed to log out all sessions.' });
    }
  },

  deletePasskey: async ({ request, locals }) => {
    const formData = await request.formData();
    const credentialId = formData.get('credentialId') as string;

    if (!credentialId) {
      return fail(400, { passkeyError: 'Missing credential ID.' });
    }

    try {
      await api(`/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
        method: 'DELETE',
        accessToken: locals.accessToken,
      });
      return { passkeyDeleteSuccess: true };
    } catch (e: unknown) {
      return fail(500, { passkeyError: getErrorMessage(e) || 'Failed to delete passkey.' });
    }
  },

  setupTotp: async ({ locals }) => {
    try {
      const result = await api('/auth/totp/setup', {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { totpSetup: result };
    } catch (e: unknown) {
      return fail(500, { totpError: getErrorMessage(e) || 'Failed to start TOTP setup.' });
    }
  },

  enableTotp: async ({ request, locals }) => {
    const formData = await request.formData();
    const code = formData.get('code') as string;

    if (!code) {
      return fail(400, { totpError: 'Verification code is required.' });
    }

    try {
      await api('/auth/totp/enable', {
        method: 'POST',
        body: { code },
        accessToken: locals.accessToken,
      });
      return { totpEnableSuccess: true };
    } catch (e: unknown) {
      return fail(400, { totpError: getErrorMessage(e) || 'Invalid verification code.' });
    }
  },

  disableTotp: async ({ request, locals }) => {
    const formData = await request.formData();
    const code = formData.get('code') as string;

    if (!code) {
      return fail(400, { totpError: 'Verification code is required to disable 2FA.' });
    }

    try {
      await api('/auth/totp/disable', {
        method: 'POST',
        body: { code },
        accessToken: locals.accessToken,
      });
      return { totpDisableSuccess: true };
    } catch (e: unknown) {
      return fail(400, { totpError: getErrorMessage(e) || 'Invalid verification code.' });
    }
  },
};
