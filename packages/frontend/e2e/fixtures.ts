import { test as base, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

export const TEST_USER = {
  name: 'E2E Test User',
  email: 'e2e-test@financeowl.local',
  password: 'SecureTestPass123!',
};

/**
 * Generate a unique email for registration tests so they do not collide
 * across parallel workers or repeated runs.
 */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@financeowl.local`;
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
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect away from the login page
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Custom fixtures
// ---------------------------------------------------------------------------

type Fixtures = {
  /** A Page that is already authenticated as TEST_USER. */
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };
