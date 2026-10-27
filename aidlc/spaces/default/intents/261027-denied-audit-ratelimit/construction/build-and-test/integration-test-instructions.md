# Integration Test Instructions: B3 denied-call audit rate limit

## Scope

The test strategy is Minimal, so no separate integration suite is generated. The behaviour tests written in Code Generation are already integration-level: `tests/database/audit-denied-limit.test.ts` runs against the real local Postgres stack (no mocks), through the same functions the application calls.

## Framework and setup

Node's test runner (`node --experimental-strip-types --test`) with `pg`, the local Supabase stack running and migrated (see `build-instructions.md`).

## How to run

```bash
node --experimental-strip-types --test tests/database/audit-denied-limit.test.ts
```

```bash
node --experimental-strip-types --test tests/database/migrations.test.ts tests/database/audit.test.ts
```

The full regression across every database group, including the randomized order run, is part of `npm run verify:local`.

## Coverage target

Every requirement FR1 to FR5 and NFR1 to NFR4 has at least one test (see `../code-generation/traceability.json`). SQL is outside the TypeScript coverage measurement; the repository-wide 80 percent line, branch and function floor still applies to production TypeScript and is checked by `verify:local`.

## Test data

`seedGrants` accounts; `resetWorkerData` before each test; aged events inserted directly by the schema owner.
