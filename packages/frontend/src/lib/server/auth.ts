import type { Cookies } from '@sveltejs/kit';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

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
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookies.set('refresh_token', tokens.refreshToken, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}
