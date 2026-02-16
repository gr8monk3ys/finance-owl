import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/api';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { symbol } = params;
	const days = url.searchParams.get('days') || '30';

	try {
		const result = await api(`/crypto/price-history/${symbol}?days=${days}`, {
			accessToken: locals.accessToken
		});
		return json(result);
	} catch (e: any) {
		return json({ prices: [], error: e.message || 'Failed to fetch price history' }, { status: 500 });
	}
};
