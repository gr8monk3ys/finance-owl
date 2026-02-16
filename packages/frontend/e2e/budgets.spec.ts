import { test, expect } from './fixtures';

test.describe('Budgets — Page load', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/budgets');
  });

  test('should load the budgets page', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveTitle(/Budgets/);
    await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
  });

  test('should display the Create Budget button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /create budget/i })).toBeVisible();
  });

  test('should display summary strip cards', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Total Budget')).toBeVisible();
    await expect(page.getByText('Total Spent')).toBeVisible();
    await expect(page.getByText('Remaining')).toBeVisible();
    await expect(page.getByText('Overall')).toBeVisible();
  });

  test('should show budget list or empty state', async ({ authenticatedPage: page }) => {
    const emptyState = page.getByText('No budgets yet');
    const budgetCards = page.locator('[class*="stagger-children"] > div');

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasBudgets = (await budgetCards.count()) > 0;

    expect(hasEmptyState || hasBudgets).toBe(true);
  });

  test('empty state should show the Create Your First Budget call to action', async ({
    authenticatedPage: page,
  }) => {
    const emptyState = page.getByText('No budgets yet');
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: /create your first budget/i })).toBeVisible();
    }
  });
});

test.describe('Budgets — Create a budget', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/budgets');
  });

  test('should open the Create Budget modal', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /create budget/i }).click();

    await expect(page.getByText('Create Budget', { exact: false })).toBeVisible();
    await expect(page.locator('#budgetCategory')).toBeVisible();
    await expect(page.locator('#budgetAmount')).toBeVisible();
    await expect(page.locator('#budgetPeriod')).toBeVisible();
    await expect(page.locator('#budgetRollover')).toBeVisible();
  });

  test('should show period options in the dropdown', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /create budget/i }).click();

    const periodSelect = page.locator('#budgetPeriod');
    const options = periodSelect.locator('option');

    await expect(options.filter({ hasText: 'Monthly' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Quarterly' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Yearly' })).toHaveCount(1);
  });

  test('should fill out and submit a new budget', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /create budget/i }).click();

    // Fill budget form — select the first available category
    const categorySelect = page.locator('#budgetCategory');
    const firstOption = categorySelect.locator('option').first();
    const firstValue = await firstOption.getAttribute('value');
    if (firstValue) {
      await categorySelect.selectOption(firstValue);
    }

    await page.locator('#budgetAmount').fill('500');
    await page.locator('#budgetPeriod').selectOption('monthly');

    // Submit
    await page
      .locator('form[action="?/create"]')
      .getByRole('button', { name: /create budget/i })
      .click();

    // The modal should close after successful creation
    await page.waitForTimeout(2_000);
    // Title "Create Budget" from the modal should not be visible
    const modalTitle = page.locator('[role="dialog"]').getByText('Create Budget');
    await expect(modalTitle).not.toBeVisible({ timeout: 10_000 });
  });

  test('should close the modal with the Cancel button', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /create budget/i }).click();
    await expect(page.getByText('Create Budget', { exact: false })).toBeVisible();

    await page
      .locator('form[action="?/create"]')
      .getByRole('button', { name: /cancel/i })
      .click();

    // Modal should be gone
    const modalTitle = page.locator('[role="dialog"]').getByText('Create Budget');
    await expect(modalTitle).not.toBeVisible();
  });

  test('should toggle the rollover checkbox', async ({ authenticatedPage: page }) => {
    await page.getByRole('button', { name: /create budget/i }).click();

    const rollover = page.locator('#budgetRollover');
    await expect(rollover).not.toBeChecked();

    await rollover.check();
    await expect(rollover).toBeChecked();

    await rollover.uncheck();
    await expect(rollover).not.toBeChecked();
  });
});
