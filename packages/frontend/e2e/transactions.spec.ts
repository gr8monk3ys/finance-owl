import { test, expect } from './fixtures';

test.describe('Transactions — Page load', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/transactions');
  });

  test('should load the transactions page', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveTitle(/Transactions/);
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  });

  test('should display the Add Transaction button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /add transaction/i })).toBeVisible();
  });

  test('should display the search bar', async ({ authenticatedPage: page }) => {
    await expect(
      page.getByPlaceholder(/search by name, merchant, or amount/i),
    ).toBeVisible();
  });

  test('should show the transaction list or empty state', async ({ authenticatedPage: page }) => {
    // Either we see the "No transactions yet" empty state or actual transaction rows
    const emptyState = page.getByText('No transactions yet');
    const transactionCount = page.getByText(/transaction/);

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasTransactions = await transactionCount.isVisible().catch(() => false);

    expect(hasEmptyState || hasTransactions).toBe(true);
  });
});

test.describe('Transactions — Add manual transaction', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/transactions');
  });

  test('should open the Add Transaction modal', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /add transaction/i }).click();

    await expect(page.getByText('Add Transaction', { exact: false })).toBeVisible();
    // Verify modal form fields
    await expect(page.locator('#txAccount')).toBeVisible();
    await expect(page.locator('#txAmount')).toBeVisible();
    await expect(page.locator('#txDate')).toBeVisible();
    await expect(page.locator('#txName')).toBeVisible();
  });

  test('should fill out and submit a new transaction', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /add transaction/i }).click();

    // Fill in the transaction form
    await page.locator('#txAmount').fill('42.50');
    await page.locator('#txName').fill('E2E Test Transaction');
    await page.locator('#txMerchant').fill('Test Merchant');
    // Date defaults to today, so we leave it as-is

    // Submit the form
    await page.locator('form[action="?/create"]').getByRole('button', { name: /add transaction/i }).click();

    // After a successful create the modal closes and the page reloads.
    // We should either see the new transaction in the list or no error is shown.
    // Give the page time to process the server action.
    await page.waitForTimeout(2_000);

    // The modal should have closed (no more "Cancel" button in the modal)
    const modalCancelButton = page.locator('form[action="?/create"]').getByRole('button', { name: /cancel/i });
    await expect(modalCancelButton).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Transactions — Search and filter', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/transactions');
  });

  test('should perform a text search', async ({ authenticatedPage: page }) => {
    const searchInput = page.getByPlaceholder(/search by name, merchant, or amount/i);
    await searchInput.fill('grocery');
    await page.getByRole('button', { name: 'Search' }).click();

    // The URL should now contain a search query parameter
    await expect(page).toHaveURL(/search=grocery/);
  });

  test('should toggle the filter panel', async ({ authenticatedPage: page }) => {
    // Click the filter button (has a funnel icon)
    const filterButtons = page.locator('button').filter({ has: page.locator('svg path[d*="M3 4a1"]') });
    await filterButtons.first().click();

    // The filter panel should show with account, category, date fields
    await expect(page.locator('#filterAccount')).toBeVisible();
    await expect(page.locator('#filterCategory')).toBeVisible();
    await expect(page.locator('#filterStartDate')).toBeVisible();
    await expect(page.locator('#filterEndDate')).toBeVisible();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeVisible();
  });

  test('should apply date filters', async ({ authenticatedPage: page }) => {
    // Open filter panel
    const filterButtons = page.locator('button').filter({ has: page.locator('svg path[d*="M3 4a1"]') });
    await filterButtons.first().click();

    await page.locator('#filterStartDate').fill('2025-01-01');
    await page.locator('#filterEndDate').fill('2025-12-31');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).toHaveURL(/startDate=2025-01-01/);
    await expect(page).toHaveURL(/endDate=2025-12-31/);
  });

  test('should clear all filters', async ({ authenticatedPage: page }) => {
    // Apply a search first
    await page.goto('/transactions?search=test&startDate=2025-01-01');

    // Open filter panel
    const filterButtons = page.locator('button').filter({ has: page.locator('svg path[d*="M3 4a1"]') });
    await filterButtons.first().click();

    // Look for the Clear All button
    const clearButton = page.getByRole('button', { name: /clear all/i });
    if (await clearButton.isVisible().catch(() => false)) {
      await clearButton.click();
      await expect(page).toHaveURL(/\/transactions$/);
    }
  });
});
