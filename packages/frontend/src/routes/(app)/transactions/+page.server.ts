import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals, url }) => {
  const params = new URLSearchParams();

  const filters = ['accountId', 'categoryId', 'startDate', 'endDate', 'search', 'page', 'limit'];
  for (const key of filters) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value);
  }

  const minAmount = url.searchParams.get('minAmount');
  const maxAmount = url.searchParams.get('maxAmount');
  if (minAmount) params.set('minAmount', minAmount);
  if (maxAmount) params.set('maxAmount', maxAmount);

  const pending = url.searchParams.get('pending');
  if (pending) params.set('pending', pending);

  try {
    const queryString = params.toString();
    const [transactions, accounts, categories] = await Promise.all([
      api(`/transactions${queryString ? `?${queryString}` : ''}`, {
        accessToken: locals.accessToken,
      }),
      api('/accounts', { accessToken: locals.accessToken }),
      api('/categories', { accessToken: locals.accessToken }),
    ]);

    return { transactions, accounts, categories };
  } catch {
    return {
      transactions: { data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } },
      accounts: [],
      categories: [],
    };
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const formData = await request.formData();
    const data = {
      accountId: formData.get('accountId') as string,
      amount: parseFloat(formData.get('amount') as string),
      name: formData.get('name') as string,
      merchantName: (formData.get('merchantName') as string) || undefined,
      categoryId: (formData.get('categoryId') as string) || undefined,
      date: formData.get('date') as string,
      notes: (formData.get('notes') as string) || undefined,
    };

    if (!data.accountId || !data.name || !data.date || isNaN(data.amount)) {
      return fail(400, { error: 'Account, name, amount, and date are required' });
    }

    try {
      await api('/transactions', {
        method: 'POST',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to create transaction' });
    }
  },

  updateCategory: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const categoryId = formData.get('categoryId') as string;

    try {
      await api(`/transactions/${id}`, {
        method: 'PATCH',
        body: { categoryId },
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to update category' });
    }
  },

  updateNotes: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const notes = formData.get('notes') as string;

    try {
      await api(`/transactions/${id}`, {
        method: 'PATCH',
        body: { notes },
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to update notes' });
    }
  },

  delete: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    try {
      await api(`/transactions/${id}`, {
        method: 'DELETE',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to delete transaction' });
    }
  },
};
