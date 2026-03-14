import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  // Every test in this block uses the pre-authenticated page fixture
  test.beforeEach(async ({ authenticatedPage }) => {
    // Navigate explicitly to the dashboard in case login landed on /auth/setup
    await authenticatedPage.goto('/dashboard');
  });

  test('should load the dashboard page', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveTitle(/Dashboard/);
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Your financial overview at a glance')).toBeVisible();
  });

  test('should display the net worth summary card', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Net Worth')).toBeVisible();
  });

  test('should display the monthly spending card', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Monthly Spending')).toBeVisible();
  });

  test('should display the budget remaining card', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Budget Remaining')).toBeVisible();
  });

  test('should show the Customize button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /customize/i })).toBeVisible();
  });

  test('should open and close the customize modal', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /customize/i }).click();

    // Modal title
    await expect(page.getByText('Customize Dashboard')).toBeVisible();
    await expect(page.getByText('Toggle widgets on or off')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByText('Customize Dashboard')).not.toBeVisible();
  });
});

test.describe('Dashboard — Sidebar navigation', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
  });

  test('should navigate to Accounts via sidebar', async ({ authenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Accounts' }).click();
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  });

  test('should navigate to Transactions via sidebar', async ({ authenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  });

  test('should navigate to Budgets via sidebar', async ({ authenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Budgets' }).click();
    await expect(page).toHaveURL(/\/budgets/);
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
  });

  test('should navigate to Savings Goals via sidebar', async ({ authenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Savings Goals' }).click();
    await expect(page).toHaveURL(/\/savings/);
  });

  test('should navigate to Reports via sidebar', async ({ authenticatedPage: page }) => {
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/reports/);
  });

  test('should highlight the active nav item', async ({ authenticatedPage: page }) => {
    // On the dashboard page, the Dashboard link should have the active indicator
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toHaveClass(/text-white/);
  });
});
