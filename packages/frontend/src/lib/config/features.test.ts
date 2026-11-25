import { describe, expect, it } from 'vitest';
import { isRouteAvailable, isWidgetAvailable } from './features';

describe('feature availability', () => {
  it('keeps pages backed by live modules', () => {
    for (const href of [
      '/dashboard',
      '/accounts',
      '/transactions?action=add',
      '/budgets',
      '/bills',
      '/subscriptions',
      '/savings',
      '/household',
      '/settings/security',
      '/settings/privacy',
    ]) {
      expect(isRouteAvailable(href), href).toBe(true);
    }
  });

  it('hides pages whose backend was removed, including their sub-pages', () => {
    for (const href of [
      '/credit',
      '/credit/simulator',
      '/bills/negotiate/wizard',
      '/bills/calendar',
      '/investments/fees',
      '/reports',
      '/settings/notifications',
      '/smart-savings/round-ups',
    ]) {
      expect(isRouteAvailable(href), href).toBe(false);
    }
  });

  it('matches whole path segments only', () => {
    expect(isRouteAvailable('/creditors')).toBe(true);
    expect(isRouteAvailable('/billsplit')).toBe(true);
  });

  it('hides dashboard widgets fed only by removed endpoints', () => {
    expect(isWidgetAvailable('credit-score')).toBe(false);
    expect(isWidgetAvailable('safe-to-spend')).toBe(false);
    expect(isWidgetAvailable('net-worth')).toBe(true);
    expect(isWidgetAvailable('recent-transactions')).toBe(true);
    expect(isWidgetAvailable('upcoming-bills')).toBe(true);
    expect(isWidgetAvailable('quick-actions')).toBe(true);
  });
});
