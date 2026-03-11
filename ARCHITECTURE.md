# Architecture Overview

This document describes the high-level architecture of Finance Owl.

## System Diagram

```
                         +------------------+
                         |     Caddy        |
                         |  (reverse proxy) |
                         +--------+---------+
                                  |
                    +-------------+-------------+
                    |                           |
             +------+------+           +-------+-------+
             |   Frontend  |           |    Backend     |
             |  SvelteKit  |           |    NestJS      |
             |  :3000      |           |    :4000       |
             +------+------+           +---+---+---+---+
                    |                      |   |   |
                    |              +-------+   |   +-------+
                    |              |            |           |
               +----+----+   +----+----+  +----+----+ +----+----+
               | Shared  |   |Postgres |  |  Redis  | | Ollama  |
               |  Zod    |   |   16    |  |    7    | | ChromaDB|
               | schemas |   +---------+  +---------+ +---------+
               +---------+

             +-------------+           +----------------+
             |   Mobile    |           |   Watch App    |
             | Expo / RN   |---------->|  (Apple Watch) |
             +-------------+           +----------------+
```

All clients communicate with the backend over REST (JSON). The mobile app connects to the same backend API as the web frontend.

## Backend Architecture

### NestJS Module Organization

The backend is organized into 60+ NestJS modules under `packages/backend/src/modules/`. Each module encapsulates a domain concern with its own controller, service, and tests.

**Core domains:**

| Category | Modules |
|----------|---------|
| Banking | `accounts`, `transactions`, `bank-sync`, `plaid`, `import`, `categories` |
| Budgeting | `budgets`, `bills`, `subscriptions`, `smart-savings`, `savings-goals` |
| Investing | `investments`, `crypto`, `real-estate`, `assets`, `benchmarking` |
| Credit | `credit`, `credit-simulator`, `debt-payoff` |
| Planning | `retirement`, `tax`, `calculators`, `forecasting` |
| AI | `ai`, `recommendations`, `anomalies`, `financial-health` |
| Auth | `auth`, `identity`, `users`, `privacy` |
| Billing | `billing` (Stripe integration) |
| Social | `households`, `advisor-sharing`, `social`, `referrals`, `challenges` |
| Platform | `notifications`, `email`, `reports`, `data-export`, `audit`, `observability`, `health` |

### Common Infrastructure

`packages/backend/src/common/` provides cross-cutting concerns:

- **Guards** -- JWT auth, role-based access, rate limiting (`@nestjs/throttler`)
- **Interceptors** -- response transformation, caching
- **Filters** -- global exception handling, Sentry error reporting
- **Pipes** -- Zod-based validation
- **Middleware** -- Helmet security headers, request logging
- **Crypto** -- field-level encryption utilities
- **Cache** -- Redis-backed caching layer

### Request Pipeline

```
Request --> Helmet Middleware --> Rate Limiter --> Auth Guard --> Validation Pipe
        --> Controller --> Service --> Drizzle ORM --> PostgreSQL
        --> Response Interceptor --> Client
```

Background work (bank syncs, notifications, report generation) is processed through **BullMQ** job queues backed by Redis.

### Database

PostgreSQL 16 with Drizzle ORM. Schema files live in `packages/backend/src/database/schema/`:

- `users.ts` -- user accounts, credentials, preferences
- `accounts.ts` -- financial accounts (checking, savings, credit, investment)
- `transactions.ts` -- transaction records with category assignments
- `budgets.ts` -- budget definitions and tracking periods
- `categories.ts` -- transaction categories (system defaults and user-defined)
- `investments.ts` -- portfolio holdings and performance data
- `households.ts` -- multi-user household groupings
- `audit.ts` -- audit trail for sensitive operations

Migrations are managed with `drizzle-kit`. Run `db:generate` after schema changes and `db:migrate` to apply.

### Authentication Flow

1. **Registration** -- email/password with Argon2 hashing; optional TOTP or WebAuthn enrollment
2. **Login** -- credentials verified, JWT access token (short-lived) + refresh token issued
3. **Token refresh** -- refresh tokens are rotated on each use
4. **2FA** -- TOTP (`otplib`) or WebAuthn/passkeys (`@simplewebauthn/server`) as second factor
5. **Session management** -- refresh tokens tracked in Redis for revocation

JWTs are signed with `jose`. Access tokens contain user ID, tenant, and role claims.

## Frontend Architecture

### SvelteKit Routing

The frontend uses SvelteKit 2 with file-based routing. Routes are organized under `src/routes/`:

- `(app)/` -- authenticated application routes (dashboard, accounts, transactions, etc.)
- `auth/` -- login, register, password reset
- `onboarding/` -- new user setup wizard
- `api/` -- SvelteKit API routes that proxy to the backend

There are 40+ route groups under `(app)/` matching the backend's domain modules.

### State Management

- **SvelteKit load functions** handle server-side data fetching
- **Svelte 5 runes** (`$state`, `$derived`) for reactive component state
- **Chart.js** for financial data visualization

### Styling

TailwindCSS 4 with the `@tailwindcss/forms` and `@tailwindcss/typography` plugins. The Vite plugin (`@tailwindcss/vite`) handles build-time processing.

## Mobile Architecture

The mobile app uses Expo 52 with React Native 0.76 and Expo Router for file-based navigation. Key libraries:

- **Zustand** for state management
- **expo-secure-store** for secure credential storage
- **react-native-reanimated** for animations

The watch companion app (`packages/watch/`) provides at-a-glance financial summaries on Apple Watch.

## Shared Package

`packages/shared/` exports Zod schemas and constants consumed by both the frontend and backend:

- `schemas/auth.ts` -- login, register, token validation
- `schemas/accounts.ts` -- account CRUD
- `schemas/transactions.ts` -- transaction input/filtering
- `schemas/budgets.ts` -- budget definitions
- `schemas/categories.ts` -- category schemas
- `schemas/pagination.ts` -- shared pagination parameters

This ensures consistent validation across the full stack.

## AI Subsystem (Optional)

When enabled, Ollama runs a local LLM for:

- Spending pattern analysis and anomaly detection
- Personalized financial recommendations
- Natural language queries ("How much did I spend on groceries last month?")

ChromaDB stores vector embeddings of transaction descriptions for semantic search. Both services are fully local -- no data leaves the host.

## Infrastructure

### Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `caddy` | caddy:2-alpine | 80/443 | Reverse proxy, automatic TLS |
| `frontend` | Custom | 3000 | SvelteKit app |
| `backend` | Custom | 4000 | NestJS API |
| `postgres` | postgres:16-alpine | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | Cache, sessions, job queues |
| `ollama` | ollama/ollama | 11434 | Local LLM inference |
| `chromadb` | chromadb/chroma | 8000 | Vector database |

### CI/CD

GitHub Actions workflows handle:

- Linting, type-checking, and testing on every PR (`ci.yml`)
- Security scanning: CodeQL, Semgrep, Trivy, Gitleaks, TruffleHog, OSV
- Preview deployments (`deploy-preview.yml`)
- Production deployments (`deploy-production.yml`)
- Automated releases via Release Please (`org-release-please.yml`)

## Key Design Decisions

1. **Self-hosted first** -- all services can run on a single machine via Docker Compose. No mandatory cloud dependencies.
2. **Local AI** -- Ollama keeps financial data analysis entirely on-premise. The AI subsystem is optional and the app functions fully without it.
3. **Drizzle over Prisma** -- Drizzle was chosen for its SQL-like query builder, lighter runtime, and better TypeScript inference.
4. **Zod shared schemas** -- a single source of truth for validation that works identically on client and server.
5. **Modular monolith** -- 60+ NestJS modules provide clear domain boundaries while keeping deployment simple as a single service.
6. **Field-level encryption** -- sensitive financial data is encrypted at rest using the application-layer `ENCRYPTION_KEY`, independent of database-level encryption.
7. **Multi-tenant households** -- users can belong to shared households, enabling family finance management with granular permissions.
