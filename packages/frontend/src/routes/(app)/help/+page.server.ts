import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

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
			// In production, this would send to a support system (e.g., Zendesk, email API, or internal ticket system)
			// For now, log and simulate success
			console.log('[Support] New contact form submission:', {
				userId: locals.user?.id,
				userEmail: locals.user?.email,
				subject,
				category,
				messageLength: message.length,
				timestamp: new Date().toISOString()
			});

			// Simulate a small delay as if sending
			await new Promise((resolve) => setTimeout(resolve, 300));

			return {
				success: true,
				message: 'Your message has been sent. We typically respond within 24 hours.'
			};
		} catch (err) {
			console.error('[Support] Failed to send contact form:', err);
			return fail(500, {
				error: 'Failed to send your message. Please try again or email us at support@financeowl.com.',
				subject,
				category,
				message
			});
		}
	}
};
