import { afterEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('privacy page server', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders an empty dashboard when the privacy endpoint is missing', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'Not Found' }, 404)) as typeof fetch;

    const data = await load({ locals: { accessToken: 'access-token' } } as never);

    expect(data).toEqual({ dashboard: { consents: [], exports: [], deletions: [] } });
  });

  it('requests account deletion through the live account-deletion route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'pending' }));
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
