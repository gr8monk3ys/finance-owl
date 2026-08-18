import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { symbol } = params;
	const days = url.searchParams.get('days') || '30';

	try {
		const result = await api(
			`/crypto/price-history/${encodeURIComponent(symbol)}?days=${encodeURIComponent(days)}`,
			{
				accessToken: locals.accessToken
			}
		);
		return json(result);
	} catch (e: unknown) {
		return json({ prices: [], error: getErrorMessage(e) || 'Failed to fetch price history' }, { status: 500 });
	}
};
