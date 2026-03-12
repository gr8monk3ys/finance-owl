import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

export const TEST_USER = {
  name: 'Demo User',
  email: process.env.PLAYWRIGHT_USER_EMAIL || 'demo@financeowl.com',
  password: process.env.PLAYWRIGHT_USER_PASSWORD || 'Demo123!',
};

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const API_URL = process.env.PLAYWRIGHT_API_URL || process.env.API_URL || 'http://localhost:4000';
const FRONTEND_HOST = new URL(FRONTEND_URL).hostname;

/**
 * Generate a unique email for registration tests so they do not collide
 * across parallel workers or repeated runs.
 */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@financeowl.local`;
}

function uniqueForwardedIp(seed = 0): string {
  const octetTwo = 20 + (seed % 200);
  const octetThree = Math.floor(Date.now() / 1000) % 250;
  const octetFour = 10 + Math.floor(Math.random() * 200);
  return `10.${octetTwo}.${octetThree}.${octetFour}`;
}

async function attachForwardedIpHeader(page: Page, ipAddress: string): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        'x-forwarded-for': ipAddress,
        'x-real-ip': ipAddress,
      },
    });
  };

  await page.route(/\/auth\/login(?:\?.*)?$/, handler);

  return async () => {
    await page.unroute(/\/auth\/login(?:\?.*)?$/, handler);
  };
}

async function seedAuthenticatedCookies(
  context: BrowserContext,
  request: APIRequestContext,
  credentials: { email: string; password: string },
  seed: number,
): Promise<void> {
  const ipAddress = uniqueForwardedIp(seed);
  const response = await request.post(`${API_URL}/api/auth/login`, {
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ipAddress,
      'x-real-ip': ipAddress,
    },
    data: credentials,
  });

  if (!response.ok()) {
    let details = response.statusText();
    try {
      const body = await response.json();
      details = body?.message || body?.code || details;
    } catch {
      // Ignore JSON parse failures and use the status text instead.
    }
    throw new Error(`Failed to seed auth session: ${response.status()} ${details}`);
  }

  const tokens = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  const now = Math.floor(Date.now() / 1000);

  await context.clearCookies();
  await context.addCookies([
    {
      name: 'access_token',
      value: tokens.accessToken,
      domain: FRONTEND_HOST,
      path: '/',
      expires: now + 60 * 15,
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
    {
      name: 'refresh_token',
      value: tokens.refreshToken,
      domain: FRONTEND_HOST,
      path: '/',
      expires: now + 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'Lax',
      secure: false,
    },
  ]);

  const authCookies = await context.cookies(FRONTEND_URL);
  const hasSession =
    authCookies.some((cookie) => cookie.name === 'access_token') &&
    authCookies.some((cookie) => cookie.name === 'refresh_token');

  if (!hasSession) {
    throw new Error('Failed to persist auth cookies in the browser context');
  }
}

// ---------------------------------------------------------------------------
// Login helper (usable outside of fixtures too)
// ---------------------------------------------------------------------------

/**
 * Programmatically log a user in through the login form.
 * Waits until the redirect to the dashboard (or setup) completes.
 */
export async function login(
  page: Page,
  credentials: { email: string; password: string } = TEST_USER,
): Promise<void> {
  const detachHeader = await attachForwardedIpHeader(page, uniqueForwardedIp());

  try {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect away from the login page
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 });
  } finally {
    await detachHeader();
  }
}

// ---------------------------------------------------------------------------
// Custom fixtures
// ---------------------------------------------------------------------------

type Fixtures = {
  /** A Page that is already authenticated as TEST_USER. */
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page, request }, use, testInfo) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await seedAuthenticatedCookies(
        page.context(),
        request,
        {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
        testInfo.workerIndex + attempt,
      );
      await page.goto('/dashboard', { waitUntil: 'networkidle' });

      if (/\/dashboard(?:\?|$)/.test(page.url())) {
        break;
      }
    }

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await use(page);
  },
});

export { expect };
