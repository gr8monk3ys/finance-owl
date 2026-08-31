import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Click a trigger and wait for a result locator to become visible.
 *
 * The SvelteKit dev server streams hydration after the initial HTML is
 * rendered, so a click dispatched too early is silently dropped (the
 * event listener is not attached yet). Retrying the click until the
 * expected UI appears makes interaction tests immune to that race.
 */
export async function clickAndExpectVisible(
  trigger: Locator,
  result: Locator,
  timeout = 20_000,
): Promise<void> {
  await expect(async () => {
    await trigger.click();
    await expect(result).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout });
}

/**
 * Fill an input and wait for the page URL to match a pattern.
 * Retried for the same hydration reason as clickAndExpectVisible —
 * a value typed before hydration never reaches the Svelte binding.
 */
export async function fillAndExpectUrl(
  page: Page,
  input: Locator,
  value: string,
  url: RegExp,
  timeout = 20_000,
): Promise<void> {
  await expect(async () => {
    await input.fill(value);
    await expect(page).toHaveURL(url, { timeout: 3_000 });
  }).toPass({ timeout });
}
