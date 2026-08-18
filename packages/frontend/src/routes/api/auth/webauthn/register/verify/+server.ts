import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const result = await api('/auth/webauthn/register/verify', {
      method: 'POST',
      body,
      accessToken: locals.accessToken,
    });
    return json(result);
  } catch (e: unknown) {
    return json({ error: getErrorMessage(e) || 'Verification failed' }, { status: 500 });
  }
};
