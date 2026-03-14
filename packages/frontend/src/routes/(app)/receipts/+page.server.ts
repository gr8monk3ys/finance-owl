import type { PageServerLoad, Actions } from './$types';
import { api, API_URL } from '$lib/server/api';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [receiptsList, accounts] = await Promise.all([
			api('/receipts', { accessToken: locals.accessToken }).catch(() => []),
			api('/accounts', { accessToken: locals.accessToken }).catch(() => [])
		]);

		return { receipts: receiptsList, accounts };
	} catch {
		return { receipts: [], accounts: [] };
	}
};

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file || file.size === 0) {
			return fail(400, { error: 'Please select a file to upload' });
		}

		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
		if (!allowedTypes.includes(file.type)) {
			return fail(400, {
				error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.'
			});
		}

		if (file.size > 10 * 1024 * 1024) {
			return fail(400, { error: 'File too large. Maximum size is 10MB.' });
		}

		try {
			const buffer = await file.arrayBuffer();
			const blob = new Blob([buffer], { type: file.type });

			const uploadForm = new FormData();
			uploadForm.append('file', blob, file.name);

			const res = await fetch(`${API_URL}/api/receipts/upload`, {
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

			return { uploaded: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to upload receipt'
			});
		}
	},

	updateReceipt: async ({ request, locals }) => {
		const formData = await request.formData();
		const receiptId = String(formData.get('receiptId'));
		const merchantName = formData.get('merchantName')
			? String(formData.get('merchantName'))
			: undefined;
		const totalAmount = formData.get('totalAmount')
			? Number(formData.get('totalAmount'))
			: undefined;
		const date = formData.get('date') ? String(formData.get('date')) : undefined;

		try {
			await api(`/receipts/${receiptId}/update`, {
				method: 'POST',
				accessToken: locals.accessToken,
				body: { merchantName, totalAmount, date }
			});
			return { updated: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to update receipt'
			});
		}
	},

	linkTransaction: async ({ request, locals }) => {
		const formData = await request.formData();
		const receiptId = String(formData.get('receiptId'));
		const transactionId = String(formData.get('transactionId'));

		try {
			await api(`/receipts/${receiptId}/link`, {
				method: 'POST',
				accessToken: locals.accessToken,
				body: { transactionId }
			});
			return { linked: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to link transaction'
			});
		}
	},

	createTransaction: async ({ request, locals }) => {
		const formData = await request.formData();
		const receiptId = String(formData.get('receiptId'));
		const accountId = String(formData.get('accountId'));
		const name = String(formData.get('name'));
		const merchantName = formData.get('merchantName')
			? String(formData.get('merchantName'))
			: undefined;
		const amount = Number(formData.get('amount'));
		const date = String(formData.get('date'));

		if (!accountId || !name || !amount || !date) {
			return fail(400, { error: 'Please fill in all required fields' });
		}

		try {
			await api(`/receipts/${receiptId}/create-transaction`, {
				method: 'POST',
				accessToken: locals.accessToken,
				body: { accountId, name, merchantName, amount, date }
			});
			return { created: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to create transaction'
			});
		}
	},

	deleteReceipt: async ({ request, locals }) => {
		const formData = await request.formData();
		const receiptId = String(formData.get('receiptId'));

		try {
			await api(`/receipts/${receiptId}`, {
				method: 'DELETE',
				accessToken: locals.accessToken
			});
			return { deleted: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to delete receipt'
			});
		}
	},

	processReceipt: async ({ request, locals }) => {
		const formData = await request.formData();
		const receiptId = String(formData.get('receiptId'));

		try {
			await api(`/receipts/${receiptId}/process`, {
				method: 'POST',
				accessToken: locals.accessToken
			});
			return { processed: true };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Failed to process receipt'
			});
		}
	}
};
