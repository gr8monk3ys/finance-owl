import { publicLinks } from '$lib/config/public';
import type { RequestHandler } from './$types';

const pages = [
  { path: '', changefreq: 'weekly', priority: '1.0' },
  { path: 'support', changefreq: 'monthly', priority: '0.8' },
  { path: 'privacy', changefreq: 'yearly', priority: '0.7' },
  { path: 'terms', changefreq: 'yearly', priority: '0.7' },
  { path: 'security', changefreq: 'monthly', priority: '0.6' },
  { path: 'auth/login', changefreq: 'monthly', priority: '0.6' },
  { path: 'auth/register', changefreq: 'monthly', priority: '0.6' },
];

export const GET: RequestHandler = async () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${page.path ? `${publicLinks.homeUrl}${page.path}` : publicLinks.homeUrl}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
