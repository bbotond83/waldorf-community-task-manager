# Unit Test Instructions: Audit purge isolation

## Test framework and setup

The database tests use Node's built-in test runner (`node --experimental-strip-types --test`) against the local Supabase stack. They need Docker and the stack started with `npm run db:start` plus the stack settings in the environment (`.env.database.local`). CI starts its own throwaway stack and runs them in the `database-*` jobs. Each file runs once in a worker schema and once in the default schema.

## Commands for this change (scoped to the files it touches)

```bash
node --experimental-strip-types --test tests/database/audit-purge.test.ts
node --experimental-strip-types --test tests/database/identity-housekeeping.test.ts
node --experimental-strip-types --test tests/database/migrations.test.ts
node --experimental-strip-types --test tests/database/identity-catalogue.test.ts
```

Type, lint and format checks for the changed test files: `npm run typecheck`, `npm run lint`, `npm run format:check`.

## What the new tests prove (Minimal strategy: one test per requirement)

- FR1.1, FR1.2, FR1.3, NFR2: a purge that fails (a delete trigger that always raises) does not stop the other clean-up; the result reports `audit_events_purged` 0 and `audit_purge_failed` true with no error text; the next run purges once the cause is gone; a successful run reports `audit_purge_failed` false.
- Review R-02: after a failed purge the deletion setting is not `on`, and a delete of an aged row stays refused.
- FR2.1, FR2.2 and review R-03: 5001 aged rows give 5000 deleted, then 1; exactly 5000 aged rows leave none; the oldest are deleted first; recent rows stay.
- FR3.1, FR3.2: the existing purge tests (system caller only, updates refused, recent rows refused) stay green unchanged.
- FR4: the migration tracking test finds the new file after the purge file and a second run applies nothing.

## Coverage

Production TypeScript is not changed, so line, branch and function coverage of production source stays as it is (at least 80%). The SQL is covered by the behaviour tests above.

## Mocking and test data

No mocks. Aged audit events are inserted through the owner connection with an explicit `occurred_at` (as the existing purge tests do); the failing purge is injected with a temporary trigger that is dropped in a `finally` block.
