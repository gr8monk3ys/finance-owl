import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		const [article, related, progress] = await Promise.all([
			api(`/education/articles/${params.slug}`, {
				accessToken: locals.accessToken
			}),
			api(`/education/articles/${params.slug}/related`, {
				accessToken: locals.accessToken
			}).catch(() => []),
			api('/education/progress', { accessToken: locals.accessToken }).catch(() => ({
				articlesRead: 0,
				totalArticles: 0,
				bookmarked: 0,
				progress: []
			}))
		]);

		if (!article) {
			throw error(404, 'Article not found');
		}

		return { article, related, progress };
	} catch (err: unknown) {
		if (err instanceof Object && 'status' in err && err.status === 404) {
			throw error(404, 'Article not found');
		}
		throw error(500, 'Failed to load article');
	}
};

export const actions: Actions = {
	markRead: async ({ locals, params }) => {
		try {
			await api(`/education/progress/${params.slug}`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to mark as read'
			});
		}
	},

	bookmark: async ({ locals, params }) => {
		try {
			await api(`/education/bookmark/${params.slug}`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { bookmarked: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to toggle bookmark'
			});
		}
	}
};
