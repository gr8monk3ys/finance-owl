import { untrack } from 'svelte';
import { page } from '$app/state';
import { replaceState } from '$app/navigation';

/**
 * Deep-linkable view state. A page seeds a `$state` from `readParam`, then
 * mirrors it back with `syncParam` inside an `$effect`, so tabs, sort order
 * and client-side filters survive a reload and can be shared as a link.
 * `replaceState` updates the address bar without a navigation, so no load
 * function re-runs and the history stack does not fill with every click.
 */

/** The query-string value for `key`, or `fallback` when absent or not in `allowed`. */
export function readParam<T extends string>(key: string, fallback: T, allowed?: readonly T[]): T {
  const raw = page.url.searchParams.get(key);
  if (raw === null) return fallback;
  if (allowed && !allowed.includes(raw as T)) return fallback;
  return raw as T;
}

/**
 * Write `value` to `key`, dropping the param when it equals the default.
 * Reads the live location rather than `page.url` so the calling effect
 * depends only on `value`: a route change must never re-run it and stamp
 * this page's params onto the next page.
 */
export function syncParam(key: string, value: string | null, fallback: string | null): void {
  const url = new URL(window.location.href);
  const current = url.searchParams.get(key);
  const next = value === fallback || value === null || value === '' ? null : value;
  if (current === next) return;
  if (next === null) url.searchParams.delete(key);
  else url.searchParams.set(key, next);
  untrack(() => replaceState(url, page.state));
}
