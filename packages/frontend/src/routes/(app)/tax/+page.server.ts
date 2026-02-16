import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals, url }) => {
	const year = url.searchParams.get('year') || String(new Date().getFullYear());

	try {
		const [documents, summary, deductions] = await Promise.all([
			api(`/tax/documents?year=${year}`, { accessToken: locals.accessToken }),
			api(`/tax/summary/${year}`, { accessToken: locals.accessToken }),
			api(`/tax/deductions/${year}`, { accessToken: locals.accessToken })
		]);

		return { documents, summary, deductions, year: parseInt(year, 10) };
	} catch {
		return {
			documents: [],
			summary: {
				year: parseInt(year, 10),
				estimatedIncome: 0,
				estimatedDeductions: 0,
				estimatedTaxableIncome: 0,
				estimatedFederalTax: 0,
				estimatedStateTax: 0,
				filingStatus: 'single',
				generatedAt: null
			},
			deductions: [],
			year: parseInt(year, 10)
		};
	}
};

export const actions: Actions = {
	addDocument: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			year: parseInt(formData.get('year') as string, 10),
			type: formData.get('type') as string,
			description: formData.get('description') as string,
			amount: parseFloat(formData.get('amount') as string),
			isDeductible: formData.get('isDeductible') === 'on',
			category: formData.get('category') as string
		};

		if (!data.type || !data.amount || !data.year) {
			return fail(400, { error: 'Type, amount, and year are required' });
		}

		try {
			await api('/tax/documents', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to add document' });
		}
	},

	updateDocument: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data = {
			type: formData.get('type') as string,
			description: formData.get('description') as string,
			amount: parseFloat(formData.get('amount') as string),
			isDeductible: formData.get('isDeductible') === 'on',
			category: formData.get('category') as string
		};

		try {
			await api(`/tax/documents/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update document' });
		}
	},

	deleteDocument: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/tax/documents/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to delete document' });
		}
	},

	generateSummary: async ({ request, locals }) => {
		const formData = await request.formData();
		const year = formData.get('year') as string;

		try {
			await api(`/tax/summary/${year}/generate`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to generate summary' });
		}
	}
};
