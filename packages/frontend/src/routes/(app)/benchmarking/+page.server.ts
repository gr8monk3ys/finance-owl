import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const profile = await api('/benchmarking/profile', {
			accessToken: locals.accessToken
		});

		// Only fetch comparison data if the user has a profile
		if (profile) {
			const [comparison, benchmarks] = await Promise.all([
				api('/benchmarking/comparison', { accessToken: locals.accessToken }),
				api('/benchmarking/benchmarks', { accessToken: locals.accessToken })
			]);

			return { profile, comparison, benchmarks };
		}

		return { profile: null, comparison: [], benchmarks: null };
	} catch {
		return { profile: null, comparison: [], benchmarks: null };
	}
};

export const actions: Actions = {
	saveProfile: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			ageRange: formData.get('ageRange') as string,
			incomeRange: formData.get('incomeRange') as string,
			region: formData.get('region') as string,
			householdSize: parseInt(formData.get('householdSize') as string, 10) || 1,
			isOptedIn: formData.get('isOptedIn') === 'on'
		};

		if (!data.ageRange || !data.incomeRange) {
			return fail(400, { error: 'Age range and income range are required' });
		}

		try {
			await api('/benchmarking/profile', {
				method: 'PUT',
				body: data,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: any) {
			return fail(500, { error: e.message || 'Failed to save profile' });
		}
	}
};
