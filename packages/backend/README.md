# @finance-owl/backend

NestJS 11 API server for Finance Owl.

## Running

```bash
# From repository root
pnpm --filter @finance-owl/backend dev     # Start with hot reload
pnpm --filter @finance-owl/backend build   # Production build
pnpm --filter @finance-owl/backend start   # Start production build
```

Requires PostgreSQL and Redis. Start them with `docker compose up -d postgres redis` from the repo root.

## Environment Variables

| Variable             | Required | Description                          |
| -------------------- | -------- | ------------------------------------ |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string         |
| `JWT_SECRET`         | Yes      | Secret for signing access tokens     |
| `JWT_REFRESH_SECRET` | Yes      | Secret for signing refresh tokens    |
| `ENCRYPTION_KEY`     | Yes      | Key for field-level encryption       |
| `REDIS_URL`          | Yes      | Redis connection string              |
| `PORT`               | No       | Server port (default: 4000)          |
| `PLAID_CLIENT_ID`    | No       | Plaid API client ID                  |
| `PLAID_SECRET`       | No       | Plaid API secret                     |
| `PLAID_ENV`          | No       | Plaid environment (default: sandbox) |
| `OLLAMA_URL`         | No       | Ollama server URL                    |
| `CHROMADB_URL`       | No       | ChromaDB server URL                  |

## Module Overview

The backend contains 60+ NestJS modules organized by domain:

### Banking and Accounts

- **accounts** -- financial account CRUD (checking, savings, credit, investment)
- **transactions** -- transaction records, filtering, and search
- **bank-sync** -- automated bank synchronization scheduling
- **plaid** -- Plaid Link integration for account connections
- **import** -- CSV/OFX transaction import
- **categories** -- transaction categorization (auto and manual)

### Budgeting and Bills

- **budgets** -- budget creation, tracking, and period management
- **bills** -- bill tracking and due date alerts
- **subscriptions** -- recurring subscription detection and management
- **smart-savings** -- automated savings rule suggestions
- **savings-goals** -- goal-based savings tracking

### Investing

- **investments** -- portfolio holdings and performance
- **crypto** -- cryptocurrency portfolio tracking
- **real-estate** -- property value tracking
- **assets** -- general asset management
- **benchmarking** -- portfolio comparison against indices
- **vehicles** -- vehicle value depreciation tracking

### Credit and Debt

- **credit** -- credit score monitoring
- **credit-simulator** -- "what if" credit score scenarios
- **debt-payoff** -- debt snowball/avalanche calculators

### Planning

- **retirement** -- retirement projections and planning
- **tax** -- tax categorization and preparation helpers
- **calculators** -- general financial calculators
- **forecasting** -- income/expense forecasting

### AI and Insights

- **ai** -- Ollama LLM integration for natural language queries
- **recommendations** -- personalized financial suggestions
- **anomalies** -- unusual spending detection
- **financial-health** -- overall financial health scoring
- **bill-negotiation** -- bill reduction suggestions

### Authentication and Users

- **auth** -- JWT authentication, TOTP, WebAuthn/passkeys
- **identity** -- identity verification
- **users** -- user profile management
- **privacy** -- data privacy controls and consent

### Billing

- **billing** -- Stripe subscription management

### Social and Collaboration

- **households** -- multi-user household management
- **advisor-sharing** -- share data with financial advisors
- **social** -- community features
- **referrals** -- referral program
- **challenges** -- savings challenges

### Platform

- **notifications** -- push/email/in-app notifications
- **email** -- transactional email via Nodemailer
- **reports** -- PDF/CSV report generation
- **data-export** -- GDPR-compliant data export
- **audit** -- audit trail logging
- **observability** -- Sentry integration, structured logging
- **health** -- health check endpoints (`/api/health`)
- **dashboard** -- aggregated dashboard data
- **analytics** -- usage analytics
- **flagging** -- transaction flagging
- **marketplace** -- financial product marketplace
- **education** -- financial literacy content
- **year-review** -- annual financial summary
- **unclaimed** -- unclaimed money search
- **currency** -- multi-currency support
- **tenants** -- multi-tenant isolation
- **jobs** -- BullMQ job queue management
- **receipts** -- receipt scanning and storage

## Database

PostgreSQL 16 with Drizzle ORM. Schema files are in `src/database/schema/`.

```bash
pnpm --filter @finance-owl/backend db:generate   # Generate migration after schema change
pnpm --filter @finance-owl/backend db:migrate    # Apply migrations
pnpm --filter @finance-owl/backend db:studio     # Open Drizzle Studio
pnpm --filter @finance-owl/backend db:seed       # Seed with sample data
pnpm --filter @finance-owl/backend db:reset      # Reset database
```

## Testing

```bash
pnpm --filter @finance-owl/backend test              # Unit tests (Vitest)
pnpm --filter @finance-owl/backend test:integration  # Integration tests
pnpm --filter @finance-owl/backend test:e2e          # End-to-end tests
```

## API Documentation

Swagger UI is available at `/api/docs` when the server is running (powered by `@nestjs/swagger`).
