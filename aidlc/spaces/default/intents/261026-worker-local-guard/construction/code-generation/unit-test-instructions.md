# Unit Test Instructions: Worker local-only guard

## Test framework and setup

Node's built-in test runner (`node --experimental-strip-types --test`). The unit tests use fake database clients (no database). The real-stack test file needs Docker and the local stack from `npm run db:start` plus `set -a; . ./.env.database.local; . ./.env.service.local; set +a`.

## Commands for this change (scoped to the files it touches)

```bash
node --experimental-strip-types --test scripts/db/local-guard.test.ts
node --experimental-strip-types --test scripts/db/tooling.test.ts
node --experimental-strip-types --test tests/database/worker.test.ts
```

Type, lint and format checks: `npm run typecheck`, `npm run lint`, `npm run format:check`.

## What the tests prove (Minimal strategy: one test per requirement)

- FR1.1: a non-default password is refused before any connection is made.
- FR1.2, FR1.4: a database that does not identify itself as the local stack is refused with the client closed, no `drop`/`create`/`truncate`/`delete` statement run, step `guard`, worker and schema in the detail, no password in the message.
- FR1.3, FR2: a stack without the tracking table (never migrated) still gets its worker schema; the other identity reasons still refuse.
- FR3: the seed and reset path (default option) still refuses a database without the tracking table.
- Real stack: an unreachable database with the default password still fails at step `connect`; a wrong password fails at step `guard`; the worker schemas of the other real-stack tests are still prepared.

## Coverage

At least 80% lines, branches and functions across production source (`npm run test:coverage`).

## Mocking and test data

The fake database answers the identity query (database name, role, tracking table, JWT hash) with configurable values, as `local-guard.test.ts` does.
