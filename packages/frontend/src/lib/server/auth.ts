import type { Cookies } from '@sveltejs/kit';

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export function buildForwardedClientHeaders(
	requestHeaders: Headers,
	fallbackIp: string
): Record<string, string> {
	const forwardedFor = requestHeaders.get('x-forwarded-for') || fallbackIp;
	const realIp = requestHeaders.get('x-real-ip') || forwardedFor;

	return {
		'x-forwarded-for': forwardedFor,
		'x-real-ip': realIp
	};
}

export function setAuthCookies(
	cookies: Pick<Cookies, 'set'>,
	tokens: AuthTokens,
	isProduction = process.env.NODE_ENV === 'production'
): void {
	cookies.set('access_token', tokens.accessToken, {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'lax',
		maxAge: ACCESS_TOKEN_MAX_AGE
	});

	cookies.set('refresh_token', tokens.refreshToken, {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'lax',
		maxAge: REFRESH_TOKEN_MAX_AGE
	});
}
