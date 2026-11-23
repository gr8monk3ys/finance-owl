import {
  PUBLIC_SITE_URL,
  PUBLIC_COMPANY_NAME,
  PUBLIC_LEGAL_ENTITY_NAME,
  PUBLIC_COMPANY_ADDRESS,
  PUBLIC_SUPPORT_EMAIL,
  PUBLIC_PRIVACY_EMAIL,
  PUBLIC_LEGAL_EMAIL,
  PUBLIC_SECURITY_EMAIL,
} from '$app/env/public';

function readValue(value: string | undefined, fallback = ''): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeUrl(value: string, fallback: string): string {
  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

const siteUrl = normalizeUrl(
  readValue(PUBLIC_SITE_URL, 'http://localhost:3000'),
  'http://localhost:3000',
);

export const publicSite = Object.freeze({
  appName: readValue(PUBLIC_COMPANY_NAME, 'Finance Owl'),
  legalEntityName: readValue(
    PUBLIC_LEGAL_ENTITY_NAME,
    readValue(PUBLIC_COMPANY_NAME, 'Finance Owl'),
  ),
  companyAddress: readValue(PUBLIC_COMPANY_ADDRESS),
  siteUrl,
  supportEmail: readValue(PUBLIC_SUPPORT_EMAIL, 'support@financeowl.com'),
  privacyEmail: readValue(PUBLIC_PRIVACY_EMAIL, 'privacy@financeowl.com'),
  legalEmail: readValue(PUBLIC_LEGAL_EMAIL, 'legal@financeowl.com'),
  securityEmail: readValue(PUBLIC_SECURITY_EMAIL, 'security@financeowl.com'),
});

export const publicMailto = Object.freeze({
  support: `mailto:${publicSite.supportEmail}`,
  privacy: `mailto:${publicSite.privacyEmail}`,
  legal: `mailto:${publicSite.legalEmail}`,
  security: `mailto:${publicSite.securityEmail}`,
});

export const publicRoutes = Object.freeze({
  home: '/',
  support: '/support',
  privacy: '/privacy',
  terms: '/terms',
  security: '/security',
  securityText: '/.well-known/security.txt',
});

export const publicLinks = Object.freeze({
  homeUrl: `${publicSite.siteUrl}/`,
  supportUrl: `${publicSite.siteUrl}${publicRoutes.support}`,
  privacyUrl: `${publicSite.siteUrl}${publicRoutes.privacy}`,
  termsUrl: `${publicSite.siteUrl}${publicRoutes.terms}`,
  securityUrl: `${publicSite.siteUrl}${publicRoutes.security}`,
  securityTextUrl: `${publicSite.siteUrl}${publicRoutes.securityText}`,
});
