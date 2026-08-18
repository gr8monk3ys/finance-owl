# Finance Owl Deployment Guide

This guide covers deploying Finance Owl to **Railway** (backend + database + Redis) and **Vercel** (frontend).

## Architecture Overview

```
                    Internet
                       |
            ┌──────────┴──────────┐
            │                     │
      ┌─────▼─────┐       ┌──────▼──────┐
      │   Vercel   │       │   Railway   │
      │  Frontend  │──────▶│   Backend   │
      │ (SvelteKit)│  API  │  (NestJS)   │
      └────────────┘       └──────┬──────┘
                                  │
                          ┌───────┴───────┐
                          │               │
                    ┌─────▼─────┐  ┌──────▼──────┐
                    │ PostgreSQL│  │    Redis     │
                    │ (Railway) │  │  (Railway)   │
                    └───────────┘  └─────────────┘
```

---

## 1. Railway Backend Setup

### Prerequisites

- A [Railway](https://railway.app) account
- Railway CLI installed: `npm install -g @railway/cli`
- Your Finance Owl repository pushed to GitHub

### Step 1: Create a Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub Repo"**
3. Select the `finance-owl` repository
4. Railway will detect the `railway.json` or `railway.toml` config in the project root

### Step 2: Add PostgreSQL

1. In your Railway project, click **"+ New"** > **"Database"** > **"PostgreSQL"**
2. Railway automatically provisions a PostgreSQL instance
3. The `DATABASE_URL` environment variable is automatically injected into your backend service
4. No manual configuration needed

### Step 3: Add Redis

1. In your Railway project, click **"+ New"** > **"Database"** > **"Redis"**
2. Railway automatically provisions a Redis instance
3. The `REDIS_URL` environment variable is automatically injected into your backend service

### Step 4: Configure Environment Variables

In the Railway dashboard, go to your backend service > **Variables** tab and add:

```bash
# Required secrets
JWT_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
ENCRYPTION_KEY=<openssl rand -hex 32>

# App config
NODE_ENV=production
FRONTEND_URL=https://yourapp.vercel.app
CORS_ORIGIN=https://yourapp.vercel.app
LOG_LEVEL=warn

# Plaid (if using bank sync)
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=production
PLAID_WEBHOOK_URL=https://your-railway-domain.up.railway.app/api/webhooks/plaid

# Stripe (if using billing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sentry (optional)
SENTRY_DSN=https://...@sentry.io/...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password
SMTP_FROM=Finance Owl <noreply@yourapp.com>

# WebAuthn
WEBAUTHN_RP_NAME=Finance Owl
WEBAUTHN_RP_ID=yourapp.com
WEBAUTHN_ORIGIN=https://yourapp.com
```

**Note:** `DATABASE_URL`, `REDIS_URL`, and `PORT` are set automatically by Railway. Do not override `PORT`.

### Step 5: Configure the Build

Railway reads `railway.json` from the project root. The config points to `docker/Dockerfile.backend` which uses a multi-stage build:

1. Installs dependencies with pnpm
2. Builds the `@finance-owl/shared` package
3. Builds the `@finance-owl/backend` package
4. Creates a slim production image with only `dist/` and `node_modules/`
5. Runs as a non-root user (`app`)

### Step 6: Set Up Custom Domain (Optional)

1. In Railway dashboard, go to your backend service > **Settings** > **Networking**
2. Click **"Generate Domain"** for a free `*.up.railway.app` subdomain
3. Or click **"Custom Domain"** and add `api.yourapp.com`
4. Add a CNAME record in your DNS provider pointing to the Railway domain
5. Railway automatically provisions SSL/TLS certificates

### Step 7: Database Migrations

Migrations run automatically on startup via the DatabaseModule. For manual migrations:

```bash
# Using Railway CLI
railway run --service backend -- pnpm db:migrate
```

Or configure them in the GitHub Actions workflow (already set up in `.github/workflows/deploy-production.yml`).

---

## 2. Vercel Frontend Setup

### Prerequisites

- A [Vercel](https://vercel.com) account
- Vercel CLI installed: `npm install -g vercel`

### Step 1: Import Project to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** and select `finance-owl`
3. Set the **Root Directory** to `packages/frontend`
4. Vercel detects SvelteKit automatically via `vercel.json`

### Step 2: Configure Build Settings

The `packages/frontend/vercel.json` handles build configuration:

- **Framework:** SvelteKit
- **Build Command:** Builds shared package first, then the frontend
- **Install Command:** Runs pnpm install from the monorepo root

If Vercel does not pick up the config automatically, set these manually in the Vercel dashboard:

| Setting          | Value                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Framework        | SvelteKit                                                                                          |
| Root Directory   | `packages/frontend`                                                                                |
| Build Command    | `cd ../.. && pnpm --filter @finance-owl/shared build && pnpm --filter @finance-owl/frontend build` |
| Install Command  | `cd ../.. && pnpm install --frozen-lockfile`                                                       |
| Output Directory | `.svelte-kit/output`                                                                               |

### Step 3: Configure Environment Variables

In the Vercel dashboard, go to **Settings** > **Environment Variables** and add:

```bash
# Backend API URL (your Railway backend URL)
API_URL=https://api.yourapp.com
PUBLIC_SITE_URL=https://yourapp.com
PUBLIC_SUPPORT_EMAIL=support@yourapp.com
PUBLIC_PRIVACY_EMAIL=privacy@yourapp.com
PUBLIC_LEGAL_EMAIL=legal@yourapp.com
PUBLIC_SECURITY_EMAIL=security@yourapp.com

# Sentry (optional)
PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=your_auth_token
SENTRY_ORG=your_org
SENTRY_PROJECT=finance-owl-frontend
```

### Step 4: SvelteKit Adapter

The frontend uses `@sveltejs/adapter-auto` by default, which auto-detects Vercel at build time. For Docker/self-hosted builds, set `ADAPTER=node` to use `@sveltejs/adapter-node` instead.

### Step 5: Set Up Custom Domain (Optional)

1. In Vercel dashboard, go to your project > **Settings** > **Domains**
2. Add `yourapp.com` (or `app.yourapp.com`)
3. Follow Vercel's DNS instructions:
   - For apex domain: Add an A record pointing to `76.76.21.21`
   - For subdomain: Add a CNAME record pointing to `cname.vercel-dns.com`
4. Vercel automatically provisions SSL/TLS certificates

---

## 3. Connecting Frontend to Backend

### CORS Configuration

The backend reads CORS origins from environment variables:

1. `CORS_ORIGIN` (comma-separated for multiple origins, takes precedence)
2. `FRONTEND_URL` (single origin fallback)

Set in Railway:

```bash
CORS_ORIGIN=https://yourapp.com
# or for multiple origins:
CORS_ORIGIN=https://yourapp.com,https://www.yourapp.com
```

### API Proxy (Recommended)

Configure SvelteKit to proxy API calls to avoid CORS issues in the browser. In the frontend, API calls should go through SvelteKit server routes that proxy to the backend.

---

## 4. SSL/TLS

Both Railway and Vercel provide automatic SSL/TLS:

- **Railway:** Auto-provisions Let's Encrypt certificates for both `*.up.railway.app` and custom domains
- **Vercel:** Auto-provisions certificates for all domains, including wildcard certificates for preview deployments

No manual certificate management is required.

---

## 5. GitHub Actions CI/CD

The repository includes GitHub Actions workflows for automated deployment:

### Required GitHub Secrets

| Secret              | Description                               | Where to find                              |
| ------------------- | ----------------------------------------- | ------------------------------------------ |
| `RAILWAY_TOKEN`     | Railway API token for CLI deployments     | Railway dashboard > Account > Tokens       |
| `VERCEL_TOKEN`      | Vercel API token                          | Vercel dashboard > Settings > Tokens       |
| `VERCEL_ORG_ID`     | Vercel organization/team ID               | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Vercel project ID                         | `.vercel/project.json` after `vercel link` |
| `DATABASE_URL`      | Production PostgreSQL connection string   | Railway dashboard > PostgreSQL > Variables |
| `BACKEND_URL`       | Production backend URL (for smoke tests)  | Your Railway custom domain                 |
| `FRONTEND_URL`      | Production frontend URL (for smoke tests) | Your Vercel custom domain                  |

### Workflows

| Workflow                | Trigger        | What it does                                             |
| ----------------------- | -------------- | -------------------------------------------------------- |
| `ci.yml`                | Push / PR      | Lint, typecheck, test                                    |
| `deploy-preview.yml`    | Pull request   | Deploy frontend preview to Vercel                        |
| `deploy-production.yml` | Push to `main` | Build images, run migrations, deploy to Railway + Vercel |
| `security.yml`          | Scheduled / PR | Security audits                                          |

### Alternative: Railway GitHub Integration

Instead of using the Railway CLI in GitHub Actions, you can use Railway's native GitHub integration:

1. In Railway dashboard, go to **Settings** > **Integrations** > **GitHub**
2. Connect your repository
3. Railway will auto-deploy when you push to `main`
4. This eliminates the need for `RAILWAY_TOKEN` and the `deploy-backend` GitHub Actions job

## Launch Checklist

Before a public launch, also run:

```bash
pnpm launch:check
pnpm launch:verify
```

Use `https://yourapp.com/support` as the public support URL for store listings and customer support links.

---

## 6. Environment Checklist

### Railway (Backend) Variables

| Variable                | Required | Auto-provided | Notes                        |
| ----------------------- | -------- | ------------- | ---------------------------- |
| `DATABASE_URL`          | Yes      | Yes (plugin)  | PostgreSQL connection string |
| `REDIS_URL`             | Yes      | Yes (plugin)  | Redis connection string      |
| `PORT`                  | Yes      | Yes (Railway) | Do not override              |
| `NODE_ENV`              | Yes      | No            | Set to `production`          |
| `JWT_SECRET`            | Yes      | No            | `openssl rand -base64 48`    |
| `JWT_REFRESH_SECRET`    | Yes      | No            | `openssl rand -base64 48`    |
| `ENCRYPTION_KEY`        | Yes      | No            | `openssl rand -hex 32`       |
| `FRONTEND_URL`          | Yes      | No            | Your Vercel domain           |
| `CORS_ORIGIN`           | Yes      | No            | Your Vercel domain           |
| `PLAID_CLIENT_ID`       | If using | No            | From Plaid dashboard         |
| `PLAID_SECRET`          | If using | No            | From Plaid dashboard         |
| `PLAID_ENV`             | If using | No            | `production` or `sandbox`    |
| `STRIPE_SECRET_KEY`     | If using | No            | From Stripe dashboard        |
| `STRIPE_WEBHOOK_SECRET` | If using | No            | From Stripe dashboard        |
| `SENTRY_DSN`            | Optional | No            | From Sentry project settings |
| `LOG_LEVEL`             | Optional | No            | `warn` recommended for prod  |

### Vercel (Frontend) Variables

| Variable                | Required | Notes                                     |
| ----------------------- | -------- | ----------------------------------------- |
| `API_URL`               | Yes      | Railway backend URL                       |
| `PUBLIC_SITE_URL`       | Yes      | Public web origin for support/legal pages |
| `PUBLIC_SUPPORT_EMAIL`  | Yes      | Public support inbox                      |
| `PUBLIC_PRIVACY_EMAIL`  | Yes      | Public privacy inbox                      |
| `PUBLIC_LEGAL_EMAIL`    | Yes      | Public legal inbox                        |
| `PUBLIC_SECURITY_EMAIL` | Yes      | Public security inbox                     |
| `PUBLIC_SENTRY_DSN`     | Optional | Sentry DSN for frontend                   |
| `SENTRY_AUTH_TOKEN`     | Optional | For source map uploads                    |

---

## 7. Monitoring and Observability

### Health Checks

- **Backend:** `GET /api/health` returns `{ status: "ok", database: "ok", redis: "ok", uptime: ..., version: "..." }`
- Railway uses this endpoint for automatic restarts on failure

### Sentry

Both backend and frontend support Sentry. Set `SENTRY_DSN` / `PUBLIC_SENTRY_DSN` to enable error tracking.

### Railway Logs

View logs in the Railway dashboard or via CLI:

```bash
railway logs --service backend
```

---

## 8. Troubleshooting

### Backend fails to start on Railway

1. Check logs: `railway logs --service backend`
2. Verify all required env vars are set (especially `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`)
3. Ensure PostgreSQL and Redis plugins are attached and their URLs are injected
4. Check the health endpoint manually: `curl https://your-backend.up.railway.app/api/health`

### CORS errors in the browser

1. Verify `CORS_ORIGIN` or `FRONTEND_URL` on Railway matches your Vercel domain exactly (including `https://`)
2. Ensure no trailing slash in the URL
3. Check that the frontend is making requests to the correct backend URL

### Database connection issues

1. Railway PostgreSQL uses SSL by default; the app handles this automatically
2. Check `DATABASE_URL` format: `postgresql://user:password@host:port/database?sslmode=require`
3. Try connecting manually: `railway run -- psql $DATABASE_URL`

### Frontend build fails on Vercel

1. Ensure the Root Directory is set to `packages/frontend`
2. Check that `pnpm-lock.yaml` is committed and up to date
3. Verify the build command builds the shared package first
