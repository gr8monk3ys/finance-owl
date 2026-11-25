import { afterEach, describe, expect, it, vi } from 'vitest';
import { actions } from './+page.server';

describe('privacy page server', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests account deletion through the live account-deletion route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'pending' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const formData = new FormData();
    formData.set('reason', 'Moving to another app');

    const result = await actions.requestDeletion({
      request: { formData: async () => formData } as Request,
      locals: { accessToken: 'access-token' },
    } as never);

    expect(result).toEqual({ success: true, message: 'Deletion request submitted' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/account\/delete$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ reason: 'Moving to another app' });
  });
});
