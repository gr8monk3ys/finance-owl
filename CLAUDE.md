# finance-owl

Privacy-first, self-hosted personal finance manager. A Bun workspace.

| Package             | Stack                            | Notes                                                          |
| ------------------- | -------------------------------- | -------------------------------------------------------------- |
| `packages/backend`  | NestJS, Drizzle, Postgres, Redis | Global `api` route prefix — health is `/api/health`            |
| `packages/frontend` | SvelteKit                        | Playwright E2E lives in `packages/frontend/e2e`                |
| `packages/shared`   | zod schemas                      | Intended as the frontend/backend contract                      |
| `packages/mobile`   | Expo SDK 52 / React Native       | Pinned to the SDK; see the ignores in `.github/dependabot.yml` |

`ARCHITECTURE.md` has the full module map. `CONTRIBUTING.md` has the workflow.

## Commands

Bun is the package manager, the container runtime and the CI toolchain — there
is no pnpm or npm here. Turbo drives the cross-package tasks.

```sh
bun install --frozen-lockfile
bun run dev                                             # full local stack
bun run build --filter='!@finance-owl/mobile'
bun run lint                                            # also: typecheck, format:check
bun run --filter @finance-owl/backend test --coverage
bun run --filter @finance-owl/backend test:integration  # needs postgres + redis
bun run --filter @finance-owl/frontend test:e2e         # needs a seeded db + the API up
bun audit --audit-level=high
```

Build `@finance-owl/shared` before typechecking or testing anything that imports
it — the other packages resolve it through its `dist/` output, so a stale or
missing build shows up as unrelated type errors.

`bunfig.toml` sets `minimumReleaseAge` to 7 days, so a version published this
week will not resolve. Install scripts run only for packages listed in
`trustedDependencies`.

## Agent skills

### Issue tracker

GitHub Issues on `gr8monk3ys/finance-owl`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, mapped to the labels this repo actually has. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. Neither exists yet —
they are created lazily, when a term or decision is first resolved. See `docs/agents/domain.md`.
