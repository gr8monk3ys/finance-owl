import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'fo_access_token';
const REFRESH_KEY = 'fo_refresh_token';
const REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:4000/api'
    : 'http://localhost:4000/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

type Primitive = string | number | boolean;
type QueryValue = Primitive | Primitive[] | null | undefined;
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ResponseShape<T> {
  data: T;
}

interface RequestOptions<TBody = unknown> {
  data?: TBody;
  headers?: Record<string, string>;
  includeAuth?: boolean;
  params?: object;
  retryOnUnauthorized?: boolean;
}

interface ErrorResponseBody {
  message?: string | string[];
  [key: string]: unknown;
}

export class ApiError<T = ErrorResponseBody> extends Error {
  readonly status: number;
  readonly response: {
    data: T;
    status: number;
  };

  constructor(message: string, status: number, data: T) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = { data, status };
  }
}

function appendQueryParams(url: URL, params?: object): void {
  if (!params) return;

  Object.entries(params as Record<string, QueryValue>).forEach(
    ([key, rawValue]) => {
      if (rawValue === null || rawValue === undefined) return;

      if (Array.isArray(rawValue)) {
        rawValue.forEach((value) => {
          if (value === null || value === undefined) return;
          url.searchParams.append(key, String(value));
        });
        return;
      }

      url.searchParams.append(key, String(rawValue));
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractMessage(data: unknown, fallback: string): string {
  if (isRecord(data)) {
    const message = data.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (Array.isArray(message)) {
      const messages = message.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
      if (messages.length > 0) {
        return messages.join(', ');
      }
    }
  }

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  return fallback;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (!text) {
    return null;
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text) as unknown;
  }

  return text;
}

async function performFetch<T, TBody = unknown>(
  method: HttpMethod,
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<ResponseShape<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(
      normalizedPath,
      API_URL.endsWith('/') ? API_URL : `${API_URL}/`,
    );
    appendQueryParams(url, options.params);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.data !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.includeAuth !== false) {
      const token = await getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body:
        options.data === undefined ? undefined : JSON.stringify(options.data),
      signal: controller.signal,
    });

    const data = await parseResponseBody(response);

    if (!response.ok) {
      throw new ApiError(
        extractMessage(data, `Request failed with status ${response.status}`),
        response.status,
        (data ?? {}) as ErrorResponseBody,
      );
    }

    return { data: data as T };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. Check your connection and try again.',
        408,
        {},
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Network request failed',
      0,
      {},
    );
  } finally {
    clearTimeout(timeout);
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new ApiError('No refresh token available', 401, {});
    }

    const { data } = await performFetch<{
      accessToken: string;
      refreshToken: string;
    }, { refreshToken: string }>('POST', '/auth/refresh', {
      data: { refreshToken },
      includeAuth: false,
      retryOnUnauthorized: false,
    });

    await setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function request<T, TBody = unknown>(
  method: HttpMethod,
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<ResponseShape<T>> {
  try {
    return await performFetch<T, TBody>(method, path, options);
  } catch (error) {
    const shouldAttemptRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      options.retryOnUnauthorized !== false &&
      !path.includes('/auth/refresh');

    if (!shouldAttemptRefresh) {
      throw error;
    }

    try {
      const refreshedToken = await refreshAccessToken();
      return await performFetch<T, TBody>(method, path, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${refreshedToken}`,
        },
        retryOnUnauthorized: false,
      });
    } catch (refreshError) {
      await clearTokens();
      throw refreshError;
    }
  }
}

const client = {
  get<T>(path: string, options?: Omit<RequestOptions, 'data'>) {
    return request<T>('GET', path, options);
  },

  post<T, TBody = unknown>(
    path: string,
    data?: TBody,
    options?: Omit<RequestOptions<TBody>, 'data'>,
  ) {
    return request<T, TBody>('POST', path, { ...options, data });
  },

  patch<T, TBody = unknown>(
    path: string,
    data?: TBody,
    options?: Omit<RequestOptions<TBody>, 'data'>,
  ) {
    return request<T, TBody>('PATCH', path, { ...options, data });
  },

  delete<T = void>(path: string, options?: Omit<RequestOptions, 'data'>) {
    return request<T>('DELETE', path, options);
  },
};

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong',
): string {
  if (error instanceof ApiError) {
    return extractMessage(error.response.data, error.message || fallback);
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export default client;
