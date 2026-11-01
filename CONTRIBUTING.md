# Contributing

Read `docs/SPEC.md`, `docs/implementation-notes.md`, and `CONSTRAINTS.md` before
changing code. The engineering playbook is the review contract.

## Workflow

1. Write or update the failing test first.
2. Implement the smallest change that passes.
3. Commit normally; the Husky pre-commit hook runs lint-staged, a staged-file
   typecheck, `check:no-todo`, and `check:no-only`.
4. Before handoff, run the focused test, then `pnpm run check`.
5. Update `docs/WORKLOG.md` with what changed and what is next.
6. Record any deviation in `docs/implementation-notes.md`.

CI repeats the full gates, adds e2e, migration up/down, schema drift, dependency
audit, and a Gitleaks scan. A pull request is mergeable only when `quality`,
`test`, `e2e`, `migrations`, and `security` pass.

## Rules that reject a change

- A route without `@Public()` or `@SignedIn()`.
- An entity returned from a controller.
- A hard delete outside the allow-list.
- `synchronize: true`, `eager: true`, or `@InjectRepository` outside a
  repository.
- `any`, `@ts-ignore`, or a TODO comment.
- A focused test (`.only`) or a skipped, weakened, or deleted test.
- A secret, raw endpoint key, token, or password in a log or response.
- A schema change without a migration and schema-drift verification.

## Commands

```bash
pnpm test
pnpm run test:e2e
pnpm run typecheck
pnpm run lint
pnpm run check:access
pnpm run check:no-todo
pnpm run check:no-only
pnpm run format:check
pnpm run typecheck:staged
pnpm run build
pnpm audit --audit-level high
```
