import type { PageServerLoad, Actions } from './$types';
import { api } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [score, history, factors, alerts, disputes, report] = await Promise.all([
			api('/credit/score', { accessToken: locals.accessToken }).catch(() => null),
			api('/credit/history?months=12', { accessToken: locals.accessToken }).catch(() => []),
			api('/credit/factors', { accessToken: locals.accessToken }).catch(() => []),
			api('/credit/alerts', { accessToken: locals.accessToken }).catch(() => []),
			api('/credit/disputes', { accessToken: locals.accessToken }).catch(() => []),
			api('/credit/report', { accessToken: locals.accessToken }).catch(() => null)
		]);

		return { score, history, factors, alerts, disputes, report };
	} catch {
		return {
			score: null,
			history: [],
			factors: [],
			alerts: [],
			disputes: [],
			report: null
		};
	}
};

export const actions: Actions = {
	addScore: async ({ request, locals }) => {
		const formData = await request.formData();
		const score = Number(formData.get('score'));
		const source = String(formData.get('source') || 'manual');
		const scoreType = String(formData.get('scoreType') || 'vantage3');

		if (!score || score < 300 || score > 850) {
			return fail(400, { error: 'Score must be between 300 and 850.' });
		}

		// Build factors from form data if provided
		const factorNames = [
			'payment_history',
			'credit_utilization',
			'credit_age',
			'total_accounts',
			'hard_inquiries',
			'derogatory_marks'
		];

		const factors: Array<{
			factor: string;
			value: string;
			impact: string;
			status: string;
		}> = [];

		for (const factorName of factorNames) {
			const value = formData.get(`factor_${factorName}_value`);
			const status = formData.get(`factor_${factorName}_status`);
			if (value && status) {
				const impact =
					factorName === 'payment_history'
						? 'high'
						: factorName === 'credit_utilization'
							? 'high'
							: factorName === 'credit_age' || factorName === 'total_accounts'
								? 'medium'
								: 'low';
				factors.push({
					factor: factorName,
					value: String(value),
					impact,
					status: String(status)
				});
			}
		}

		try {
			await api('/credit/score', {
				method: 'POST',
				accessToken: locals.accessToken,
				body: {
					score,
					source,
					scoreType,
					factors: factors.length > 0 ? factors : undefined
				}
			});

			return { success: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to add score.'
			});
		}
	},

	simulate: async ({ request, locals }) => {
		const formData = await request.formData();
		const scenario = String(formData.get('scenario'));
		const amount = formData.get('amount') ? Number(formData.get('amount')) : undefined;
		const currentUtilization = formData.get('currentUtilization')
			? Number(formData.get('currentUtilization'))
			: undefined;
		const targetUtilization = formData.get('targetUtilization')
			? Number(formData.get('targetUtilization'))
			: undefined;

		try {
			const result = await api('/credit/simulate', {
				method: 'POST',
				accessToken: locals.accessToken,
				body: {
					scenario,
					amount,
					currentUtilization,
					targetUtilization
				}
			});

			return { simulation: result };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Simulation failed.'
			});
		}
	},

	fileDispute: async ({ request, locals }) => {
		const formData = await request.formData();
		const accountId = String(formData.get('accountId') || '');
		const reason = String(formData.get('reason') || '');
		const explanation = String(formData.get('explanation') || '');

		if (!accountId || !reason || !explanation) {
			return fail(400, { error: 'Account, reason, and explanation are required.' });
		}

		try {
			const result = await api('/credit/disputes', {
				method: 'POST',
				accessToken: locals.accessToken,
				body: { accountId, reason, explanation }
			});

			return { disputeFiled: result };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to file dispute.'
			});
		}
	},

	markAlertRead: async ({ request, locals }) => {
		const formData = await request.formData();
		const alertId = String(formData.get('alertId') || '');

		if (!alertId) {
			return fail(400, { error: 'Alert ID is required.' });
		}

		try {
			await api(`/credit/alerts/${alertId}/read`, {
				method: 'PATCH',
				accessToken: locals.accessToken
			});

			return { alertMarked: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to mark alert as read.'
			});
		}
	},

	enableMonitoring: async ({ locals }) => {
		try {
			const result = await api('/credit/monitoring', {
				method: 'POST',
				accessToken: locals.accessToken
			});

			return { monitoringEnabled: result };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to enable monitoring.'
			});
		}
	}
};
