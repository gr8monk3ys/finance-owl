/**
 * Design tokens matching the web app dark theme.
 */
export const colors = {
  // Surface palette (slate-based dark)
  surface: {
    900: '#0f172a',
    850: '#131c31',
    800: '#1e293b',
    750: '#243247',
    700: '#334155',
    600: '#475569',
    500: '#64748b',
    400: '#94a3b8',
    300: '#cbd5e1',
    200: '#e2e8f0',
    100: '#f1f5f9',
  },
  // Primary (emerald / green)
  primary: {
    950: '#022c22',
    900: '#064e3b',
    800: '#065f46',
    700: '#047857',
    600: '#059669',
    500: '#10b981',
    400: '#34d399',
    300: '#6ee7b7',
    200: '#a7f3d0',
  },
  // Accent (amber)
  accent: {
    500: '#f59e0b',
    400: '#fbbf24',
  },
  // Danger (red)
  danger: {
    500: '#ef4444',
    400: '#f87171',
  },
  // Semantic
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;
