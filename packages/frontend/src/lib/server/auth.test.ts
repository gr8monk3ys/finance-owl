import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ACCESS_TOKEN_MAX_AGE,
  buildForwardedClientHeaders,
  resolveAccessTokenMaxAge,
  setAuthCookies,
} from './auth';

describe('server auth helpers', () => {
  it('appends the trusted address after any inbound forwarded chain', () => {
    const headers = new Headers({
      'x-forwarded-for': '198.51.100.24',
      'x-real-ip': '198.51.100.24',
    });

    // The inbound header is attacker-controlled: it may be kept as
    // history, but the trusted address must be the right-most hop and
    // x-real-ip must never echo the spoofable inbound value.
    expect(buildForwardedClientHeaders(headers, '127.0.0.1')).toEqual({
      'x-forwarded-for': '198.51.100.24, 127.0.0.1',
      'x-real-ip': '127.0.0.1',
    });
  });

  it('falls back to the provided client address', () => {
    expect(buildForwardedClientHeaders(new Headers(), '127.0.0.1')).toEqual({
      'x-forwarded-for': '127.0.0.1',
      'x-real-ip': '127.0.0.1',
    });
  });

  it('sets both auth cookies with secure options', () => {
    const set = vi.fn();

    setAuthCookies({ set }, { accessToken: 'access-token', refreshToken: 'refresh-token' }, true);

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
        maxAge: 900,
      }),
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
        maxAge: 604800,
      }),
    );
  });

  it('drives the access cookie lifetime from the API-reported expiry', () => {
    const set = vi.fn();

    // The backend reads JWT_ACCESS_EXPIRY from env and reports the result as
    // `expiresIn`. Hardcoding 15 minutes here logged everyone out early on any
    // deployment that changed it, with nothing in the UI to explain why.
    setAuthCookies(
      { set },
      { accessToken: 'access-token', refreshToken: 'refresh-token', expiresIn: 3600 },
      true,
    );

    expect(set).toHaveBeenNthCalledWith(
      1,
      'access_token',
      'access-token',
      expect.objectContaining({ maxAge: 3600 }),
    );
  });

  it('falls back to the backend default when the API omits expiresIn', () => {
    const set = vi.fn();

    setAuthCookies({ set }, { accessToken: 'access-token', refreshToken: 'refresh-token' }, true);

    expect(set).toHaveBeenNthCalledWith(
      1,
      'access_token',
      'access-token',
      expect.objectContaining({ maxAge: DEFAULT_ACCESS_TOKEN_MAX_AGE }),
    );
  });
});

describe('resolveAccessTokenMaxAge', () => {
  it('accepts a sane positive lifetime', () => {
    expect(resolveAccessTokenMaxAge(3600)).toBe(3600);
    expect(resolveAccessTokenMaxAge(900.9)).toBe(900);
  });

  it('falls back on anything unusable rather than trusting it', () => {
    for (const value of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, '3600']) {
      expect(resolveAccessTokenMaxAge(value)).toBe(DEFAULT_ACCESS_TOKEN_MAX_AGE);
    }
  });

  it('never outlives the refresh cookie', () => {
    expect(resolveAccessTokenMaxAge(60 * 60 * 24 * 365)).toBe(60 * 60 * 24 * 7);
  });
});
