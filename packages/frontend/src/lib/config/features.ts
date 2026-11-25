/**
 * Features whose backend was removed in the module prune (#55, see #197).
 *
 * Their pages and components stay in the codebase, but every entry point to
 * them (sidebar, settings, dashboard) reads this list and hides them. When a
 * backend comes back, delete its entry here and the links reappear.
 */
const UNAVAILABLE_ROUTES = [
  '/admin/tenants',
  '/advisor-sharing',
  '/ask',
  '/assets',
  '/banking',
  '/benchmarking',
  '/bills/calendar',
  '/bills/negotiate',
  '/challenges',
  '/community',
  '/credit',
  '/crypto',
  '/debt-payoff',
  '/discover',
  '/envelopes',
  '/financial-health',
  '/flagged',
  '/forecast',
  '/identity',
  '/investments',
  '/learn',
  '/marketplace',
  '/real-estate',
  '/receipts',
  '/referrals',
  '/reports',
  '/retirement',
  '/settings/currency',
  '/settings/notifications',
  '/smart-savings',
  '/tax',
  '/vehicles',
  '/year-review',
];

/** Dashboard widgets whose data comes only from removed endpoints (`/analytics`, `/credit`). */
const UNAVAILABLE_WIDGETS = new Set([
  'cash-flow',
  'credit-score',
  'safe-to-spend',
  'spending-category',
]);

/** False when `href` is, or sits under, a page whose backend no longer exists. */
export function isRouteAvailable(href: string): boolean {
  const path = href.split(/[?#]/)[0];
  return !UNAVAILABLE_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

export function isWidgetAvailable(type: string): boolean {
  return !UNAVAILABLE_WIDGETS.has(type);
}
