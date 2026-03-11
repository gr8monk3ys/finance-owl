import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [envelopes, summary, categories] = await Promise.all([
			api('/envelopes', { accessToken: locals.accessToken }),
			api('/envelopes/summary', { accessToken: locals.accessToken }),
			api('/categories', { accessToken: locals.accessToken })
		]);

		return { envelopes, summary, categories };
	} catch {
		return {
			envelopes: [],
			summary: {
				totalIncome: 0,
				totalAllocated: 0,
				unallocatedAmount: 0,
				totalSpent: 0,
				totalRemaining: 0,
				envelopeCount: 0,
				overBudgetCount: 0
			},
			categories: []
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data: Record<string, unknown> = {
			name: formData.get('name') as string,
			budgetedAmount: parseFloat(formData.get('budgetedAmount') as string) || 0,
			period: formData.get('period') as string,
			rollover: formData.get('rollover') === 'on',
			isGoal: formData.get('isGoal') === 'on',
			color: (formData.get('color') as string) || undefined,
			icon: (formData.get('icon') as string) || undefined
		};

		const categoryId = formData.get('categoryId') as string;
		if (categoryId) data.categoryId = categoryId;

		const targetAmount = formData.get('targetAmount') as string;
		if (targetAmount) data.targetAmount = parseFloat(targetAmount);

		if (!data.name) {
			return fail(400, { error: 'Envelope name is required' });
		}

		try {
			await api('/envelopes', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to create envelope' });
		}
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data: Record<string, unknown> = {};

		const name = formData.get('name') as string;
		if (name) data.name = name;

		const budgetedAmount = formData.get('budgetedAmount') as string;
		if (budgetedAmount) data.budgetedAmount = parseFloat(budgetedAmount);

		const color = formData.get('color') as string;
		if (color) data.color = color;

		data.rollover = formData.get('rollover') === 'on';
		data.isGoal = formData.get('isGoal') === 'on';

		const targetAmount = formData.get('targetAmount') as string;
		if (targetAmount) data.targetAmount = parseFloat(targetAmount);

		try {
			await api(`/envelopes/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to update envelope' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/envelopes/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to delete envelope' });
		}
	},

	allocate: async ({ request, locals }) => {
		const formData = await request.formData();
		const envelopeId = formData.get('envelopeId') as string;
		const amount = parseFloat(formData.get('amount') as string);

		if (!envelopeId || !amount || amount <= 0) {
			return fail(400, { error: 'Envelope and positive amount are required' });
		}

		try {
			await api('/envelopes/allocate', {
				method: 'POST',
				body: { allocations: [{ envelopeId, amount }] },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to allocate funds' });
		}
	},

	transfer: async ({ request, locals }) => {
		const formData = await request.formData();
		const fromEnvelopeId = formData.get('fromEnvelopeId') as string;
		const toEnvelopeId = formData.get('toEnvelopeId') as string;
		const amount = parseFloat(formData.get('amount') as string);

		if (!fromEnvelopeId || !toEnvelopeId || !amount || amount <= 0) {
			return fail(400, { error: 'Both envelopes and a positive amount are required' });
		}

		try {
			await api('/envelopes/transfer', {
				method: 'POST',
				body: { fromEnvelopeId, toEnvelopeId, amount },
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to transfer funds' });
		}
	},

	rollover: async ({ locals }) => {
		try {
			await api('/envelopes/rollover', {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to rollover envelopes' });
		}
	}
};
