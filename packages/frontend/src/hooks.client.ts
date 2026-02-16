import * as Sentry from '@sentry/sveltekit';

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
	Sentry.init({
		dsn,
		environment: import.meta.env.MODE,
		release: import.meta.env.PUBLIC_SENTRY_RELEASE || undefined,

		// Performance monitoring - conservative sampling
		tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

		// Session replay - capture more on errors, less on normal sessions
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,

		integrations: [Sentry.replayIntegration(), Sentry.browserTracingIntegration()],

		// Scrub sensitive data before sending
		beforeSend(event) {
			// Remove sensitive request data
			if (event.request) {
				if (event.request.headers) {
					delete event.request.headers.authorization;
					delete event.request.headers.cookie;
				}
				// Don't send request bodies (may contain financial data)
				delete event.request.data;
			}

			// Scrub breadcrumb data for sensitive URLs
			if (event.breadcrumbs) {
				event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
					if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
						// Redact query params from URLs that might contain tokens
						if (breadcrumb.data?.url) {
							try {
								const url = new URL(breadcrumb.data.url, window.location.origin);
								// Remove any token/key query params
								for (const key of url.searchParams.keys()) {
									if (/token|key|secret|password/i.test(key)) {
										url.searchParams.set(key, '[Filtered]');
									}
								}
								breadcrumb.data.url = url.toString();
							} catch {
								// URL parsing failed, leave as-is
							}
						}
					}
					return breadcrumb;
				});
			}

			return event;
		},

		// Filter noisy or expected errors
		ignoreErrors: [
			// Browser extensions
			'ResizeObserver loop',
			'ResizeObserver loop limit exceeded',
			// Network errors (user offline, etc.)
			'Failed to fetch',
			'NetworkError',
			'Load failed',
			// Navigation aborted
			'AbortError',
			// Chrome extensions
			/^chrome-extension:\/\//,
		],

		// Only send errors from our own domain
		allowUrls: [/https?:\/\/(.*\.)?financeowl\./],
		// In development, also allow localhost
		...(import.meta.env.MODE !== 'production' && {
			allowUrls: [/https?:\/\/localhost/, /https?:\/\/(.*\.)?financeowl\./]
		})
	});
}

// Export handleError regardless of whether Sentry is initialized.
// When Sentry is not initialized, handleErrorWithSentry() returns a
// passthrough handler that doesn't send anything.
export const handleError = Sentry.handleErrorWithSentry();
