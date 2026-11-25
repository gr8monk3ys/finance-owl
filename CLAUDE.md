# finance-owl

Privacy-first, self-hosted personal finance manager. A Bun workspace.

| Package             | Stack                            | Notes                                                          |
| ------------------- | -------------------------------- | -------------------------------------------------------------- |
| `packages/backend`  | NestJS, Drizzle, Postgres, Redis | Global `api` route prefix — health is `/api/health`            |
| `packages/frontend` | SvelteKit                        | Playwright E2E lives in `packages/frontend/e2e`                |
| `packages/shared`   | zod schemas                      | Intended as the frontend/backend contract                      |
| `packages/mobile`   | Expo SDK 52 / React Native       | Pinned to the SDK; see the ignores in `.github/dependabot.yml` |

`ARCHITECTURE.md` has the full module map. `CONTRIBUTING.md` has the workflow.

## How we work

`.claude/settings.json` loads four plugins from the `lorenzos-claude-code`
marketplace (gr8monk3ys/skills), in every clone and every cloud session. Use
them every time, not only when one happens to trigger:

- **Matt Pocock's skills** (`mattpocock-skills`) for the engineering process:
  `grilling` before building something new, `tdd` for any behaviour change,
  `diagnosing-bugs` for bugs, `code-review` before calling work done and `pr`
  for the PR body. Prefer them over overlapping skills from other plugins.
- **Impeccable** for any UI, layout, styling or on-screen copy: run
  `/impeccable critique` or `/impeccable audit` on it before you're done.
- **Ponytail** is always on: the simplest code that works, no unrequested
  abstractions or dependencies. Run `ponytail-review` on the diff before
  opening a PR and cut what the task didn't need.
- **Tests:** `./scripts/verify` is the fast gate (CI's format, lint,
  typecheck and unit-test jobs, with no Postgres, Redis or browser). A hook
  runs it before a session can finish and won't let it end while it fails.
  Before a PR, also run the backend `test:integration` and the frontend
  `test:e2e` from "Commands" when your change touches them. Never skip, weaken
  or delete a test to get it green.

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

The five canonical roles, label string equal to role name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
