import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api, API_URL } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [accounts, formats, history] = await Promise.all([
			api('/accounts', { accessToken: locals.accessToken }),
			api('/import/formats', { accessToken: locals.accessToken }),
			api('/import/history', { accessToken: locals.accessToken })
		]);

		return { accounts, formats, history };
	} catch {
		return {
			accounts: [],
			formats: [],
			history: []
		};
	}
};

export const actions: Actions = {
	upload: async ({ request, locals, fetch: _fetch }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;

		if (!file || file.size === 0) {
			return fail(400, { error: 'Please select a file to upload' });
		}

		const allowedExtensions = ['.csv', '.ofx', '.qfx'];
		const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
		if (!allowedExtensions.includes(ext)) {
			return fail(400, { error: 'Only .csv, .ofx, and .qfx files are supported' });
		}

		if (file.size > 10 * 1024 * 1024) {
			return fail(400, { error: 'File size must be less than 10MB' });
		}

		try {
			const uploadForm = new FormData();
			uploadForm.append('file', file);

			const res = await fetch(`${API_URL}/api/import/upload`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${locals.accessToken}`
				},
				body: uploadForm
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Upload failed' }));
				return fail(res.status, { error: err.message || 'Upload failed' });
			}

			const result = await res.json();
			return {
				success: true,
				uploadResult: result
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to upload file';
			return fail(500, { error: message });
		}
	},

	preview: async ({ request, locals }) => {
		const formData = await request.formData();
		const accountId = formData.get('accountId') as string;
		const transactionsJson = formData.get('transactions') as string;

		if (!accountId) {
			return fail(400, { error: 'Please select an account' });
		}

		try {
			const transactions = JSON.parse(transactionsJson);
			const result = await api('/import/preview', {
				method: 'POST',
				body: { accountId, transactions },
				accessToken: locals.accessToken
			});

			return {
				success: true,
				previewResult: result,
				accountId
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to generate preview';
			return fail(500, { error: message });
		}
	},

	execute: async ({ request, locals }) => {
		const formData = await request.formData();
		const accountId = formData.get('accountId') as string;
		const transactionsJson = formData.get('transactions') as string;
		const fileName = formData.get('fileName') as string;
		const fileType = formData.get('fileType') as string;
		const skipDuplicates = formData.get('skipDuplicates') === 'true';
		const columnMappingJson = formData.get('columnMapping') as string;

		if (!accountId) {
			return fail(400, { error: 'Please select an account' });
		}

		try {
			const transactions = JSON.parse(transactionsJson);
			const columnMapping = columnMappingJson ? JSON.parse(columnMappingJson) : undefined;

			const result = await api('/import/execute', {
				method: 'POST',
				body: {
					accountId,
					transactions,
					skipDuplicates,
					fileName,
					fileType,
					columnMapping
				},
				accessToken: locals.accessToken
			});

			return {
				success: true,
				importResult: result
			};
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to import transactions';
			return fail(500, { error: message });
		}
	}
};
