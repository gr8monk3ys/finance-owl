import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [properties, summary] = await Promise.all([
			api('/real-estate', { accessToken: locals.accessToken }),
			api('/real-estate/summary', { accessToken: locals.accessToken })
		]);

		return { properties, summary };
	} catch {
		return {
			properties: [],
			summary: {
				totalValue: 0,
				totalPurchasePrice: 0,
				totalEquity: 0,
				propertyCount: 0
			}
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			address: formData.get('address') as string,
			city: formData.get('city') as string,
			state: formData.get('state') as string,
			zipCode: formData.get('zipCode') as string,
			propertyType: formData.get('propertyType') as string,
			bedrooms: parseInt(formData.get('bedrooms') as string) || undefined,
			bathrooms: parseFloat(formData.get('bathrooms') as string) || undefined,
			squareFeet: parseInt(formData.get('squareFeet') as string) || undefined,
			yearBuilt: parseInt(formData.get('yearBuilt') as string) || undefined,
			purchasePrice: parseFloat(formData.get('purchasePrice') as string) || undefined,
			purchaseDate: (formData.get('purchaseDate') as string) || undefined,
			currentEstimate: parseFloat(formData.get('currentEstimate') as string) || undefined,
			notes: (formData.get('notes') as string) || undefined
		};

		if (!data.address || !data.city || !data.state || !data.zipCode) {
			return fail(400, { error: 'Address, city, state, and zip code are required' });
		}

		try {
			await api('/real-estate', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to add property' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/real-estate/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to delete property' });
		}
	}
};
