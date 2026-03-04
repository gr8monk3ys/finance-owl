# @finance-owl/frontend

SvelteKit 2 web application for Finance Owl.

## Running

```bash
# From repository root
pnpm --filter @finance-owl/frontend dev      # Start dev server on port 3000
pnpm --filter @finance-owl/frontend build    # Production build
pnpm --filter @finance-owl/frontend preview  # Preview production build
```

## Tech Stack

- **SvelteKit 2** with Svelte 5
- **TailwindCSS 4** with forms and typography plugins
- **Chart.js** for financial data visualization
- **Sentry** for error monitoring (`@sentry/sveltekit`)
- **Playwright** for end-to-end tests
- **Vitest** for unit tests

Adapters: `@sveltejs/adapter-node` for self-hosted Docker deployments, `@sveltejs/adapter-vercel` for Vercel.

## Route Structure

All authenticated routes live under `src/routes/(app)/`:

| Route | Description |
|-------|-------------|
| `dashboard/` | Overview with account balances, recent transactions, budget status |
| `accounts/` | Financial accounts list and detail views |
| `transactions/` | Transaction list, search, and categorization |
| `budgets/` | Budget management and spending progress |
| `bills/` | Bill tracking and upcoming due dates |
| `subscriptions/` | Recurring subscription management |
| `investments/` | Investment portfolio and performance |
| `crypto/` | Cryptocurrency holdings |
| `real-estate/` | Property tracking |
| `credit/` | Credit score and monitoring |
| `debt-payoff/` | Debt payoff planner |
| `savings/` | Savings goals and smart savings |
| `retirement/` | Retirement planning |
| `tax/` | Tax preparation and categorization |
| `forecast/` | Income/expense forecasting |
| `calculators/` | Financial calculators |
| `reports/` | Financial reports |
| `import/` | Transaction import (CSV/OFX) |
| `banking/` | Bank connection management (Plaid) |
| `settings/` | User preferences and security settings |
| `household/` | Household member management |
| `ask/` | AI assistant (natural language queries) |
| `learn/` | Financial education content |
| `pricing/` | Subscription plans |
| `admin/` | Admin panel |

Public routes:

| Route | Description |
|-------|-------------|
| `auth/` | Login, registration, password reset |
| `onboarding/` | New user setup |
| `privacy/` | Privacy policy |
| `terms/` | Terms of service |
| `security/` | Security information |

## Shared Schemas

The frontend imports Zod validation schemas from `@finance-owl/shared` for form validation, ensuring consistency with backend validation rules.

## Testing

```bash
pnpm --filter @finance-owl/frontend test         # Unit tests (Vitest)
pnpm --filter @finance-owl/frontend test:e2e     # E2E tests (Playwright)
pnpm --filter @finance-owl/frontend test:e2e:ui  # E2E tests with Playwright UI
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_URL` | Backend API URL (default: `http://backend:4000` in Docker) |
| `PORT` | Server port (default: 3000) |
