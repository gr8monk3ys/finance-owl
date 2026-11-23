import type { RequestHandler } from './$types';
import { api } from '#lib/server/api.ts';
import { getErrorMessage } from '#lib/server/error.ts';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const { symbol } = params;
  const days = url.searchParams.get('days') || '30';

  try {
    const result = await api(
      `/crypto/price-history/${encodeURIComponent(symbol)}?days=${encodeURIComponent(days)}`,
      {
        accessToken: locals.accessToken,
      },
    );
    return Response.json(result);
  } catch (e: unknown) {
    return Response.json(
      { prices: [], error: getErrorMessage(e) || 'Failed to fetch price history' },
      { status: 500 },
    );
  }
};
