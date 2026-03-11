import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [propertiesList, vehiclesList, summary, accountsList] = await Promise.all([
			api('/assets/properties', { accessToken: locals.accessToken }),
			api('/assets/vehicles', { accessToken: locals.accessToken }),
			api('/assets/summary', { accessToken: locals.accessToken }),
			api('/accounts', { accessToken: locals.accessToken })
		]);

		// Filter accounts for mortgage/loan linking
		const loanAccounts = (accountsList || []).filter(
			(a: Record<string, unknown>) => a.type === 'mortgage' || a.type === 'loan'
		);

		return {
			properties: propertiesList || [],
			vehicles: vehiclesList || [],
			summary: summary || {
				totalPropertyValue: 0,
				totalVehicleValue: 0,
				totalAssetValue: 0,
				totalLinkedLoanBalance: 0,
				equity: 0,
				propertyCount: 0,
				vehicleCount: 0
			},
			loanAccounts
		};
	} catch {
		return {
			properties: [],
			vehicles: [],
			summary: {
				totalPropertyValue: 0,
				totalVehicleValue: 0,
				totalAssetValue: 0,
				totalLinkedLoanBalance: 0,
				equity: 0,
				propertyCount: 0,
				vehicleCount: 0
			},
			loanAccounts: []
		};
	}
};

export const actions: Actions = {
	createProperty: async ({ request, locals }) => {
		const formData = await request.formData();
		const data: Record<string, string | number> = {
			name: formData.get('name') as string,
			propertyType: formData.get('propertyType') as string,
			currentValue: parseFloat(formData.get('currentValue') as string)
		};

		if (!data.name || !data.currentValue) {
			return fail(400, { error: 'Name and current value are required' });
		}

		const optionalStrings = ['address', 'city', 'state', 'zipCode', 'purchaseDate', 'mortgageAccountId', 'notes'];
		for (const key of optionalStrings) {
			const val = formData.get(key) as string;
			if (val) data[key] = val;
		}

		const optionalNumbers = ['purchasePrice', 'monthlyRent', 'annualPropertyTax', 'annualInsurance'];
		for (const key of optionalNumbers) {
			const val = formData.get(key) as string;
			if (val) data[key] = parseFloat(val);
		}

		try {
			await api('/assets/properties', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to create property' });
		}
	},

	updateProperty: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data: Record<string, string | number> = {};

		const optionalStrings = [
			'name', 'address', 'city', 'state', 'zipCode', 'propertyType',
			'purchaseDate', 'mortgageAccountId', 'notes'
		];
		for (const key of optionalStrings) {
			const val = formData.get(key) as string;
			if (val !== null && val !== '') data[key] = val;
		}

		const optionalNumbers = [
			'purchasePrice', 'currentValue', 'monthlyRent',
			'annualPropertyTax', 'annualInsurance'
		];
		for (const key of optionalNumbers) {
			const val = formData.get(key) as string;
			if (val !== null && val !== '') data[key] = parseFloat(val);
		}

		try {
			await api(`/assets/properties/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to update property' });
		}
	},

	deleteProperty: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/assets/properties/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to delete property' });
		}
	},

	estimateProperty: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/assets/properties/${id}/estimate`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to estimate property value' });
		}
	},

	createVehicle: async ({ request, locals }) => {
		const formData = await request.formData();
		const data: Record<string, string | number> = {
			make: formData.get('make') as string,
			model: formData.get('model') as string,
			year: parseInt(formData.get('year') as string),
			condition: formData.get('condition') as string,
			currentValue: parseFloat(formData.get('currentValue') as string)
		};

		if (!data.make || !data.model || !data.year || !data.currentValue) {
			return fail(400, { error: 'Make, model, year, and current value are required' });
		}

		const optionalStrings = ['trim', 'vin', 'purchaseDate', 'loanAccountId', 'notes'];
		for (const key of optionalStrings) {
			const val = formData.get(key) as string;
			if (val) data[key] = val;
		}

		const optionalNumbers = ['mileage', 'purchasePrice', 'monthlyPayment', 'annualInsurance'];
		for (const key of optionalNumbers) {
			const val = formData.get(key) as string;
			if (val) data[key] = parseFloat(val);
		}

		// mileage should be integer
		if (data.mileage) data.mileage = Math.round(data.mileage as number);

		try {
			await api('/assets/vehicles', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to create vehicle' });
		}
	},

	updateVehicle: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data: Record<string, string | number> = {};

		const optionalStrings = [
			'make', 'model', 'trim', 'vin', 'condition',
			'purchaseDate', 'loanAccountId', 'notes'
		];
		for (const key of optionalStrings) {
			const val = formData.get(key) as string;
			if (val !== null && val !== '') data[key] = val;
		}

		const optionalNumbers = [
			'purchasePrice', 'currentValue', 'monthlyPayment', 'annualInsurance'
		];
		for (const key of optionalNumbers) {
			const val = formData.get(key) as string;
			if (val !== null && val !== '') data[key] = parseFloat(val);
		}

		const yearVal = formData.get('year') as string;
		if (yearVal) data.year = parseInt(yearVal);

		const mileageVal = formData.get('mileage') as string;
		if (mileageVal) data.mileage = Math.round(parseFloat(mileageVal));

		try {
			await api(`/assets/vehicles/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to update vehicle' });
		}
	},

	deleteVehicle: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/assets/vehicles/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to delete vehicle' });
		}
	},

	estimateVehicle: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/assets/vehicles/${id}/estimate`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to estimate vehicle value' });
		}
	}
};
