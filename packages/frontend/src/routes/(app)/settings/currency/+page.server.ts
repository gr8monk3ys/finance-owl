import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

interface CurrencyPreferences {
	defaultCurrency: string;
	displayFormat: string;
}

interface SupportedCurrency {
	code: string;
	name: string;
	symbol: string;
}

interface ExchangeRate {
	baseCurrency: string;
	targetCurrency: string;
	rate: number;
	source: string;
	fetchedAt: string;
}

const DEFAULT_PREFERENCES: CurrencyPreferences = {
	defaultCurrency: 'USD',
	displayFormat: 'symbol'
};

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [preferences, supported, ratesData] = await Promise.all([
			api('/currency/preferences', { accessToken: locals.accessToken }),
			api('/currency/supported', { accessToken: locals.accessToken }),
			api('/currency/rates?base=USD', { accessToken: locals.accessToken })
		]);

		return {
			preferences: (preferences as CurrencyPreferences) ?? DEFAULT_PREFERENCES,
			supported: (supported as SupportedCurrency[]) ?? [],
			rates: (ratesData?.rates as ExchangeRate[]) ?? []
		};
	} catch {
		return {
			preferences: DEFAULT_PREFERENCES,
			supported: [],
			rates: []
		};
	}
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const formData = await request.formData();
		const defaultCurrency = formData.get('defaultCurrency') as string;
		const displayFormat = formData.get('displayFormat') as string;

		if (!defaultCurrency || !displayFormat) {
			return fail(400, { error: 'Currency and display format are required' });
		}

		try {
			await api('/currency/preferences', {
				method: 'PATCH',
				body: { defaultCurrency, displayFormat },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to save currency preferences' });
		}
	},

	refresh: async ({ locals }) => {
		try {
			await api('/currency/refresh', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { refreshed: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to refresh exchange rates' });
		}
	}
};
