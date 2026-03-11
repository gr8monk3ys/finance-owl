import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals, url }) => {
	const category = url.searchParams.get('category') || '';
	const page = Number(url.searchParams.get('page')) || 1;

	try {
		const params = new URLSearchParams();
		if (category) params.set('category', category);
		params.set('page', String(page));
		params.set('limit', '20');

		const posts = await api(`/social/posts?${params.toString()}`, {
			accessToken: locals.accessToken
		});

		return { posts, category, page };
	} catch {
		return { posts: [], category, page };
	}
};

export const actions: Actions = {
	createPost: async ({ request, locals }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();
		const content = (formData.get('content') as string)?.trim();
		const category = formData.get('category') as string;
		const isAnonymous = formData.get('isAnonymous') === 'on';

		if (!title || !content || !category) {
			return fail(400, { error: 'Title, content, and category are required' });
		}

		try {
			await api('/social/posts', {
				method: 'POST',
				body: { title, content, category, isAnonymous },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to create post' });
		}
	},

	likePost: async ({ request, locals }) => {
		const formData = await request.formData();
		const postId = formData.get('postId') as string;

		try {
			await api(`/social/posts/${postId}/like`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to like post' });
		}
	},

	unlikePost: async ({ request, locals }) => {
		const formData = await request.formData();
		const postId = formData.get('postId') as string;

		try {
			await api(`/social/posts/${postId}/like`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to unlike post' });
		}
	},

	addReply: async ({ request, locals }) => {
		const formData = await request.formData();
		const postId = formData.get('postId') as string;
		const content = (formData.get('content') as string)?.trim();

		if (!content) {
			return fail(400, { error: 'Reply content is required' });
		}

		try {
			await api(`/social/posts/${postId}/replies`, {
				method: 'POST',
				body: { content },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to add reply' });
		}
	},

	deletePost: async ({ request, locals }) => {
		const formData = await request.formData();
		const postId = formData.get('postId') as string;

		try {
			await api(`/social/posts/${postId}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to delete post' });
		}
	}
};
