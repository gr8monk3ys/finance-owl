import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from './+layout.server';

describe('app layout server', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the user with default (null) tenant branding and calls no API', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;
    const user = { id: 'user_1', email: 'user@example.com' };

    const data = await load({
      locals: { user },
      url: new URL('https://app.example.com/dashboard'),
    } as never);

    expect(data).toEqual({ user, tenant: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to login when there is no user', async () => {
    await expect(
      load({ locals: {}, url: new URL('https://app.example.com/dashboard') } as never),
    ).rejects.toMatchObject({ status: 303, location: '/auth/login' });
  });
});
