import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import { API_URL } from '$lib/server/api';

// Initialize Sentry on the server side (optional - only if DSN is provided)
const sentryDsn = process.env.PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.PUBLIC_SENTRY_RELEASE || undefined,

    // Server-side tracing - slightly higher rate than client
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

    // Scrub sensitive data
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        delete event.request.data;
      }
      return event;
    },
  });
}

const publicPathPrefixes = [
  '/',
  '/auth/login',
  '/auth/register',
  '/auth/setup',
  '/support',
  '/privacy',
  '/terms',
  '/security',
  '/sitemap.xml',
  '/.well-known',
];

function isPublicPath(pathname: string) {
  return publicPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export const handle: Handle = async ({ event, resolve }) => {
  const accessToken = event.cookies.get('access_token');
  const refreshToken = event.cookies.get('refresh_token');

  event.locals.user = null;
  event.locals.accessToken = accessToken ?? null;

  if (accessToken) {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        event.locals.user = await res.json();
      } else if (res.status === 401 && refreshToken) {
        // Try to refresh the token
        const refreshed = await tryRefreshToken(refreshToken);
        if (refreshed) {
          event.locals.user = refreshed.user;
          event.locals.accessToken = refreshed.accessToken;

          event.cookies.set('access_token', refreshed.accessToken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 15, // 15 minutes
          });
          event.cookies.set('refresh_token', refreshed.refreshToken, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
        } else {
          clearAuthCookies(event);
        }
      } else {
        clearAuthCookies(event);
      }
    } catch {
      // API unavailable
      clearAuthCookies(event);
    }
  } else if (refreshToken) {
    // No access token but have refresh token
    const refreshed = await tryRefreshToken(refreshToken);
    if (refreshed) {
      event.locals.user = refreshed.user;
      event.locals.accessToken = refreshed.accessToken;

      event.cookies.set('access_token', refreshed.accessToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 15,
      });
      event.cookies.set('refresh_token', refreshed.refreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }

  if (!event.locals.user && !isPublicPath(event.url.pathname)) {
    throw redirect(303, '/auth/login');
  }

  return resolve(event);
};

function clearAuthCookies(event: Parameters<Handle>[0]['event']) {
  event.cookies.delete('access_token', { path: '/' });
  event.cookies.delete('refresh_token', { path: '/' });
}

async function tryRefreshToken(refreshToken: string) {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const tokens = await res.json();

    // Get user info with new access token
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!meRes.ok) return null;

    const user = await meRes.json();
    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  } catch {
    return null;
  }
}

// Sentry error handler - captures unhandled errors in server hooks.
// Works as a passthrough when Sentry is not initialized.
export const handleError = Sentry.handleErrorWithSentry();
