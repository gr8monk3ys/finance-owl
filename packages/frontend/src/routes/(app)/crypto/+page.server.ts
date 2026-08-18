import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [holdings, portfolio, transactions, watchlist, coins] = await Promise.all([
      api('/crypto/holdings', { accessToken: locals.accessToken }).catch(() => []),
      api('/crypto/portfolio', { accessToken: locals.accessToken }).catch(() => null),
      api('/crypto/transactions', { accessToken: locals.accessToken }).catch(() => []),
      api('/crypto/watchlist', { accessToken: locals.accessToken }).catch(() => []),
      api('/crypto/coins', { accessToken: locals.accessToken }).catch(() => []),
    ]);

    return { holdings, portfolio, transactions, watchlist, coins };
  } catch {
    return {
      holdings: [],
      portfolio: null,
      transactions: [],
      watchlist: [],
      coins: [],
    };
  }
};

export const actions: Actions = {
  addHolding: async ({ request, locals }) => {
    const formData = await request.formData();
    const data = {
      symbol: formData.get('symbol') as string,
      name: formData.get('name') as string,
      quantity: parseFloat(formData.get('quantity') as string),
      averageCostBasis: parseFloat(formData.get('averageCostBasis') as string),
      exchange: (formData.get('exchange') as string) || undefined,
      walletAddress: (formData.get('walletAddress') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    };

    if (!data.symbol || !data.name || !data.quantity || !data.averageCostBasis) {
      return fail(400, { error: 'Symbol, name, quantity, and cost basis are required.' });
    }

    try {
      await api('/crypto/holdings', {
        method: 'POST',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to add holding.',
      });
    }
  },

  updateHolding: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const data: Record<string, unknown> = {};

    const quantity = formData.get('quantity') as string;
    if (quantity) data.quantity = parseFloat(quantity);

    const averageCostBasis = formData.get('averageCostBasis') as string;
    if (averageCostBasis) data.averageCostBasis = parseFloat(averageCostBasis);

    const exchange = formData.get('exchange') as string;
    if (exchange) data.exchange = exchange;

    const notes = formData.get('notes') as string;
    if (notes) data.notes = notes;

    try {
      await api(`/crypto/holdings/${id}`, {
        method: 'PATCH',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to update holding.',
      });
    }
  },

  deleteHolding: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    try {
      await api(`/crypto/holdings/${id}`, {
        method: 'DELETE',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to delete holding.',
      });
    }
  },

  recordTransaction: async ({ request, locals }) => {
    const formData = await request.formData();
    const data = {
      holdingId: formData.get('holdingId') as string,
      type: formData.get('type') as string,
      quantity: parseFloat(formData.get('quantity') as string),
      pricePerUnit: parseFloat(formData.get('pricePerUnit') as string),
      fee: formData.get('fee') ? parseFloat(formData.get('fee') as string) : undefined,
      date: (formData.get('date') as string) || undefined,
      exchange: (formData.get('exchange') as string) || undefined,
      txHash: (formData.get('txHash') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    };

    if (!data.holdingId || !data.type || !data.quantity || !data.pricePerUnit) {
      return fail(400, { error: 'Holding, type, quantity, and price are required.' });
    }

    try {
      await api('/crypto/transactions', {
        method: 'POST',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to record transaction.',
      });
    }
  },

  refreshPrices: async ({ locals }) => {
    try {
      const result = await api('/crypto/holdings/refresh-prices', {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { refreshed: true, ...result };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to refresh prices.',
      });
    }
  },

  addToWatchlist: async ({ request, locals }) => {
    const formData = await request.formData();
    const data = {
      symbol: formData.get('symbol') as string,
      name: formData.get('name') as string,
    };

    if (!data.symbol || !data.name) {
      return fail(400, { error: 'Symbol and name are required.' });
    }

    try {
      await api('/crypto/watchlist', {
        method: 'POST',
        body: data,
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to add to watchlist.',
      });
    }
  },

  removeFromWatchlist: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;

    try {
      await api(`/crypto/watchlist/${id}`, {
        method: 'DELETE',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : 'Failed to remove from watchlist.',
      });
    }
  },
};
