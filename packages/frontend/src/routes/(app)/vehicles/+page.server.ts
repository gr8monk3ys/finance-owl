import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [vehicles, summary] = await Promise.all([
			api('/vehicles', { accessToken: locals.accessToken }),
			api('/vehicles/summary', { accessToken: locals.accessToken })
		]);

		return { vehicles, summary };
	} catch {
		return {
			vehicles: [],
			summary: {
				totalValue: 0,
				totalPurchasePrice: 0,
				totalDepreciation: 0,
				vehicleCount: 0
			}
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			year: parseInt(formData.get('year') as string),
			make: formData.get('make') as string,
			model: formData.get('model') as string,
			trim: (formData.get('trim') as string) || undefined,
			vin: (formData.get('vin') as string) || undefined,
			mileage: parseInt(formData.get('mileage') as string) || undefined,
			condition: (formData.get('condition') as string) || 'good',
			purchasePrice: parseFloat(formData.get('purchasePrice') as string) || undefined,
			purchaseDate: (formData.get('purchaseDate') as string) || undefined,
			currentEstimate: parseFloat(formData.get('currentEstimate') as string) || undefined,
			notes: (formData.get('notes') as string) || undefined
		};

		if (!data.year || !data.make || !data.model) {
			return fail(400, { error: 'Year, make, and model are required' });
		}

		try {
			await api('/vehicles', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to add vehicle' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/vehicles/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to delete vehicle' });
		}
	}
};
