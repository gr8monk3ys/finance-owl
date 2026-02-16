import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const API_URL = process.env.API_URL || 'http://localhost:4000';

export const load: PageServerLoad = async () => {
	try {
		const res = await fetch(`${API_URL}/api/auth/first-run`);
		if (res.ok) {
			const data = await res.json();
			if (!data.isFirstRun) {
				throw redirect(303, '/auth/login');
			}
		}
	} catch (e) {
		if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) throw e;
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
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
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, password })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: 'Setup failed' }));
				return fail(res.status, { error: body.message, name, email });
			}

			const tokens = await res.json();

			cookies.set('access_token', tokens.accessToken, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 15
			});

			cookies.set('refresh_token', tokens.refreshToken, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7
			});
		} catch (e) {
			if (e instanceof Response || (e && typeof e === 'object' && 'status' in e)) throw e;
			return fail(500, { error: 'Network error. Is the API running?', name, email });
		}

		throw redirect(303, '/dashboard');
	}
};
