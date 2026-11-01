# Constraints

Last reviewed: 2026-10-30

## Floor (always enforced, no setup)

- No new suppression comments (`@ts-ignore`, `eslint-disable`, `noqa`).
- No `any`, no unimplemented stubs, no empty `catch`.
- No skipped or deleted tests without a reason in the commit message.
- No TODO comments in source; pending work goes in
  `docs/implementation-notes.md`.
- No secrets in source or logs.
- No hard delete outside `src/database/hard-delete-tables.ts`.
- This file is not weakened to make a change pass.

## Enforced with numbers

| Dimension        | Rule                           | Checked by                                                | Runs at  |
| ---------------- | ------------------------------ | --------------------------------------------------------- | -------- |
| Types            | Zero errors, full strict block | `pnpm run typecheck`                                      | edit     |
| Lint             | Zero errors                    | `pnpm run lint`                                           | edit     |
| Unit/integration | All pass                       | `pnpm test`                                               | task end |
| E2E              | All pass                       | `pnpm run test:e2e`                                       | task end |
| Migrations       | Up and down pass               | `pnpm test`                                               | CI       |
| Schema           | No drift                       | `pnpm test`                                               | CI       |
| Access           | Every route declares access    | `pnpm run check:access`                                   | task end |
| Comments         | No TODO tags                   | `pnpm run check:no-todo`                                  | task end |
| Build            | Zero errors                    | `pnpm run build`                                          | task end |
| Format           | No diffs                       | `pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"` | task end |
| Deps             | No high/critical               | `pnpm audit --audit-level high`                           | CI       |

## Measured, not yet enforced

| Metric             | Today                                           | Direction                                 |
| ------------------ | ----------------------------------------------- | ----------------------------------------- |
| Testcontainers     | Not used; real Postgres via `TEST_DATABASE_URL` | must not fall                             |
| DB role separation | Runtime uses the database owner role            | must improve before production            |
| OpenAPI generation | Not implemented                                 | must be added before external client work |

## Exceptions

| ID  | Rule          | Path               | Reason                                                    | Owner       | Expires          |
| --- | ------------- | ------------------ | --------------------------------------------------------- | ----------- | ---------------- |
| W1  | `TEST-01`     | `test/database.ts` | Real PostgreSQL via configured URL, not Testcontainers    | engineering | 2026-12-31       |
| W2  | `TEN-01`–`10` | `src/**`           | HookLab is user-scoped, not organisation-scoped           | engineering | product decision |
| W3  | `DATA-04`     | `src/projects/**`  | User-initiated purge of captured secrets; allow-list only | engineering | product decision |
