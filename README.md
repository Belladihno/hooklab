# HookLab API

Webhook debugging workbench: capture, inspect, forward to localhost, replay.
The contract is [`docs/SPEC.md`](docs/SPEC.md); the plan is
[`docs/PLAN.md`](docs/PLAN.md).

## Requirements

- Node.js 20+ (22 LTS recommended)
- pnpm 11+
- PostgreSQL

## Setup

```bash
pnpm install
cp .env.example .env
cp .env.test.example .env.test
```

Fill both files with PostgreSQL connection strings. `hooklab` and
`hooklab_test` should be separate databases. If `.env.test` is absent, tests
fall back to `DATABASE_URL` and use an isolated schema that is dropped after
each run. CI must set `TEST_DATABASE_URL` explicitly: a CI run must never fall
back to a shared database, where the isolated schema can hide broken isolation.

```sql
CREATE ROLE hooklab LOGIN PASSWORD 'change-me';
CREATE DATABASE hooklab OWNER hooklab;
CREATE DATABASE hooklab_test OWNER hooklab;
```

Create the schema:

```bash
pnpm run migration:run
```

## Commands

```bash
pnpm run start:dev        # development server
pnpm run build            # compile
pnpm run start:prod       # run compiled output
pnpm run lint             # oxlint
pnpm run typecheck        # tsc --noEmit
pnpm run check:access     # every route declares Public/SignedIn
pnpm run check:no-todo    # no TODO/FIXME tags in src or test
pnpm run check:no-only    # no focused tests in src or test
pnpm run format:check     # Prettier check
pnpm run typecheck:staged # typecheck only staged TypeScript files
pnpm run check            # typecheck, lint, checks, format, tests, e2e, build
pnpm audit                # dependency vulnerability check
pnpm test                 # unit + integration (needs .env.test)
pnpm run test:e2e         # e2e (needs .env.test)
pnpm run migration:run
pnpm run migration:generate -- src/database/migrations/<Name>
pnpm run migration:revert
```

## Hooks and CI

`pnpm install` installs Husky. The pre-commit hook runs `lint-staged`
(`oxlint --fix` and `prettier --write` on staged TypeScript), a staged-file
typecheck, and the no-TODO/no-focused-test checks. It does not run the full
suite; run `pnpm run check` before handing work off.

`.github/workflows/ci.yml` runs five jobs on every pull request and on `main`:

| Job          | Verifies                                                                            |
| ------------ | ----------------------------------------------------------------------------------- |
| `quality`    | Prettier, oxlint, full `tsc`, access declarations, no TODO, no `.only`, build       |
| `test`       | Unit and integration tests with coverage against an ephemeral PostgreSQL 17 service |
| `e2e`        | Full HTTP suite against an ephemeral PostgreSQL 17 service                          |
| `migrations` | `migration:run`, `migration:revert`, re-apply, migration up/down, and schema drift  |
| `security`   | `pnpm audit --audit-level high` and a Gitleaks history scan                         |

CI sets `TEST_DATABASE_URL` explicitly and never falls back to a shared
database. Coverage is uploaded as an artifact; there is no changed-line coverage
threshold yet. Container image scanning is not wired because the repository does
not build an image yet. Enable branch protection and require the five checks
before merge; that setting lives in GitHub, not in this repository.

## Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login` — sets a 15-minute `access_token` and a rotating
  `refresh_token` cookie.
- `POST /api/v1/auth/refresh` — rotates both cookies.
- `POST /api/v1/auth/logout` — revokes the session and clears both cookies;
  works with only a valid refresh cookie, even after the access token expires.

Login is limited per HMAC(email) and per IP over a 15-minute window. The
defaults are 5 email failures and 30 IP attempts; exceeding either returns
`429 RATE_LIMITED`. Attempts are recorded in `auth_attempts` without raw emails.
Unsafe `/api/v1` requests with an `Origin`/`Referer` must be same-origin or in
`CSRF_ALLOWED_ORIGINS`.

API responses use `{ success, message, data, error, meta.requestId }`; see
[`docs/SPEC.md`](docs/SPEC.md#http-contract). Health responses keep their native
Terminus shape.

## Projects

All project routes require the access cookie. Reads are scoped to the signed-in
user; cross-user access returns `404`.

- `GET /api/v1/projects?limit=&offset=` — paged list without endpoint keys;
  default 100, max 100.
- `POST /api/v1/projects` — create a project; returns the raw endpoint key once.
- `GET /api/v1/projects/:id` — one project without its endpoint key.
- `DELETE /api/v1/projects/:id` — permanent delete; cascades to children.
- `POST /api/v1/projects/:id/rotate-key` — rotate and return the new raw key once.

## Health

- `GET /health/live` — process is running.
- `GET /health/ready` — database reachable; `503` when it is not.

## Structure

```
src/auth/              registration, login, CLI tokens (Milestone 2)
src/projects/          projects and endpoint keys (Milestone 2)
src/webhook-ingestion/ public /in/:endpointKey route (Milestone 3)
src/requests/          request history and detail (Milestone 3)
src/deliveries/        delivery attempts and replay (Milestones 4-5)
src/cli-connection/    WebSocket protocol and gateway (Milestone 4)
src/retention/         cleanup and stale-attempt recovery (Milestone 5)
src/database/          TypeORM, BaseEntity/BaseRepository, UUIDv7, migrations
src/common/            access/CSRF guards, API envelope, error catalogue
src/config/            environment schema and validation
src/health/            liveness and readiness
test/                  Vitest suites and PostgreSQL test harness
docs/                  spec, plan, todo, worklog, implementation notes
```

## Environment

| Variable                         | Required | Default                                          |
| -------------------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`                   | yes      | —                                                |
| `DATABASE_SCHEMA`                | no       | `public`                                         |
| `NODE_ENV`                       | no       | `development`                                    |
| `PORT`                           | no       | `3000`                                           |
| `LOG_LEVEL`                      | no       | `info`                                           |
| `BCRYPT_COST_ROUNDS`             | no       | `12` (minimum `12` in production; tests use `4`) |
| `JWT_SECRET`                     | yes      | — (at least 32 characters)                       |
| `JWT_ACCESS_TTL_SECONDS`         | no       | `900`                                            |
| `REFRESH_IDLE_TTL_SECONDS`       | no       | `604800`                                         |
| `REFRESH_ABSOLUTE_TTL_SECONDS`   | no       | `2592000`                                        |
| `CSRF_ALLOWED_ORIGINS`           | no       | empty; comma-separated exact origins             |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | no       | `900`                                            |
| `AUTH_IP_ATTEMPT_LIMIT`          | no       | `30`                                             |
| `AUTH_EMAIL_FAILURE_LIMIT`       | no       | `5`                                              |
| `TEST_DATABASE_URL`              | tests    | —                                                |
