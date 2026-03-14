import { test, expect, login, TEST_USER, uniqueEmail } from './fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('Authentication — Login page', () => {
  test('should load the login page with all expected elements', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page).toHaveTitle(/Sign In/);
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText('Sign in to your Finance Owl account')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create one free/i })).toBeVisible();
  });

  test('should submit valid credentials and redirect to dashboard', async ({ page }) => {
    await login(page);

    // After login we should land on a protected page (dashboard or setup)
    await expect(page).toHaveURL(/\/(dashboard|auth\/setup)/, { timeout: 15_000 });
  });

  test('should show an error message for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByLabel('Email').fill('invalid-user@does-not-exist.com');
    await page.getByLabel('Password').fill('WrongPassword999!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('alert')).toContainText(/invalid|failed/i);
  });

  test('should redirect unauthenticated users away from protected routes', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Authentication — Registration page', () => {
  test('should load the registration page with all expected elements', async ({ page }) => {
    await page.goto('/auth/register');

    await expect(page).toHaveTitle(/Create Account/);
    await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('should register a new user and redirect to dashboard or setup', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/auth/register');
    await page.getByLabel('Full name').fill('Test New User');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('NewUserSecure123!');
    await page.getByLabel(/confirm password/i).fill('NewUserSecure123!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/(dashboard|auth\/setup)/, { timeout: 15_000 });
  });
});

test.describe('Authentication — Navigation between auth pages', () => {
  test('should navigate from login to register and back', async ({ page }) => {
    await page.goto('/auth/login');

    await page.getByRole('link', { name: /create one free/i }).click();
    await expect(page).toHaveURL(/\/auth\/register/);

    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('Authentication — Logout', () => {
  test('should log out and redirect to login page', async ({ authenticatedPage: page }) => {
    // The sidebar contains a "Sign out" button inside a form posting to /auth/logout
    await page.getByRole('button', { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
  });
});
