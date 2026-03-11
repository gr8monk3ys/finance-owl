import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

interface NotificationPreferences {
	emailBillReminders: boolean;
	emailBudgetAlerts: boolean;
	emailAnomalies: boolean;
	emailWeeklyDigest: boolean;
	billReminderDaysBefore: number;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
	emailBillReminders: true,
	emailBudgetAlerts: true,
	emailAnomalies: true,
	emailWeeklyDigest: true,
	billReminderDaysBefore: 3
};

function parsePreferences(raw: Record<string, unknown> | null): NotificationPreferences {
	if (!raw) return DEFAULT_PREFERENCES;

	return {
		emailBillReminders: raw.emailBillReminders === 1 || raw.emailBillReminders === true,
		emailBudgetAlerts: raw.emailBudgetAlerts === 1 || raw.emailBudgetAlerts === true,
		emailAnomalies: raw.emailAnomalies === 1 || raw.emailAnomalies === true,
		emailWeeklyDigest: raw.emailWeeklyDigest === 1 || raw.emailWeeklyDigest === true,
		billReminderDaysBefore:
			typeof raw.billReminderDaysBefore === 'number' ? raw.billReminderDaysBefore : 3
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	let preferences = DEFAULT_PREFERENCES;

	try {
		const result = await api('/notifications/preferences', {
			accessToken: locals.accessToken
		});
		if (result) {
			preferences = parsePreferences(result);
		}
	} catch {
		// Preferences not yet created, use defaults
	}

	return { preferences };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const formData = await request.formData();

		const billReminderDaysRaw = parseInt(
			formData.get('billReminderDaysBefore')?.toString() || '3',
			10
		);
		const billReminderDaysBefore = Math.max(1, Math.min(7, billReminderDaysRaw));

		const body = {
			emailBillReminders: formData.get('emailBillReminders') === 'on',
			emailBudgetAlerts: formData.get('emailBudgetAlerts') === 'on',
			emailAnomalies: formData.get('emailAnomalies') === 'on',
			emailWeeklyDigest: formData.get('emailWeeklyDigest') === 'on',
			billReminderDaysBefore
		};

		try {
			await api('/notifications/preferences', {
				method: 'PUT',
				body,
				accessToken: locals.accessToken
			});
			return { success: true };
		} catch (e: unknown) {
			return fail(500, { error: getErrorMessage(e) || 'Failed to save notification preferences' });
		}
	}
};
