import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
  const topic = url.searchParams.get('topic') || undefined;
  const difficulty = url.searchParams.get('difficulty') || undefined;
  const search = url.searchParams.get('search') || undefined;

  try {
    const params = new URLSearchParams();
    if (topic) params.set('topic', topic);
    if (difficulty) params.set('difficulty', difficulty);
    if (search) params.set('search', search);

    const queryString = params.toString();
    const articlesUrl = `/education/articles${queryString ? `?${queryString}` : ''}`;

    const [topics, articles, recommended, progress] = await Promise.all([
      api('/education/topics', { accessToken: locals.accessToken }).catch(() => []),
      api(articlesUrl, { accessToken: locals.accessToken }).catch(() => []),
      api('/education/recommended', { accessToken: locals.accessToken }).catch(() => []),
      api('/education/progress', { accessToken: locals.accessToken }).catch(() => ({
        articlesRead: 0,
        totalArticles: 0,
        bookmarked: 0,
        progress: [],
      })),
    ]);

    return {
      topics,
      articles,
      recommended,
      progress,
      filters: { topic, difficulty, search },
    };
  } catch {
    return {
      topics: [],
      articles: [],
      recommended: [],
      progress: { articlesRead: 0, totalArticles: 0, bookmarked: 0, progress: [] },
      filters: { topic, difficulty, search },
    };
  }
};

export const actions: Actions = {
  bookmark: async ({ request, locals }) => {
    const formData = await request.formData();
    const slug = String(formData.get('slug'));

    if (!slug) {
      return fail(400, { error: 'Article slug is required' });
    }

    try {
      await api(`/education/bookmark/${slug}`, {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to toggle bookmark',
      });
    }
  },
};
