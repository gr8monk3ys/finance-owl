import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/api';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const options = await api('/auth/webauthn/register/options', {
			accessToken: locals.accessToken
		});
		return json(options);
	} catch (e: any) {
		return json({ error: e.message || 'Failed to get registration options' }, { status: 500 });
	}
};
