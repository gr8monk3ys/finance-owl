import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals, url }) => {
	const category = url.searchParams.get('category') || '';
	const sort = url.searchParams.get('sort') || 'rating';

	try {
		const queryParams = new URLSearchParams();
		if (category) queryParams.set('category', category);
		if (sort) queryParams.set('sort', sort);
		const queryString = queryParams.toString();

		const [products, recommendations, popular] = await Promise.all([
			api(`/marketplace/products${queryString ? `?${queryString}` : ''}`, {
				accessToken: locals.accessToken
			}),
			api('/marketplace/recommendations', { accessToken: locals.accessToken }),
			api('/marketplace/popular', { accessToken: locals.accessToken })
		]);

		return { products, recommendations, popular, category, sort };
	} catch {
		return {
			products: [],
			recommendations: [],
			popular: [],
			category,
			sort
		};
	}
};

export const actions: Actions = {
	trackClick: async ({ request, locals }) => {
		const formData = await request.formData();
		const productId = formData.get('productId') as string;

		try {
			await api(`/marketplace/products/${productId}/click`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to track click' });
		}
	}
};
