# Contributing to Finance Owl

Thank you for your interest in contributing. This guide covers the development workflow and conventions used in this project.

## Prerequisites

- **Node.js** >= 20
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** and Docker Compose (for PostgreSQL, Redis, and optional AI services)

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-user>/finance-owl.git
cd finance-owl

# 2. Install dependencies
pnpm install

# 3. Start infrastructure
docker compose up -d postgres redis

# 4. Configure environment
cp packages/backend/.env.example packages/backend/.env
# Fill in required values: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY

# 5. Set up the database
pnpm --filter @finance-owl/backend db:migrate
pnpm --filter @finance-owl/backend db:seed

# 6. Start development servers
pnpm dev
```

Frontend: `http://localhost:3000` | Backend API: `http://localhost:4000` | Swagger docs: `http://localhost:4000/api/docs`

## Branch Naming

Use descriptive branch names with a category prefix:

```
feat/add-recurring-transactions
fix/budget-calculation-rounding
docs/update-api-reference
refactor/auth-module-cleanup
test/investment-portfolio-coverage
chore/upgrade-nestjs-11
```

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and [Release Please](https://github.com/googleapis/release-please) for automated releases. Every commit to `main` must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Scopes** (optional): `backend`, `frontend`, `mobile`, `shared`, `ci`

Examples:

```
feat(backend): add recurring transaction support
fix(frontend): correct budget chart rendering on Safari
docs: update deployment guide
chore(ci): add integration test workflow
```

Breaking changes use `!` after the type/scope:

```
feat(backend)!: change authentication token format
```

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes with clear, focused commits.
3. Ensure all checks pass locally:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm format:check
   ```
4. Open a pull request against `main`.
5. Fill in the PR template -- describe what changed and why.
6. Address review feedback with additional commits (do not force-push during review).
7. A maintainer will merge once approved and CI is green.

## Code Style

- **ESLint** and **Prettier** are enforced across the monorepo.
- Run `pnpm format` to auto-format before committing.
- TypeScript strict mode is enabled in all packages.
- Use Zod schemas from `@finance-owl/shared` for request/response validation.

## Testing

| Level       | Command                 | Notes                                    |
| ----------- | ----------------------- | ---------------------------------------- |
| Unit        | `pnpm test`             | Vitest, runs in all packages             |
| Integration | `pnpm test:integration` | Requires running Postgres and Redis      |
| E2E         | `pnpm test:e2e`         | Backend: Supertest; Frontend: Playwright |

- Write unit tests for business logic and utility functions.
- Write integration tests for database queries and API endpoints.
- Place test files next to the source file (`*.spec.ts`) or in a `__tests__` directory.

## Project-Specific Guidelines

- **Backend modules** follow NestJS conventions: `module.ts`, `controller.ts`, `service.ts`, `*.spec.ts`.
- **Database changes** require a Drizzle migration: run `pnpm --filter @finance-owl/backend db:generate` after modifying schema files.
- **Shared schemas** in `packages/shared` are used by both frontend and backend. Changes there affect multiple packages.
- **Security-sensitive changes** (auth, encryption, permissions) require extra review. See [SECURITY.md](SECURITY.md).

## Reporting Issues

- Use GitHub Issues for bugs and feature requests.
- For security vulnerabilities, follow the process in [SECURITY.md](SECURITY.md) -- do not open public issues.
