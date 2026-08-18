import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

/** Branding configuration for the current tenant */
export interface TenantBranding {
  id: string | null;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  appName: string;
  status: string;
}

const DEFAULT_BRANDING: TenantBranding = {
  id: null,
  name: 'Finance Owl',
  slug: '',
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#10b981',
  accentColor: '#f59e0b',
  appName: 'Finance Owl',
  status: 'active',
};

/** Writable store for tenant branding. Fetched on app load, used to customize colors, logo, app name. */
export const tenantBranding = writable<TenantBranding>(DEFAULT_BRANDING);

/** Whether we are in multi-tenant mode (a tenant was resolved) */
export const isMultiTenant = derived(tenantBranding, ($b) => $b.id !== null);

/** The display name for the app (respects tenant branding) */
export const appName = derived(tenantBranding, ($b) => $b.appName || 'Finance Owl');

/**
 * Converts a hex color to CSS custom property values.
 * Generates HSL values for use in Tailwind-style theming.
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Applies tenant branding colors as CSS custom properties on :root.
 * This enables the rest of the app to use them seamlessly.
 */
export function applyBrandingCSS(branding: TenantBranding): void {
  if (!browser) return;

  const root = document.documentElement;

  // Apply primary color
  const primary = hexToHSL(branding.primaryColor);
  if (primary) {
    root.style.setProperty('--tenant-primary', branding.primaryColor);
    root.style.setProperty('--tenant-primary-h', String(primary.h));
    root.style.setProperty('--tenant-primary-s', `${primary.s}%`);
    root.style.setProperty('--tenant-primary-l', `${primary.l}%`);
  }

  // Apply accent color
  const accent = hexToHSL(branding.accentColor);
  if (accent) {
    root.style.setProperty('--tenant-accent', branding.accentColor);
    root.style.setProperty('--tenant-accent-h', String(accent.h));
    root.style.setProperty('--tenant-accent-s', `${accent.s}%`);
    root.style.setProperty('--tenant-accent-l', `${accent.l}%`);
  }

  // Apply favicon if provided
  if (branding.faviconUrl) {
    const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (existingFavicon) {
      existingFavicon.href = branding.faviconUrl;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = branding.faviconUrl;
      document.head.appendChild(link);
    }
  }

  // Apply title
  if (branding.appName) {
    const titleSuffix = document.title.includes(' - ')
      ? document.title.split(' - ').slice(1).join(' - ')
      : '';
    document.title = titleSuffix ? `${branding.appName} - ${titleSuffix}` : branding.appName;
  }
}

/**
 * Initialize tenant branding from server-provided data.
 * Called from the layout load function.
 */
export function initTenantBranding(data: Partial<TenantBranding> | null): void {
  if (!data) {
    tenantBranding.set(DEFAULT_BRANDING);
    return;
  }

  const merged: TenantBranding = {
    ...DEFAULT_BRANDING,
    ...data,
  };

  tenantBranding.set(merged);

  if (browser) {
    applyBrandingCSS(merged);
  }
}
