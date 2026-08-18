import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

function createFormRequest(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return {
    formData: async () => formData,
  } as Request;
}

describe('accounts page server', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads accounts, plaid items, and net worth data', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'account_1' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'plaid_1' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ assets: 7500, liabilities: 1000, netWorth: 6500, accountCount: 2 }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ) as typeof fetch;

    const data = (await load({
      locals: { accessToken: 'access-token' },
    } as never)) as any;

    expect(data.accounts).toEqual([{ id: 'account_1' }]);
    expect(data.plaidItems).toEqual([{ id: 'plaid_1' }]);
    expect(data.netWorth.netWorth).toBe(6500);
  });

  it('returns empty account state when API calls fail', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'accounts offline' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const data = (await load({
      locals: { accessToken: 'access-token' },
    } as never)) as any;

    expect(data.accounts).toEqual([]);
    expect(data.plaidItems).toEqual([]);
    expect(data.netWorth).toEqual({ assets: 0, liabilities: 0, netWorth: 0, accountCount: 0 });
  });

  it('validates required account-linking inputs', async () => {
    const exchangeResult = await actions.exchange({
      request: createFormRequest({ publicToken: '' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const syncResult = await actions.sync({
      request: createFormRequest({ plaidItemId: '' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const refreshResult = await actions.refresh({
      request: createFormRequest({ plaidItemId: '' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const createManualResult = await actions.createManual({
      request: createFormRequest({ name: '', type: '' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const unlinkResult = await actions.unlink({
      request: createFormRequest({ plaidItemId: '' }),
      locals: { accessToken: 'access-token' },
    } as never);

    expect(exchangeResult).toMatchObject({ status: 400, data: { error: 'Missing public token' } });
    expect(syncResult).toMatchObject({ status: 400, data: { error: 'Missing plaid item ID' } });
    expect(refreshResult).toMatchObject({ status: 400, data: { error: 'Missing plaid item ID' } });
    expect(createManualResult).toMatchObject({
      status: 400,
      data: { error: 'Name and type are required' },
    });
    expect(unlinkResult).toMatchObject({ status: 400, data: { error: 'Missing plaid item ID' } });
  });

  it('executes the primary account actions through the API', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ linkToken: 'link-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ plaidItem: { id: 'plaid_1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ imported: 12 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ linkToken: 'update-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ publicToken: 'sandbox-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ) as typeof fetch;

    const linkResult = await actions.link({
      locals: { accessToken: 'access-token' },
    } as never);
    const exchangeResult = await actions.exchange({
      request: createFormRequest({ publicToken: 'public-token' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const syncResult = await actions.sync({
      request: createFormRequest({ plaidItemId: 'plaid_1' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const refreshResult = await actions.refresh({
      request: createFormRequest({ plaidItemId: 'plaid_1' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const createManualResult = await actions.createManual({
      request: createFormRequest({
        name: 'Manual Checking',
        type: 'checking',
        institutionName: 'Local Bank',
        balance: '500',
      }),
      locals: { accessToken: 'access-token' },
    } as never);
    const updateLinkResult = await actions.updateLink({
      request: createFormRequest({ plaidItemId: 'plaid_1' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const unlinkResult = await actions.unlink({
      request: createFormRequest({ plaidItemId: 'plaid_1' }),
      locals: { accessToken: 'access-token' },
    } as never);
    const sandboxResult = await actions.sandboxTestLink({
      locals: { accessToken: 'access-token' },
    } as never);

    expect(linkResult).toEqual({ linkToken: 'link-token' });
    expect(exchangeResult).toEqual({ success: true, linkedPlaidItemId: 'plaid_1' });
    expect(syncResult).toEqual({ syncResult: { imported: 12 }, syncSuccess: true });
    expect(refreshResult).toEqual({ refreshSuccess: true });
    expect(createManualResult).toEqual({ success: true });
    expect(updateLinkResult).toEqual({
      updateLinkToken: 'update-token',
      updatePlaidItemId: 'plaid_1',
    });
    expect(unlinkResult).toEqual({ success: true });
    expect(sandboxResult).toEqual({ sandboxPublicToken: 'sandbox-token' });
  });
});
