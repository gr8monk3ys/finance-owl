# Launch Readiness

This document is the single place to track what must be true before Finance Owl goes live on the web and in the App Store.

## Command Gates

Run these from the repo root before any launch candidate:

```bash
pnpm launch:check
pnpm launch:verify
```

`pnpm launch:check` validates launch docs, public support/legal assets, production env wiring, provider configuration, and App Store submission prerequisites.

`pnpm launch:verify` runs the code-level gates on top of that:

- backend typecheck and tests
- frontend typecheck, coverage suite, and production build
- mobile typecheck, lint, Expo doctor, and platform exports
- Playwright public-route and critical browser suites against an auto-started production preview when `API_URL` is reachable
- Lighthouse against the same auto-started production preview when `API_URL` is reachable

## Public Web Launch

- `PUBLIC_SITE_URL` is configured with the production HTTPS domain.
- `API_URL` points at the production HTTPS backend.
- `/support` is public and works as the customer support URL.
- `/privacy`, `/terms`, and `/security` are public and accurate.
- `sitemap.xml` and `/.well-known/security.txt` are live.
- Public contact emails are real inboxes that someone monitors:
  - `PUBLIC_SUPPORT_EMAIL`
  - `PUBLIC_PRIVACY_EMAIL`
  - `PUBLIC_LEGAL_EMAIL`
  - `PUBLIC_SECURITY_EMAIL`
- The legal entity name and address shown on public pages are reviewed and correct.

## Backend / Infrastructure

- Production secrets are set:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `ENCRYPTION_KEY`
  - `ENCRYPTION_MASTER_SECRET`
- CORS is locked to the public frontend origin.
- Backups are configured for the production database.
- Logs and monitoring are enabled.
- Health endpoints are checked from the deployed environment.

## Feature-backed Services

Only launch features that are fully backed by live providers.

- Plaid configured if bank linking is part of launch.
- Stripe configured if paid plans are part of launch.
- SMTP configured if transactional email is part of launch.
- WebAuthn origin configured if passkeys are part of launch.
- Sentry configured before broad launch.

If one of these is missing, either:

- finish the integration, or
- remove the promise from public copy and release notes

## Mobile / App Store

- Apple Developer Program membership is active.
- The Account Holder has accepted the latest Apple agreement in App Store Connect.
- If paid apps or subscriptions are part of launch, Agreements, Tax, and Banking are complete in App Store Connect.
- `EXPO_OWNER` is set.
- `EXPO_PROJECT_ID` is set.
- `EXPO_PUBLIC_API_URL` is a production HTTPS API URL.
- `EXPO_PUBLIC_WEB_URL` is the production HTTPS web URL.
- `EXPO_ASC_APP_ID` is set.
- Expo auth is available through `eas-cli login` or `EXPO_TOKEN`.
- App Store Connect credentials exist:
  - API key path + ID + issuer ID, or
  - Apple ID + app-specific password
- App config has the correct:
  - iOS bundle identifier
  - iOS build number
  - Android package
  - Android version code
- TestFlight build succeeds.
- TestFlight tester setup is ready if you need internal or external beta distribution.
- App Store Connect app information is complete:
  - support URL
  - privacy policy URL
  - category/subcategory
  - age rating
  - export-compliance answers
  - app privacy details
- Store metadata in [app-store-metadata.md](./app-store-metadata.md) is filled in.
- If the app uses Expo SecureStore, `ios.config.usesNonExemptEncryption` is set correctly in app config.

## Legal / Business Review

These items are not code problems, but they are launch blockers if unresolved:

- Privacy policy matches actual data collection and retention.
- Terms match the real billing model, refund policy, and company details.
- Governing-law and arbitration language has been reviewed by counsel.
- Support, legal, privacy, and security inbox ownership is clear.
- App Store privacy answers match the app’s real behavior.
- Export compliance answers are complete.
- Marketing copy only promises features that are actually enabled for launch.

## Manual QA Sign-off

- Web smoke test on the production build.
- Public support, privacy, terms, security, sitemap, and security.txt routes all work without login.
- Mobile smoke test on a simulator and a real device.
- Login, logout, dashboard, transactions, budgets, and support/legal links all work.
- If billing is enabled, upgrade/downgrade/cancel flows are tested.
- If bank sync is enabled, connect, refresh, and unlink flows are tested.

## Launch Day

- Confirm deploy target versions and git commit SHA.
- Confirm monitoring, alerting, and support coverage.
- Publish release notes.
- Keep rollback steps ready for:
  - frontend
  - backend
  - mobile build

## Hard Truth

The repo can verify a lot, but it cannot make legal claims true, buy Apple access, or create provider accounts. If `pnpm launch:check` still fails on credentials, company details, or provider setup, the launch is not complete yet.
