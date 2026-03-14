import * as Sentry from '@sentry/react-native';

/**
 * Initializes Sentry for crash reporting and performance monitoring.
 *
 * Only activates when EXPO_PUBLIC_SENTRY_DSN is set, making it a graceful
 * no-op in development or when not configured.
 */
export function configureSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    if (__DEV__) {
      console.log('[Sentry] No DSN configured; skipping initialization.');
    }
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    debug: __DEV__,
    enabled: !__DEV__,
  });
}

export { Sentry };
