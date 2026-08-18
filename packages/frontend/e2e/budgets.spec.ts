import { test, expect } from './fixtures';
import { clickAndExpectVisible } from './helpers';

test.describe('Budgets — Page load', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/budgets');
  });

  test('should load the budgets page', async ({ authenticatedPage: page }) => {
    await expect(page).toHaveTitle(/Budgets/);
    // The top bar renders an h1 with the same name, so target the page heading.
    await expect(page.getByRole('heading', { level: 2, name: 'Budgets' })).toBeVisible();
  });

  test('should display the Create Budget button', async ({ authenticatedPage: page }) => {
    await expect(page.getByRole('button', { name: /create budget/i })).toBeVisible();
  });

  test('should display summary strip cards', async ({ authenticatedPage: page }) => {
    await expect(page.getByText('Total Budget')).toBeVisible();
    await expect(page.getByText('Total Spent')).toBeVisible();
    await expect(page.getByText('Remaining', { exact: true })).toBeVisible();
    await expect(page.getByText('Overall', { exact: true })).toBeVisible();
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

  /** Open the Create Budget modal, retrying until hydration lets the click through. */
  async function openCreateModal(page: import('@playwright/test').Page) {
    await clickAndExpectVisible(
      page.getByRole('button', { name: /create budget/i }).first(),
      page.getByRole('heading', { name: 'Create Budget' }),
    );
  }

  test('should open the Create Budget modal', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    await expect(page.locator('#budgetCategory')).toBeVisible();
    await expect(page.locator('#budgetAmount')).toBeVisible();
    await expect(page.locator('#budgetPeriod')).toBeVisible();
    await expect(page.locator('#budgetRollover')).toBeVisible();
  });

  test('should show period options in the dropdown', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    const periodSelect = page.locator('#budgetPeriod');
    const options = periodSelect.locator('option');

    await expect(options.filter({ hasText: 'Monthly' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Quarterly' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'Annual' })).toHaveCount(1);
  });

  test('should fill out and submit a new budget', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    await page.locator('#budgetAmount').fill('500');

    // A category+period combination that already has a budget disables the
    // submit button, so walk periods and categories until we find a free slot.
    const categorySelect = page.locator('#budgetCategory');
    const categoryValues = await categorySelect.locator('option').evaluateAll((options) =>
      options
        .filter((o): o is HTMLOptionElement => o instanceof HTMLOptionElement)
        .filter((o) => !o.disabled && o.value)
        .map((o) => o.value),
    );
    expect(categoryValues.length).toBeGreaterThan(0);

    const submitButton = page
      .locator('form[action="?/create"]')
      .getByRole('button', { name: /create budget/i });

    let ready = false;
    outer: for (const period of ['monthly', 'weekly', 'biweekly', 'quarterly', 'annual']) {
      await page.locator('#budgetPeriod').selectOption(period);
      for (const value of categoryValues) {
        await categorySelect.selectOption(value);
        if (await submitButton.isEnabled()) {
          ready = true;
          break outer;
        }
      }
    }
    expect(ready).toBe(true);

    await submitButton.click();

    // The modal should close after successful creation
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
  });

  test('should close the modal with the Cancel button', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    await page
      .locator('form[action="?/create"]')
      .getByRole('button', { name: /cancel/i })
      .click();

    // Modal should be gone
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('should toggle the rollover checkbox', async ({ authenticatedPage: page }) => {
    await openCreateModal(page);

    const rollover = page.locator('#budgetRollover');
    await expect(rollover).not.toBeChecked();

    await rollover.check();
    await expect(rollover).toBeChecked();

    await rollover.uncheck();
    await expect(rollover).not.toBeChecked();
  });
});
