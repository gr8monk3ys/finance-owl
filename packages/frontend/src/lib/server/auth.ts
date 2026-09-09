import type { Cookies } from '@sveltejs/kit';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /**
   * Access-token lifetime in seconds, as reported by the API. The backend
   * derives it from `JWT_ACCESS_EXPIRY`, so it is the only trustworthy value —
   * a hardcoded frontend constant silently logs everyone out early whenever
   * that env var is not the default.
   */
  expiresIn?: number;
}

/**
 * Only used when the API response carries no `expiresIn`. It matches the
 * backend's own default (`JWT_ACCESS_EXPIRY=15m`), so a deployment on defaults
 * behaves identically; anything else is driven by the response.
 */
export const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Cookies outliving their token strand the user on a dead session; cookies
 * expiring early log them out for no visible reason. Trust the API, but refuse
 * nonsense (negative, zero, absurdly long, non-numeric).
 */
const MAX_ACCESS_TOKEN_MAX_AGE = REFRESH_TOKEN_MAX_AGE;

export function resolveAccessTokenMaxAge(expiresIn: unknown): number {
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return DEFAULT_ACCESS_TOKEN_MAX_AGE;
  }
  return Math.min(Math.floor(expiresIn), MAX_ACCESS_TOKEN_MAX_AGE);
}

export function buildForwardedClientHeaders(
  requestHeaders: Headers,
  clientIp: string,
): Record<string, string> {
  // clientIp comes from SvelteKit's getClientAddress(), which is derived
  // from the platform's own trusted proxy handling. The inbound
  // x-forwarded-for header is attacker-controlled, so it is only kept as
  // leading history — the trusted address is always appended as the
  // right-most hop, which is the entry the backend (trust proxy = 1)
  // uses for rate limiting. Never let a spoofed header replace it.
  const inboundChain = requestHeaders.get('x-forwarded-for');
  const forwardedFor = inboundChain ? `${inboundChain}, ${clientIp}` : clientIp;

  return {
    'x-forwarded-for': forwardedFor,
    'x-real-ip': clientIp,
  };
}

export function setAuthCookies(
  cookies: Pick<Cookies, 'set'>,
  tokens: AuthTokens,
  isProduction = process.env.NODE_ENV === 'production',
): void {
  cookies.set('access_token', tokens.accessToken, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: resolveAccessTokenMaxAge(tokens.expiresIn),
  });

  cookies.set('refresh_token', tokens.refreshToken, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}
