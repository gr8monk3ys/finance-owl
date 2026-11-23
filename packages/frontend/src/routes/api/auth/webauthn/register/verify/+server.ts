import type { RequestHandler } from './$types';
import { api } from '#lib/server/api.ts';
import { getErrorMessage } from '#lib/server/error.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const result = await api('/auth/webauthn/register/verify', {
      method: 'POST',
      body,
      accessToken: locals.accessToken,
    });
    return Response.json(result);
  } catch (e: unknown) {
    return Response.json({ error: getErrorMessage(e) || 'Verification failed' }, { status: 500 });
  }
};
