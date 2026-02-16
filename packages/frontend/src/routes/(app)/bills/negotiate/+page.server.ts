import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [negotiations, summary, expiring, providers] = await Promise.all([
			api('/bill-negotiation', { accessToken: locals.accessToken }).catch(() => []),
			api('/bill-negotiation/summary', { accessToken: locals.accessToken }).catch(() => ({
				totalAnnualSavings: 0,
				totalMonthlySavings: 0,
				successfulNegotiations: 0,
				totalNegotiations: 0,
				successRate: 0,
				byCategory: []
			})),
			api('/bill-negotiation/expiring?days=90', { accessToken: locals.accessToken }).catch(
				() => []
			),
			api('/bill-negotiation/providers', { accessToken: locals.accessToken }).catch(() => ({}))
		]);

		return { negotiations, summary, expiring, providers };
	} catch {
		return {
			negotiations: [],
			summary: {
				totalAnnualSavings: 0,
				totalMonthlySavings: 0,
				successfulNegotiations: 0,
				totalNegotiations: 0,
				successRate: 0,
				byCategory: []
			},
			expiring: [],
			providers: {}
		};
	}
};

export const actions: Actions = {
	analyze: async ({ locals }) => {
		try {
			const analysis = await api('/bill-negotiation/analyze', {
				accessToken: locals.accessToken
			});
			return { success: true, analysis };
		} catch (e) {
			return fail(500, { error: 'Failed to analyze bills' });
		}
	},

	startNegotiation: async ({ request, locals }) => {
		const formData = await request.formData();
		const billName = formData.get('billName') as string;
		const provider = formData.get('provider') as string;
		const currentAmount = Number(formData.get('currentAmount'));
		const targetAmount = Number(formData.get('targetAmount'));
		const category = formData.get('category') as string;
		const notes = (formData.get('notes') as string) || undefined;

		try {
			await api('/bill-negotiation', {
				method: 'POST',
				body: { billName, provider, currentAmount, targetAmount, category, notes },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: 'Failed to start negotiation' });
		}
	},

	updateResult: async ({ request, locals }) => {
		const formData = await request.formData();
		const negotiationId = formData.get('negotiationId') as string;
		const status = formData.get('status') as string;
		const negotiatedAmount = formData.get('negotiatedAmount')
			? Number(formData.get('negotiatedAmount'))
			: undefined;
		const expirationDate = (formData.get('expirationDate') as string) || undefined;
		const notes = (formData.get('notes') as string) || undefined;

		try {
			await api(`/bill-negotiation/${negotiationId}`, {
				method: 'PATCH',
				body: { status, negotiatedAmount, expirationDate, notes },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e) {
			return fail(500, { error: 'Failed to update negotiation result' });
		}
	},

	getScript: async ({ request, locals }) => {
		const formData = await request.formData();
		const provider = formData.get('provider') as string;
		const category = (formData.get('category') as string) || 'other';
		const currentAmount = formData.get('currentAmount') as string;
		const targetAmount = formData.get('targetAmount') as string;

		try {
			const script = await api(
				`/bill-negotiation/script/${encodeURIComponent(provider)}?category=${category}&currentAmount=${currentAmount}&targetAmount=${targetAmount}`,
				{ accessToken: locals.accessToken }
			);
			return { success: true, script };
		} catch (e) {
			return fail(500, { error: 'Failed to get negotiation script' });
		}
	}
};
