import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

type CookieMap = Map<string, string>;

function createCookies(initial: Record<string, string> = {}) {
  const store: CookieMap = new Map(Object.entries(initial));

  return {
    get: vi.fn((name: string) => store.get(name)),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
    store,
  };
}

function createEvent(pathname: string, cookies = createCookies()) {
  return {
    cookies,
    locals: {
      user: null,
      accessToken: null,
    },
    url: new URL(`http://localhost:3000${pathname}`),
  };
}

describe('server auth hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    '/',
    '/support',
    '/privacy',
    '/terms',
    '/security',
    '/sitemap.xml',
    '/.well-known/security.txt',
  ])('allows public route %s without a session', async (pathname) => {
    const event = createEvent(pathname);
    const resolve = vi.fn().mockResolvedValue(new Response('ok'));

    const response = await handle({ event: event as never, resolve });

    expect(resolve).toHaveBeenCalledWith(event);
    expect(await response.text()).toBe('ok');
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    const event = createEvent('/dashboard');
    const resolve = vi.fn();

    await expect(handle({ event: event as never, resolve })).rejects.toMatchObject({
      status: 303,
      location: '/auth/login',
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('hydrates locals when the access token is still valid', async () => {
    const event = createEvent('/dashboard', createCookies({ access_token: 'token-123' }));
    const resolve = vi.fn().mockResolvedValue(new Response('ok'));
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '1', email: 'demo@financeowl.com', name: 'Demo User' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    await handle({ event: event as never, resolve });

    expect(event.locals.accessToken).toBe('token-123');
    expect(event.locals.user).toEqual({
      id: '1',
      email: 'demo@financeowl.com',
      name: 'Demo User',
    });
  });

  it('refreshes an expired access token and persists the new cookies', async () => {
    const cookies = createCookies({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
    });
    const event = createEvent('/dashboard', cookies);
    const resolve = vi.fn().mockResolvedValue(new Response('ok'));
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '1', email: 'demo@financeowl.com', name: 'Demo User' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ) as typeof fetch;

    await handle({ event: event as never, resolve });

    expect(event.locals.accessToken).toBe('new-access-token');
    expect(event.locals.user).toEqual({
      id: '1',
      email: 'demo@financeowl.com',
      name: 'Demo User',
    });
    expect(cookies.set).toHaveBeenCalledTimes(2);
    expect(cookies.set).toHaveBeenCalledWith(
      'access_token',
      'new-access-token',
      expect.objectContaining({ path: '/' }),
    );
    expect(cookies.set).toHaveBeenCalledWith(
      'refresh_token',
      'new-refresh-token',
      expect.objectContaining({ path: '/' }),
    );
  });

  it('clears invalid cookies and redirects when refresh fails', async () => {
    const cookies = createCookies({
      access_token: 'expired-access-token',
      refresh_token: 'expired-refresh-token',
    });
    const event = createEvent('/dashboard', cookies);
    const resolve = vi.fn();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('nope', { status: 401 })) as typeof fetch;

    await expect(handle({ event: event as never, resolve })).rejects.toMatchObject({
      status: 303,
      location: '/auth/login',
    });
    expect(cookies.delete).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(cookies.delete).toHaveBeenCalledWith('refresh_token', { path: '/' });
  });
});
