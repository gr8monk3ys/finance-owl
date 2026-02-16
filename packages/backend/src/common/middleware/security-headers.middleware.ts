import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that sets strict security headers appropriate for a financial
 * application API. Applied globally to every response.
 *
 * Header reference:
 * - Content-Security-Policy:  Restricts resource loading to same-origin;
 *                              disables inline scripts, eval, and object embeds.
 * - Strict-Transport-Security: Forces HTTPS for 2 years, includes subdomains,
 *                              and enables HSTS preload submission.
 * - X-Frame-Options:           Prevents click-jacking by denying all framing.
 * - X-Content-Type-Options:    Prevents MIME-type sniffing.
 * - Referrer-Policy:           Sends only the origin (no path) on cross-origin
 *                              requests; full referrer for same-origin.
 * - Permissions-Policy:        Disables browser features not needed by a
 *                              financial API (camera, microphone, geolocation,
 *                              payment, etc.).
 * - X-Permitted-Cross-Domain-Policies: Prevents Adobe Flash/Acrobat from
 *                              loading data from this domain.
 * - Cache-Control / Pragma:    Prevents caching of API responses that may
 *                              contain sensitive financial data.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    // -- Content-Security-Policy --
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    );

    // -- HTTP Strict Transport Security --
    // max-age = 2 years (63072000 s), include subdomains, preload-ready
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );

    // -- Click-jacking protection --
    res.setHeader('X-Frame-Options', 'DENY');

    // -- MIME-sniffing protection --
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // -- Referrer leakage prevention --
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // -- Disable unnecessary browser APIs --
    res.setHeader(
      'Permissions-Policy',
      [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=()',
        'display-capture=()',
        'document-domain=()',
        'fullscreen=(self)',
        'interest-cohort=()',
      ].join(', '),
    );

    // -- Adobe cross-domain policy --
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // -- Prevent caching of sensitive API responses --
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // -- Remove the X-Powered-By header (information leakage) --
    res.removeHeader('X-Powered-By');

    next();
  }
}
