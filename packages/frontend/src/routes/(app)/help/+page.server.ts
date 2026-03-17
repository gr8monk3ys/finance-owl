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

		console.warn('[Support] Contact form submission rejected because direct support delivery is not configured.', {
			userId: locals.user?.id,
			userEmail: locals.user?.email,
			subject,
			category,
			messageLength: message.length
		});

		return fail(503, {
			error: 'Direct ticket submission is not configured in this deployment. Use the public support page instead.',
			subject,
			category,
			message
		});
	}
};
