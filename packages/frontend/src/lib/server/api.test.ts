import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns parsed json responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    await expect(api('/health')).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/health',
      expect.objectContaining({
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('returns text when rawText is requested', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('plain text response', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    ) as typeof fetch;

    await expect(api('/health', { rawText: true })).resolves.toBe('plain text response');
  });

  it('includes bearer auth and request body when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ saved: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    await api('/accounts', {
      method: 'POST',
      body: { name: 'Checking' },
      accessToken: 'token-123',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/accounts',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        },
        body: JSON.stringify({ name: 'Checking' }),
      }),
    );
  });

  it('surfaces backend error messages for non-retryable failures', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ message: 'Invalid credentials' }),
    }) as typeof fetch;

    await expect(api('/auth/login')).rejects.toThrow('Invalid credentials');
  });

  it('retries a transient server error once', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'server down' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ) as typeof fetch;

    await expect(api('/health')).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
