export const API_URL = process.env.API_URL || 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function api(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    accessToken?: string | null;
    rawText?: boolean;
  } = {},
) {
  const { method = 'GET', body, accessToken, rawText = false } = options;

  // Callers interpolate user-supplied ids into paths. Reject anything that
  // could traverse to a different backend endpoint after URL normalization
  // (`..` segments, encoded traversal, CR/LF header-splitting attempts).
  if (/(^|\/)\.\.(\/|$)|%2e%2e|%2f|%5c|[\r\n]|\\/i.test(path)) {
    throw new Error('Invalid API path');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api${path}`, fetchOptions);

      if (!res.ok) {
        // Retry on server errors (5xx)
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          lastError = new Error(`API error: ${res.status}`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        const error = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `API error: ${res.status}`);
      }

      if (rawText) {
        return res.text();
      }

      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return res.json();
      }

      return null;
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new Error('Request timed out');
      }

      // Don't retry client-side errors or non-retryable failures
      if (attempt >= MAX_RETRIES) {
        throw err;
      }

      lastError = err instanceof Error ? err : new Error(String(err));
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError || new Error('Request failed');
}
