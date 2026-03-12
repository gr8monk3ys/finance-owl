import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { buildForwardedClientHeaders, setAuthCookies } from '$lib/server/auth';

const API_URL = process.env.API_URL || 'http://localhost:4000';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}

	// Check if first run
	try {
		const res = await fetch(`${API_URL}/api/auth/first-run`);
		if (res.ok) {
			const data = await res.json();
			if (data.isFirstRun) {
				throw redirect(303, '/auth/setup');
			}
		}
	} catch (e) {
		if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) throw e;
	}
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const totpCode = data.get('totpCode') as string | null;

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required', email });
		}

		try {
			const res = await fetch(`${API_URL}/api/auth/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...buildForwardedClientHeaders(request.headers, getClientAddress())
				},
				body: JSON.stringify({ email, password, ...(totpCode ? { totpCode } : {}) })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: 'Login failed' }));
				return fail(res.status, {
					error: body.message || 'Login failed',
					code: body.code,
					email
				});
			}

			const tokens = await res.json();
			setAuthCookies(cookies, tokens);
		} catch {
			return fail(500, { error: 'Network error. Is the API running?', email });
		}

		throw redirect(303, '/dashboard');
	}
};
