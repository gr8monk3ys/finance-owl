import { test, expect } from './fixtures';

test.describe('App Navigation — Public routes', () => {
  // These tests verify that public routes exist and render without errors.
  // They do not require authentication.

  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav a[href="/"]').first()).toBeVisible();
  });

  test('login page renders with form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('register page renders with form', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('support page renders', async ({ page }) => {
    await page.goto('/support');
    await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
  });

  test('legal pages render without authentication', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();

    await page.goto('/security');
    await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible();
  });
});
