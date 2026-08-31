import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { api } from '$lib/server/api';
import { getErrorMessage } from '$lib/server/error';

export const load: PageServerLoad = async ({ locals }) => {
  try {
    const [accounts, plaidItems, netWorth] = await Promise.all([
      api('/accounts', { accessToken: locals.accessToken }),
      api('/bank-sync/items', { accessToken: locals.accessToken }),
      api('/accounts/net-worth', { accessToken: locals.accessToken }),
    ]);

    return { accounts, plaidItems, netWorth };
  } catch {
    return {
      accounts: [],
      plaidItems: [],
      netWorth: { assets: 0, liabilities: 0, netWorth: 0, accountCount: 0 },
    };
  }
};

export const actions: Actions = {
  link: async ({ locals }) => {
    try {
      const result = await api('/bank-sync/link-token', {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { linkToken: result.linkToken };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to create link token' });
    }
  },

  exchange: async ({ request, locals }) => {
    const data = await request.formData();
    const publicToken = data.get('publicToken') as string;

    if (!publicToken) {
      return fail(400, { error: 'Missing public token' });
    }

    try {
      const result = await api('/bank-sync/exchange', {
        method: 'POST',
        body: { publicToken },
        accessToken: locals.accessToken,
      });
      return {
        success: true,
        linkedPlaidItemId: result.plaidItem?.id ?? null,
      };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to link account' });
    }
  },

  sync: async ({ request, locals }) => {
    const data = await request.formData();
    const plaidItemId = data.get('plaidItemId') as string;

    if (!plaidItemId) {
      return fail(400, { error: 'Missing plaid item ID' });
    }

    try {
      const result = await api(`/bank-sync/sync/${plaidItemId}`, {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return {
        syncResult: result,
        syncSuccess: true,
      };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to sync transactions' });
    }
  },

  refresh: async ({ request, locals }) => {
    const data = await request.formData();
    const plaidItemId = data.get('plaidItemId') as string;

    if (!plaidItemId) {
      return fail(400, { error: 'Missing plaid item ID' });
    }

    try {
      await api(`/bank-sync/refresh/${plaidItemId}`, {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { refreshSuccess: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to refresh balances' });
    }
  },

  createManual: async ({ request, locals }) => {
    const data = await request.formData();
    const name = data.get('name') as string;
    const type = data.get('type') as string;
    const institutionName = data.get('institutionName') as string;
    const balance = parseFloat(data.get('balance') as string) || 0;

    if (!name || !type) {
      return fail(400, { error: 'Name and type are required' });
    }

    try {
      await api('/accounts/manual', {
        method: 'POST',
        body: { name, type, institutionName: institutionName || undefined, balance },
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to create account' });
    }
  },

  updateLink: async ({ request, locals }) => {
    const data = await request.formData();
    const plaidItemId = data.get('plaidItemId') as string;

    try {
      const result = await api(`/bank-sync/link-token/update/${plaidItemId}`, {
        method: 'POST',
        accessToken: locals.accessToken,
      });
      return { updateLinkToken: result.linkToken, updatePlaidItemId: plaidItemId };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to create update link token' });
    }
  },

  unlink: async ({ request, locals }) => {
    const data = await request.formData();
    const plaidItemId = data.get('plaidItemId') as string;

    if (!plaidItemId) {
      return fail(400, { error: 'Missing plaid item ID' });
    }

    try {
      await api(`/bank-sync/items/${plaidItemId}`, {
        method: 'DELETE',
        accessToken: locals.accessToken,
      });
      return { success: true };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Failed to unlink account' });
    }
  },

  // Sandbox-only: create a test public token without Plaid Link UI
  sandboxTestLink: async ({ locals }) => {
    try {
      const result = await api('/bank-sync/sandbox/create-test-link', {
        accessToken: locals.accessToken,
      });
      return { sandboxPublicToken: result.publicToken };
    } catch (e: unknown) {
      return fail(500, { error: getErrorMessage(e) || 'Sandbox test link failed' });
    }
  },
};
