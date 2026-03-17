import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { api } from '$lib/server/api';

export const actions: Actions = {
	contact: async ({ request, locals }) => {
		const formData = await request.formData();
		const subject = formData.get('subject')?.toString().trim();
		const category = formData.get('category')?.toString().trim();
		const message = formData.get('message')?.toString().trim();

		if (!subject || subject.length < 3) {
			return fail(400, {
				error: 'Subject must be at least 3 characters.',
				subject,
				category,
				message
			});
		}

		if (!category) {
			return fail(400, {
				error: 'Please select a category.',
				subject,
				category,
				message
			});
		}

		if (!message || message.length < 10) {
			return fail(400, {
				error: 'Message must be at least 10 characters.',
				subject,
				category,
				message
			});
		}

		if (message.length > 5000) {
			return fail(400, {
				error: 'Message must be under 5,000 characters.',
				subject,
				category,
				message
			});
		}

		try {
			const result = await api('/support/tickets', {
				method: 'POST',
				body: {
					email: locals.user?.email ?? '',
					subject,
					category,
					message
				},
				accessToken: locals.accessToken
			});

			return {
				success: true,
				message: result?.message ?? "Your request has been submitted. We'll respond via email."
			};
		} catch (err) {
			console.error('[Support] Failed to submit ticket:', err);
			return fail(500, {
				error: 'Something went wrong submitting your request. Please try again later.',
				subject,
				category,
				message
			});
		}
	}
};
