import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [goals, summary] = await Promise.all([
			api('/savings-goals', { accessToken: locals.accessToken }),
			api('/savings-goals/summary', { accessToken: locals.accessToken })
		]);

		return { goals, summary };
	} catch {
		return {
			goals: [],
			summary: {
				totalSaved: 0,
				totalTarget: 0,
				activeGoals: 0,
				completedGoals: 0,
				savingsRate: 0
			}
		};
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name') as string,
			targetAmount: parseFloat(formData.get('targetAmount') as string),
			deadline: (formData.get('deadline') as string) || undefined,
			icon: (formData.get('icon') as string) || undefined,
			color: (formData.get('color') as string) || undefined
		};

		if (!data.name || !data.targetAmount) {
			return fail(400, { error: 'Name and target amount are required' });
		}

		try {
			await api('/savings-goals', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to create savings goal' });
		}
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data: Record<string, any> = {};

		const name = formData.get('name') as string;
		if (name) data.name = name;

		const targetAmount = formData.get('targetAmount') as string;
		if (targetAmount) data.targetAmount = parseFloat(targetAmount);

		const deadline = formData.get('deadline') as string;
		if (deadline) data.deadline = deadline;

		const icon = formData.get('icon') as string;
		if (icon) data.icon = icon;

		const color = formData.get('color') as string;
		if (color) data.color = color;

		try {
			await api(`/savings-goals/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update savings goal' });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/savings-goals/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to delete savings goal' });
		}
	},

	contribute: async ({ request, locals }) => {
		const formData = await request.formData();
		const goalId = formData.get('goalId') as string;
		const data = {
			amount: parseFloat(formData.get('amount') as string),
			note: (formData.get('note') as string) || undefined,
			date: (formData.get('date') as string) || undefined
		};

		if (!data.amount || data.amount <= 0) {
			return fail(400, { error: 'A valid contribution amount is required' });
		}

		try {
			await api(`/savings-goals/${goalId}/contributions`, {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to add contribution' });
		}
	},

	removeContribution: async ({ request, locals }) => {
		const formData = await request.formData();
		const goalId = formData.get('goalId') as string;
		const contributionId = formData.get('contributionId') as string;

		try {
			await api(`/savings-goals/${goalId}/contributions/${contributionId}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to remove contribution' });
		}
	}
};
