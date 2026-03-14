import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { API_URL } from '$lib/server/api';
import { buildForwardedClientHeaders, setAuthCookies } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;

		if (!name || !email || !password) {
			return fail(400, { error: 'All fields are required', name, email });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match', name, email });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', name, email });
		}

		try {
			const res = await fetch(`${API_URL}/api/auth/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...buildForwardedClientHeaders(request.headers, getClientAddress())
				},
				body: JSON.stringify({ name, email, password })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: 'Registration failed' }));
				return fail(res.status, { error: body.message || 'Registration failed', name, email });
			}

			const tokens = await res.json();
			setAuthCookies(cookies, tokens);
		} catch {
			return fail(500, { error: 'Network error. Is the API running?', name, email });
		}

		throw redirect(303, '/dashboard');
	}
};
