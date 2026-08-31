import { test, expect } from './fixtures';
import { clickAndExpectVisible, fillAndExpectUrl } from './helpers';

test.describe('Transactions — Page load', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/transactions');
  });

  test('should load the transactions page', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveTitle(/Transactions/);
    // The top bar renders an h1 with the same name, so target the page heading.
    await expect(page.getByRole('heading', { level: 2, name: 'Transactions' })).toBeVisible();
  });

  test('should display the Add Transaction button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /add transaction/i })).toBeVisible();
  });

  test('should display the search bar', async ({ authenticatedPage: page }) => {
    await expect(page.getByPlaceholder(/search by name, merchant, or amount/i)).toBeVisible();
  });

  test('should show the transaction list or empty state', async ({ authenticatedPage: page }) => {
    // Either we see the "No transactions yet" empty state or the header shows
    // the total transaction count above the list.
    const emptyState = page.getByText('No transactions yet');
    const transactionCount = page.getByText(/\d[\d,]* transactions?\b/).first();

    await expect(emptyState.or(transactionCount).first()).toBeVisible();
  });
});

test.describe('Transactions — Add manual transaction', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/transactions');
  });

  /** Open the Add Transaction modal, retrying until hydration lets the click through. */
  async function openCreateModal(page: import('@playwright/test').Page) {
    await clickAndExpectVisible(
      page.getByRole('button', { name: /add transaction/i }).first(),
      page.getByRole('heading', { name: 'Add Transaction' }),
    );
  }

  test('should open the Add Transaction modal', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    // Verify modal form fields
    await expect(page.locator('#txAccount')).toBeVisible();
    await expect(page.locator('#txAmount')).toBeVisible();
    await expect(page.locator('#txDate')).toBeVisible();
    await expect(page.locator('#txName')).toBeVisible();
  });

  test('should fill out and submit a new transaction', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    // Fill in the transaction form
    await page.locator('#txAmount').fill('42.50');
    await page.locator('#txName').fill('E2E Test Transaction');
    await page.locator('#txMerchant').fill('Test Merchant');
    // Date defaults to today, so we leave it as-is

    // Submit the form
    await page
      .locator('form[action="?/create"]')
      .getByRole('button', { name: /add transaction/i })
      .click();

    // After a successful create the modal closes and the page reloads.
    await expect(page.getByRole('heading', { name: 'Add Transaction' })).not.toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Transactions — Search and filter', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/transactions');
  });

  /** Open the filter panel, retrying until hydration lets the click through. */
  async function openFilterPanel(page: import('@playwright/test').Page) {
    await clickAndExpectVisible(
      page.getByRole('button', { name: 'Show filters' }),
      page.locator('#filterAccount'),
    );
  }

  test('should perform a text search', async ({ authenticatedPage: page }) => {
    // Search applies automatically (debounced) as you type.
    const searchInput = page.getByPlaceholder(/search by name, merchant, or amount/i);
    await fillAndExpectUrl(page, searchInput, 'grocery', /search=grocery/);
  });

  test('should toggle the filter panel', async ({ authenticatedPage: page }) => {
    await openFilterPanel(page);

    // The filter panel should show with account, category, date fields
    await expect(page.locator('#filterAccount')).toBeVisible();
    await expect(page.locator('#filterCategory')).toBeVisible();
    await expect(page.locator('#filterStartDate')).toBeVisible();
    await expect(page.locator('#filterEndDate')).toBeVisible();
    await expect(page.getByRole('button', { name: /apply filters/i })).toBeVisible();

    // Toggling again hides the panel
    await page.getByRole('button', { name: 'Hide filters' }).click();
    await expect(page.locator('#filterAccount')).not.toBeVisible();
  });

  test('should apply date filters', async ({ authenticatedPage: page }) => {
    await openFilterPanel(page);

    await page.locator('#filterStartDate').fill('2025-01-01');
    await page.locator('#filterEndDate').fill('2025-12-31');
    await page.getByRole('button', { name: /apply filters/i }).click();

    await expect(page).toHaveURL(/startDate=2025-01-01/);
    await expect(page).toHaveURL(/endDate=2025-12-31/);
  });

  test('should clear all filters', async ({ authenticatedPage: page }) => {
    // Apply a search and a date filter first
    await page.goto('/transactions?search=test&startDate=2025-01-01');

    await openFilterPanel(page);

    await page.getByRole('button', { name: /clear all/i }).click();
    await expect(page).toHaveURL(/\/transactions$/);
  });
});
