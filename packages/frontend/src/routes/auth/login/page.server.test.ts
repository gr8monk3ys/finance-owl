import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { actions, load } from './+page.server';

function createFormRequest(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return {
    formData: async () => formData,
    headers: new Headers(),
  } as Request;
}

function createCookiesMock() {
  return {
    set: vi.fn(),
  };
}

describe('auth login page server', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('redirects authenticated users away from the login page', async () => {
    await expect(
      load({ locals: { user: { id: '1', email: 'demo@financeowl.com', name: 'Demo' } } } as never),
    ).rejects.toMatchObject({ status: 303, location: '/dashboard' });
  });

  it('rejects missing credentials before calling the backend', async () => {
    const cookies = createCookiesMock();
    const result = await actions.default({
      request: createFormRequest({ email: '', password: '' }),
      cookies,
      getClientAddress: () => '127.0.0.1',
    } as never);

    expect(result).toMatchObject({
      status: 400,
      data: { error: 'Email and password are required', email: '' },
    });
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('forwards client IP, sets cookies, and redirects after a successful login', async () => {
    const cookies = createCookiesMock();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    }) as typeof fetch;

    await expect(
      actions.default({
        request: createFormRequest({
          email: 'demo@financeowl.com',
          password: 'Demo123!',
        }),
        cookies,
        getClientAddress: () => '127.0.0.1',
      } as never),
    ).rejects.toMatchObject({ status: 303, location: '/dashboard' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-forwarded-for': '127.0.0.1',
          'x-real-ip': '127.0.0.1',
        }),
      }),
    );
    expect(cookies.set).toHaveBeenCalledTimes(2);
  });
});
