import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { api } from '$lib/server/api';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const body = await request.json();
		const result = await api('/auth/webauthn/register/verify', {
			method: 'POST',
			body,
			accessToken: locals.accessToken
		});
		return json(result);
	} catch (e: any) {
		return json({ error: e.message || 'Verification failed' }, { status: 500 });
	}
};
