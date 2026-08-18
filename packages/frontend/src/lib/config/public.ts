import { env } from '$env/dynamic/public';

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
  readValue(env.PUBLIC_SITE_URL, 'http://localhost:3000'),
  'http://localhost:3000',
);

export const publicSite = Object.freeze({
  appName: readValue(env.PUBLIC_COMPANY_NAME, 'Finance Owl'),
  legalEntityName: readValue(
    env.PUBLIC_LEGAL_ENTITY_NAME,
    readValue(env.PUBLIC_COMPANY_NAME, 'Finance Owl'),
  ),
  companyAddress: readValue(env.PUBLIC_COMPANY_ADDRESS),
  siteUrl,
  supportEmail: readValue(env.PUBLIC_SUPPORT_EMAIL, 'support@financeowl.com'),
  privacyEmail: readValue(env.PUBLIC_PRIVACY_EMAIL, 'privacy@financeowl.com'),
  legalEmail: readValue(env.PUBLIC_LEGAL_EMAIL, 'legal@financeowl.com'),
  securityEmail: readValue(env.PUBLIC_SECURITY_EMAIL, 'security@financeowl.com'),
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
