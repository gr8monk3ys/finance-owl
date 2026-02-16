import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [debtList, summary] = await Promise.all([
			api('/debt-payoff', { accessToken: locals.accessToken }),
			api('/debt-payoff/summary', { accessToken: locals.accessToken })
		]);

		return { debts: debtList, summary };
	} catch {
		return {
			debts: [],
			summary: {
				totalDebt: 0,
				totalMinimumPayments: 0,
				weightedAvgRate: 0,
				activeDebts: 0,
				paidOffDebts: 0,
				estimatedPayoffDate: '',
				estimatedPayoffMonths: 0,
				snowballPayoffDate: '',
				snowballPayoffMonths: 0
			}
		};
	}
};

export const actions: Actions = {
	addDebt: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name') as string,
			type: formData.get('type') as string,
			currentBalance: parseFloat(formData.get('currentBalance') as string),
			interestRate: parseFloat(formData.get('interestRate') as string),
			minimumPayment: parseFloat(formData.get('minimumPayment') as string),
			originalBalance: formData.get('originalBalance')
				? parseFloat(formData.get('originalBalance') as string)
				: undefined,
			lender: (formData.get('lender') as string) || undefined,
			dueDay: formData.get('dueDay')
				? parseInt(formData.get('dueDay') as string, 10)
				: undefined
		};

		if (!data.name || !data.type || !data.currentBalance || data.interestRate === undefined) {
			return fail(400, { error: 'Name, type, balance, and interest rate are required' });
		}

		try {
			await api('/debt-payoff', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to add debt' });
		}
	},

	updateDebt: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const data: Record<string, any> = {};

		const name = formData.get('name') as string;
		if (name) data.name = name;

		const type = formData.get('type') as string;
		if (type) data.type = type;

		const currentBalance = formData.get('currentBalance') as string;
		if (currentBalance) data.currentBalance = parseFloat(currentBalance);

		const interestRate = formData.get('interestRate') as string;
		if (interestRate) data.interestRate = parseFloat(interestRate);

		const minimumPayment = formData.get('minimumPayment') as string;
		if (minimumPayment) data.minimumPayment = parseFloat(minimumPayment);

		const lender = formData.get('lender') as string;
		if (lender) data.lender = lender;

		const dueDay = formData.get('dueDay') as string;
		if (dueDay) data.dueDay = parseInt(dueDay, 10);

		try {
			await api(`/debt-payoff/${id}`, {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update debt' });
		}
	},

	deleteDebt: async ({ request, locals }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		try {
			await api(`/debt-payoff/${id}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to delete debt' });
		}
	},

	recordPayment: async ({ request, locals }) => {
		const formData = await request.formData();
		const debtId = formData.get('debtId') as string;
		const data = {
			amount: parseFloat(formData.get('amount') as string),
			date: (formData.get('date') as string) || undefined,
			isExtra: formData.get('isExtra') === 'on',
			notes: (formData.get('notes') as string) || undefined
		};

		if (!data.amount || data.amount <= 0) {
			return fail(400, { error: 'A valid payment amount is required' });
		}

		try {
			await api(`/debt-payoff/${debtId}/payments`, {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to record payment' });
		}
	},

	loadPayments: async ({ request, locals }) => {
		const formData = await request.formData();
		const debtId = formData.get('debtId') as string;

		try {
			const payments = await api(`/debt-payoff/${debtId}/payments`, {
				accessToken: locals.accessToken
			});
			return { success: true, payments, viewDebtId: debtId };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to load payments' });
		}
	},

	calculatePayoff: async ({ request, locals }) => {
		const formData = await request.formData();
		const strategy = formData.get('strategy') as string;
		const extraMonthlyPayment = parseFloat(
			(formData.get('extraMonthlyPayment') as string) || '0'
		);

		try {
			const [plan, comparison] = await Promise.all([
				api('/debt-payoff/calculate', {
					method: 'POST',
					body: { strategy, extraMonthlyPayment },
					accessToken: locals.accessToken
				}),
				api(`/debt-payoff/compare?extraPayment=${extraMonthlyPayment}`, {
					accessToken: locals.accessToken
				})
			]);

			return { success: true, plan, comparison };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to calculate payoff plan' });
		}
	}
};
