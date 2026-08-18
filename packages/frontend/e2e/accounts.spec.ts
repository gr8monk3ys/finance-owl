import { test, expect } from './fixtures';
import { clickAndExpectVisible } from './helpers';

test.describe('Accounts — Page load', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/accounts');
  });

  test('should load the accounts page', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveTitle(/Accounts/);
    // The top bar renders an h1 with the same name, so target the page heading.
    await expect(page.getByRole('heading', { level: 2, name: 'Accounts' })).toBeVisible();
  });

  test('should display the Add Manual button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /add manual/i })).toBeVisible();
  });

  test('should display the Link Bank Account button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /link bank account/i })).toBeVisible();
  });

  test('should display net worth summary cards', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Total Assets')).toBeVisible();
    await expect(page.getByText('Total Liabilities')).toBeVisible();
    await expect(page.getByText('Net Worth')).toBeVisible();
  });

  test('should show accounts list or empty state', async ({ authenticatedPage: page }) => {
    const emptyState = page.getByText('No accounts linked yet');
    const accountCards = page.locator('[class*="divide-y"]');

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasAccounts = (await accountCards.count()) > 0;

    expect(hasEmptyState || hasAccounts).toBe(true);
  });
});

test.describe('Accounts — Add manual account', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/accounts');
  });

  /** Open the Add Manual Account modal, retrying until hydration lets the click through. */
  async function openManualModal(page: import('@playwright/test').Page) {
    await clickAndExpectVisible(
      page.getByRole('button', { name: /add manual/i }).first(),
      page.getByRole('heading', { name: 'Add Manual Account' }),
    );
  }

  test('should open the Add Manual Account modal', async ({ authenticatedPage: page }) => {
    await openManualModal(page);

    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#type')).toBeVisible();
    await expect(page.locator('#institutionName')).toBeVisible();
    await expect(page.locator('#balance')).toBeVisible();
  });

  test('should fill out and submit a manual account', async ({ authenticatedPage: page }) => {
    await openManualModal(page);

    await page.locator('#name').fill('E2E Test Checking');
    await page.locator('#type').selectOption('checking');
    await page.locator('#institutionName').fill('Test Bank');
    await page.locator('#balance').fill('1500.00');

    // Submit the form
    await page
      .locator('form[action="?/createManual"]')
      .getByRole('button', { name: /add account/i })
      .click();

    // After success, the modal closes and the page reloads with the new account.
    // The modal title should no longer be visible.
    await expect(page.getByRole('heading', { name: 'Add Manual Account' })).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test('should close the modal with the Cancel button', async ({ authenticatedPage: page }) => {
    await openManualModal(page);

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Manual Account' })).not.toBeVisible();
  });

  test('should show account type options in the dropdown', async ({ authenticatedPage: page }) => {
    await openManualModal(page);

    const typeSelect = page.locator('#type');
    const options = typeSelect.locator('option');

    // Verify expected account types are present
    await expect(options.filter({ hasText: 'Checking' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Savings' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Credit Card' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Investment' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Loan' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Mortgage' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Other' })).toHaveCount(1);
  });
});
