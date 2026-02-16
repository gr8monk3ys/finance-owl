import client, { setTokens, clearTokens, getRefreshToken } from './client';
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '../types';

/**
 * Register a new user account.
 */
export async function register(req: RegisterRequest): Promise<AuthTokens> {
  const { data } = await client.post<AuthTokens>('/auth/register', req);
  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

/**
 * Log in with email and password. Optionally provide a TOTP code for 2FA.
 */
export async function login(req: LoginRequest): Promise<AuthTokens> {
  const { data } = await client.post<AuthTokens>('/auth/login', req);
  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refresh(): Promise<AuthTokens> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const { data } = await client.post<AuthTokens>('/auth/refresh', { refreshToken });
  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

/**
 * Get the currently authenticated user's profile.
 */
export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/auth/me');
  return data;
}

/**
 * Log out the current session (invalidates the refresh token).
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await client.post('/auth/logout', { refreshToken });
    }
  } finally {
    await clearTokens();
  }
}
