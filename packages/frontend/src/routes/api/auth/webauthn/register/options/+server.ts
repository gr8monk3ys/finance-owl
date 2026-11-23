import type { RequestHandler } from './$types';
import { api } from '#lib/server/api.ts';
import { getErrorMessage } from '#lib/server/error.ts';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const options = await api('/auth/webauthn/register/options', {
      accessToken: locals.accessToken,
    });
    return Response.json(options);
  } catch (e: unknown) {
    return Response.json(
      { error: getErrorMessage(e) || 'Failed to get registration options' },
      { status: 500 },
    );
  }
};
