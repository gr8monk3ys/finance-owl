# Security Policy

## Supported Versions

Security updates are provided for the latest default branch.

## Reporting a Vulnerability

Please report vulnerabilities privately via GitHub Security Advisories or by contacting the maintainer directly.
Do not open public issues for undisclosed vulnerabilities.

We will acknowledge receipt and provide next steps as quickly as possible.

For private disclosure, use GitHub Security Advisories: [https://github.com/gr8monk3ys/finance-owl/security/advisories](https://github.com/gr8monk3ys/finance-owl/security/advisories).

---

## Authentication Architecture

### JWT Token Flow

- **Algorithm:** HS256 (HMAC with SHA-256)
- **Secret requirements:** Minimum 32 characters, validated at startup (app exits if missing in production)
- **Access tokens:** 15-minute expiry (configurable via `JWT_ACCESS_EXPIRY`)
- **Refresh tokens:** 7-day expiry (configurable via `JWT_REFRESH_EXPIRY`), cryptographically random (32 bytes hex-encoded)
- **Token rotation:** Old refresh tokens are invalidated immediately upon use
- **Algorithm confusion protection:** Explicit algorithm verification prevents algorithm switching attacks
- **Session management:** All sessions tracked in database with per-session refresh tokens

### Password Security

- **Hashing:** Argon2id (memory-hard, resistant to GPU/ASIC attacks)
- **Parameters:** 64 MB memory, 3 iterations, 4 threads
- **Timing attack prevention:** Dummy hash performed on non-existent user accounts to prevent user enumeration
- **Password strength:** Minimum 8 characters, requires uppercase, lowercase, and digit (enforced in both shared Zod schemas and backend DTOs)

### WebAuthn/FIDO2

- Uses SimpleWebAuthn library for FIDO2 server-side verification
- **Challenge storage:** Redis-backed with 5-minute TTL, single-use (deleted after verification)
- **Replay protection:** Credential counter checked and updated on each authentication
- **Origin/RP verification:** Strict validation of origin and Relying Party ID

## Encryption (Data at Rest)

- **Algorithm:** AES-256-GCM with authenticated encryption
- **Key derivation:** PBKDF2-SHA512 with per-encryption 128-bit salt, 100,000 iterations
- **IV:** 96-bit (NIST-recommended for GCM), randomly generated per encryption
- **Auth tag:** 128-bit for integrity verification
- **Wire format:** `Version(1) + Salt(16) + IV(12) + AuthTag(16) + Ciphertext`
- **Versioning:** Version byte enables transparent key rotation
- **Master secret:** Minimum 32 characters, stored in `ENCRYPTION_MASTER_SECRET` environment variable

## CSRF Mitigation

Finance Owl uses JWT bearer tokens in the `Authorization` header (not cookie-based authentication). This architecture is inherently resistant to CSRF attacks because:

1. Tokens are stored in memory/localStorage, not automatically attached to requests
2. Cross-origin requests cannot read or set the `Authorization` header
3. The `SameSite` cookie attribute is not relied upon for security

This is a deliberate design decision. No additional CSRF tokens are required.

## Input Validation & XSS Prevention

- **Global SanitizePipe:** Strips HTML tags and comments from all string inputs
- **DTO validation:** class-validator enforces email format, length constraints, and regex patterns
- **Whitelist mode:** Unknown properties are stripped (`whitelist: true`) and rejected (`forbidNonWhitelisted: true`)
- **Production mode:** Error messages suppressed to prevent information leakage
- **SQL injection:** Prevented by Drizzle ORM parameterized queries

## Security Headers

### Helmet Configuration

| Header                 | Value                                          |
| ---------------------- | ---------------------------------------------- |
| HSTS                   | `max-age=31536000; includeSubDomains; preload` |
| X-Frame-Options        | `DENY`                                         |
| X-Content-Type-Options | `nosniff`                                      |
| Referrer-Policy        | `strict-origin-when-cross-origin`              |
| COEP                   | Enabled                                        |
| COOP                   | Enabled                                        |
| CORP                   | `same-origin`                                  |

### Content Security Policy

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` (required for Swagger UI)
- `style-src 'self' 'unsafe-inline'` (required for Swagger UI)
- `object-src 'none'`, `frame-src 'none'`

### Cache Control

All responses include `no-store, no-cache, must-revalidate, proxy-revalidate` to prevent caching of sensitive financial data.

## Webhook Verification

### Plaid

- JWT signature verification using ES256 with Plaid-provided public keys
- Request body SHA-256 hash validation
- Token age validation (max 5 minutes with 60-second clock skew tolerance)
- Note: Verification is skipped in sandbox mode (Plaid sandbox sends invalid JWTs)

### Stripe

- HMAC signature verification using webhook signing secret
- Raw body capture enabled for accurate signature computation

## Rate Limiting

- **Global:** 100 requests per 60 seconds (application-wide)
- **Per-route:** Token-bucket limiter via `@RateLimit()` decorator
- **Webhooks:** 30 requests per 60 seconds

## CI Security Scanning

7 automated security scanners run in CI:

1. **CodeQL** - Static analysis for vulnerabilities
2. **Semgrep** - Pattern-based security scanning
3. **TruffleHog** - Secret detection in code
4. **Trivy** - Container image vulnerability scanning
5. **Gitleaks** - Git history secret scanning
6. **OSV-Scanner** - Open-source vulnerability database
7. **pnpm audit** - Dependency vulnerability checking

All GitHub Actions workflow actions are SHA-pinned to prevent supply chain attacks.

## Deployment Security Checklist

Before deploying to production, verify:

- [ ] `JWT_SECRET` is set to a unique, random string (minimum 32 characters)
- [ ] `JWT_REFRESH_SECRET` is set to a different unique, random string
- [ ] `ENCRYPTION_KEY` / `ENCRYPTION_MASTER_SECRET` is set (minimum 32 characters)
- [ ] `NODE_ENV` is set to `production`
- [ ] Database connection uses SSL (`?sslmode=require`)
- [ ] `CORS_ORIGIN` is set to the exact frontend domain (not `*`)
- [ ] `SENTRY_DSN` is configured for error monitoring
- [ ] Stripe webhook signing secret is configured
- [ ] Plaid webhook verification is enabled (non-sandbox mode)
- [ ] All default/example secrets from `.env.example` have been replaced
- [ ] Database credentials use least-privilege access
- [ ] Rate limiting is enabled and appropriately configured
- [ ] HTTPS is enforced at the load balancer/reverse proxy level
