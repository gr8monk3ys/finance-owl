import { describe, expect, it, vi } from 'vitest';
import { buildForwardedClientHeaders, setAuthCookies } from './auth';

describe('server auth helpers', () => {
	it('appends the trusted address after any inbound forwarded chain', () => {
		const headers = new Headers({
			'x-forwarded-for': '198.51.100.24',
			'x-real-ip': '198.51.100.24'
		});

		// The inbound header is attacker-controlled: it may be kept as
		// history, but the trusted address must be the right-most hop and
		// x-real-ip must never echo the spoofable inbound value.
		expect(buildForwardedClientHeaders(headers, '127.0.0.1')).toEqual({
			'x-forwarded-for': '198.51.100.24, 127.0.0.1',
			'x-real-ip': '127.0.0.1'
		});
	});

	it('falls back to the provided client address', () => {
		expect(buildForwardedClientHeaders(new Headers(), '127.0.0.1')).toEqual({
			'x-forwarded-for': '127.0.0.1',
			'x-real-ip': '127.0.0.1'
		});
	});

	it('sets both auth cookies with secure options', () => {
		const set = vi.fn();

		setAuthCookies(
			{ set },
			{ accessToken: 'access-token', refreshToken: 'refresh-token' },
			true
		);

		expect(set).toHaveBeenCalledTimes(2);
		expect(set).toHaveBeenNthCalledWith(
			1,
			'access_token',
			'access-token',
			expect.objectContaining({
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				path: '/',
				maxAge: 900
			})
		);
		expect(set).toHaveBeenNthCalledWith(
			2,
			'refresh_token',
			'refresh-token',
			expect.objectContaining({
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				path: '/',
				maxAge: 604800
			})
		);
	});
});
