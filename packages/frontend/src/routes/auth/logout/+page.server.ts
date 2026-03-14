import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { API_URL } from '$lib/server/api';

export const actions: Actions = {
	default: async ({ cookies }) => {
		const refreshToken = cookies.get('refresh_token');

		if (refreshToken) {
			try {
				await fetch(`${API_URL}/api/auth/logout`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ refreshToken })
				});
			} catch {
				// Ignore - we're logging out anyway
			}
		}

		cookies.delete('access_token', { path: '/' });
		cookies.delete('refresh_token', { path: '/' });

		throw redirect(303, '/auth/login');
	}
};
