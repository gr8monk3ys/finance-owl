import { test, expect } from './fixtures';

test.describe('App Navigation — Public routes', () => {
  // These tests verify that public routes exist and render without errors.
  // They do not require authentication.

  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('FinanceOwl')).toBeVisible();
  });

  test('login page renders with form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('register page renders with form', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });
});
