import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

function createFormRequest(values: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(values)) {
		formData.set(key, value);
	}

	return {
		formData: async () => formData
	} as Request;
}

describe('transactions page server', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('forwards active filters into the transactions query', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [{ id: 'txn_1' }], meta: { page: 2, limit: 25, total: 1, totalPages: 1 } }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'account_1' }]), { status: 200, headers: { 'content-type': 'application/json' } }))
			.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'category_1' }]), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

		const data = (await load({
			locals: { accessToken: 'access-token' },
			url: new URL(
				'http://localhost:3000/transactions?search=rent&page=2&limit=25&minAmount=10&pending=true'
			)
		} as never)) as any;

		expect(data.transactions.data).toEqual([{ id: 'txn_1' }]);
		expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe(
			'http://localhost:4000/api/transactions?search=rent&page=2&limit=25&minAmount=10&pending=true'
		);
	});

	it('returns the empty transaction state when the API fails', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ message: 'transactions offline' }), {
					status: 400,
					headers: { 'content-type': 'application/json' }
				})
			) as typeof fetch;

		const data = (await load({
			locals: { accessToken: 'access-token' },
			url: new URL('http://localhost:3000/transactions')
		} as never)) as any;

		expect(data.transactions).toEqual({
			data: [],
			meta: { page: 1, limit: 50, total: 0, totalPages: 0 }
		});
		expect(data.accounts).toEqual([]);
		expect(data.categories).toEqual([]);
	});

	it('rejects incomplete transaction creation requests', async () => {
		const result = await actions.create({
			request: createFormRequest({ accountId: '', amount: '', name: '', date: '' }),
			locals: { accessToken: 'access-token' }
		} as never);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Account, name, amount, and date are required' }
		});
	});

	it('creates, updates, and deletes transactions', async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			) as typeof fetch;

		const createResult = await actions.create({
			request: createFormRequest({
				accountId: 'account_1',
				amount: '19.99',
				name: 'Coffee',
				merchantName: 'Coffee Shop',
				categoryId: 'dining',
				date: '2026-03-12',
				notes: 'Morning run'
			}),
			locals: { accessToken: 'access-token' }
		} as never);
		const updateCategoryResult = await actions.updateCategory({
			request: createFormRequest({ id: 'txn_1', categoryId: 'groceries' }),
			locals: { accessToken: 'access-token' }
		} as never);
		const updateNotesResult = await actions.updateNotes({
			request: createFormRequest({ id: 'txn_1', notes: 'Updated note' }),
			locals: { accessToken: 'access-token' }
		} as never);
		const deleteResult = await actions.delete({
			request: createFormRequest({ id: 'txn_1' }),
			locals: { accessToken: 'access-token' }
		} as never);

		expect(createResult).toEqual({ success: true });
		expect(updateCategoryResult).toEqual({ success: true });
		expect(updateNotesResult).toEqual({ success: true });
		expect(deleteResult).toEqual({ success: true });
	});
});
