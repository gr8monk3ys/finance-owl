import { create } from 'zustand';
import * as authApi from '../api/auth';
import {
  clearTokens,
  getAccessToken,
  getApiErrorMessage,
} from '../api/client';
import type { User, LoginRequest, RegisterRequest } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  /** Attempt to restore session from stored tokens. */
  initialize: () => Promise<void>;

  /** Log in with credentials. */
  login: (req: LoginRequest) => Promise<void>;

  /** Register a new account. */
  register: (req: RegisterRequest) => Promise<void>;

  /** Log out and clear tokens. */
  logout: () => Promise<void>;

  /** Clear any displayed error. */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await getAccessToken();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token expired or invalid -- clear and show login
      await clearTokens();
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  login: async (req) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.login(req);
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed');
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  register: async (req) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.register(req);
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const message = getApiErrorMessage(err, 'Registration failed');
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
