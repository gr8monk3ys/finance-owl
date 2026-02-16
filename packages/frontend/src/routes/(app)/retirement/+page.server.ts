import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [profile, projection] = await Promise.all([
			api('/retirement/profile', { accessToken: locals.accessToken }),
			api('/retirement/projection', { accessToken: locals.accessToken })
		]);

		return { profile, projection };
	} catch {
		return {
			profile: {
				currentAge: 30,
				retirementAge: 65,
				currentSavings: 0,
				monthlyContribution: 500,
				employerMatch: 0,
				expectedReturn: 7,
				inflationRate: 3,
				desiredMonthlyIncome: 5000,
				socialSecurityEstimate: 0,
				pensionAmount: 0,
				riskTolerance: 'moderate'
			},
			projection: null
		};
	}
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const formData = await request.formData();
		const data: Record<string, number | string> = {};

		const fields = [
			'currentAge',
			'retirementAge',
			'currentSavings',
			'monthlyContribution',
			'employerMatch',
			'expectedReturn',
			'inflationRate',
			'desiredMonthlyIncome',
			'socialSecurityEstimate',
			'pensionAmount'
		];

		for (const field of fields) {
			const val = formData.get(field) as string;
			if (val !== null && val !== '') {
				data[field] = parseFloat(val);
			}
		}

		const riskTolerance = formData.get('riskTolerance') as string;
		if (riskTolerance) {
			data.riskTolerance = riskTolerance;
		}

		try {
			await api('/retirement/profile', {
				method: 'PATCH',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to update profile' });
		}
	},

	analyzeFees: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			currentBalance: parseFloat(formData.get('currentBalance') as string),
			annualFeePercent: parseFloat(formData.get('annualFeePercent') as string),
			yearsToRetirement: parseFloat(formData.get('yearsToRetirement') as string)
		};

		if (isNaN(data.currentBalance) || isNaN(data.annualFeePercent) || isNaN(data.yearsToRetirement)) {
			return fail(400, { feeError: 'All fee analysis fields are required' });
		}

		try {
			const result = await api('/retirement/fee-analysis', {
				method: 'POST',
				body: data,
				accessToken: locals.accessToken
			});
			return { feeAnalysis: result };
		} catch (e: any) {
			return fail(500, { feeError: e.message || 'Fee analysis failed' });
		}
	},

	compareScenarios: async ({ request, locals }) => {
		const formData = await request.formData();
		const scenariosRaw = formData.get('scenarios') as string;

		try {
			const scenarios = JSON.parse(scenariosRaw);
			const result = await api('/retirement/compare', {
				method: 'POST',
				body: { scenarios },
				accessToken: locals.accessToken
			});
			return { scenarioResults: result };
		} catch (e: any) {
			return fail(500, { scenarioError: e.message || 'Scenario comparison failed' });
		}
	}
};
