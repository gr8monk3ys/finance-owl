import { test, expect } from './fixtures';
import { fillAndExpectUrl } from './helpers';

test.describe('Web Smoke', () => {
  test.describe.configure({ mode: 'serial' });

  test('landing page renders core marketing content', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Finance Owl/);
    await expect(page.getByRole('link', { name: /get started free/i }).first()).toBeVisible();
    await expect(page.getByText('Track spending, stay on top of recurring bills')).toBeVisible();
  });

  test('demo user session reaches the dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Monthly Spending')).toBeVisible();
    await expect(page.getByText('Budget Remaining')).toBeVisible();
  });

  test('authenticated navigation reaches accounts, budgets, and transactions', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/dashboard');

    await page.getByRole('link', { name: 'Accounts', exact: true }).click();
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.getByRole('heading', { level: 2, name: 'Accounts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Manual' })).toBeVisible();

    await page.getByRole('link', { name: 'Budgets', exact: true }).click();
    await expect(page).toHaveURL(/\/budgets/);
    await expect(page.getByRole('heading', { level: 2, name: 'Budgets' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Budget' })).toBeVisible();

    await page.getByRole('link', { name: 'Transactions', exact: true }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByRole('heading', { level: 2, name: 'Transactions' })).toBeVisible();
    await expect(page.getByPlaceholder('Search by name, merchant, or amount…')).toBeVisible();
  });

  test('transactions search updates as you type and can be cleared', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/transactions');

    const search = page.getByPlaceholder('Search by name, merchant, or amount…');
    // Retried fill: a value typed before hydration never reaches the binding.
    await fillAndExpectUrl(page, search, 'Payroll', /\/transactions\?search=Payroll/);
    await expect(page.getByText('Showing results for “Payroll”')).toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page).toHaveURL(/\/transactions$/, { timeout: 10_000 });
    await expect(page.getByText('Showing all transactions')).toBeVisible();
  });

  test('dashboard quick links open the detailed pages', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    await page.getByRole('link', { name: 'View all' }).first().click();
    await expect(page).toHaveURL(/\/budgets/);

    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'View all' }).nth(1).click();
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('authenticated user can sign out', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
