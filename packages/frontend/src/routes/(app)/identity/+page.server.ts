import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [breachesList, summary, monitoredEmails] = await Promise.all([
			api('/identity/breaches', { accessToken: locals.accessToken }),
			api('/identity/summary', { accessToken: locals.accessToken }),
			api('/identity/monitored-emails', { accessToken: locals.accessToken })
		]);

		return {
			breaches: breachesList ?? [],
			summary: summary ?? {
				totalBreaches: 0,
				unacknowledged: 0,
				mostRecent: null,
				dataTypesExposed: [],
				severity: 'none',
				lastCheckDate: null
			},
			monitoredEmails: monitoredEmails ?? []
		};
	} catch {
		return {
			breaches: [],
			summary: {
				totalBreaches: 0,
				unacknowledged: 0,
				mostRecent: null,
				dataTypesExposed: [],
				severity: 'none',
				lastCheckDate: null
			},
			monitoredEmails: []
		};
	}
};

export const actions: Actions = {
	addEmail: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		try {
			await api('/identity/monitored-emails', {
				method: 'POST',
				body: { email },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to add email' });
		}
	},

	removeEmail: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Email ID is required' });
		}

		try {
			await api(`/identity/monitored-emails/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to remove email' });
		}
	},

	checkEmail: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		try {
			const result = await api('/identity/check-email', {
				method: 'POST',
				body: { email },
				accessToken: locals.accessToken
			});
			return { success: true, checkResult: result };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to check email' });
		}
	},

	checkPassword: async ({ request, locals }) => {
		const formData = await request.formData();
		const sha1Hash = formData.get('sha1Hash') as string;

		if (!sha1Hash || sha1Hash.length !== 40) {
			return fail(400, { error: 'Valid SHA1 hash is required' });
		}

		try {
			const result = await api('/identity/check-password', {
				method: 'POST',
				body: { sha1Hash },
				accessToken: locals.accessToken
			});
			return { success: true, passwordResult: result };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to check password' });
		}
	},

	acknowledge: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Breach ID is required' });
		}

		try {
			await api(`/identity/breaches/${id}/acknowledge`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to acknowledge breach' });
		}
	},

	runCheck: async ({ locals }) => {
		try {
			const result = await api('/identity/run-check', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true, runResult: result };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to run check' });
		}
	}
};
