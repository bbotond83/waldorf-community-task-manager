# Test Instructions: B3 denied-call audit rate limit

## Framework and setup

- Runner: Node's built-in test runner, `node --experimental-strip-types --test` (Node 24), the same form the `test:database:*` scripts in `package.json` use. No new dependency or configuration.
- Client: `pg` through `tests/database/stack-support.ts` (`openDatabase`, `lockSchemas`, `prepareSchema`, `useSchema`, `asActor`, `seedGrants`) and `resetWorkerData` from `scripts/db/worker.ts`.
- Prerequisite: the local Supabase stack must be running and migrated (`npm run db:start`, then the project's migrate step as `verify:local` does). These are real-stack tests: no mocks or stubs of the database.

## Commands (scoped to this change)

Run the new behaviour tests:

```bash
node --experimental-strip-types --test tests/database/audit-denied-limit.test.ts
```

Run the migration order test file and the existing audit tests that exercise the same function:

```bash
node --experimental-strip-types --test tests/database/migrations.test.ts tests/database/audit.test.ts
```

When running on a machine with several Node versions, put `export PATH=...` for the Node 24 binary before the command rather than a leading `PATH=...` assignment, so every part of a chained command uses the right version.

## Tests (Minimal strategy: one per requirement)

| # | Test | Requirements |
|---|------|--------------|
| 1 | 1st to 20th denied events written, 21st not; 21st call still returns `denied`; its replay returns `denied` and writes nothing | FR1, FR1.2, FR2 |
| 2 | Sliding window: 20 denied events aged 61 minutes do not block, 20 aged 59 minutes do | FR1.1, FR1.4 |
| 3 | Another account is not affected by one account at the limit | FR1.3 |
| 4 | Success events are always written and do not count towards the limit | FR3 |
| 5 | The system account is exempt (21 denied events all stored) | FR4 |
| 6 | 25 simultaneous denied calls for one account store exactly 20 | NFR1 |
| 7 | Function closed to `anon`, `authenticated`, `service_role`; partial index present | NFR2, NFR3 |
| 8 | Migration `20261046` sorts after `20261045`, is applied in `public` and `worker_4`, second run applies nothing | C1, C2 |

Tests 1 to 7 run once per schema (`worker_1`, `public`), like `audit.test.ts`.

## Test data

- Accounts and grants come from `seedGrants` (`PARENT`, `OUTSIDER`, `SYSTEM_ACCOUNT`, `ORGANIZATION`); `resetWorkerData` clears every table before each test.
- Denials: `lifecycle_hold_place('<key>', 'child', uuid(n), ORGANIZATION, 'legal_hold:case_1')` as `PARENT` or `OUTSIDER` through `asActor`, with a distinct key per call.
- Aged events: insert rows directly as the schema owner with `occurred_at = now() - '<n> minutes'::interval` (the append-only trigger allows inserts), as `audit-purge.test.ts` does.
- Concurrency (test 6): open separate connections (one per simultaneous call), set each to the schema and actor, and start the calls together; close every connection in a `finally` block.

## Coverage

The SQL migration is outside the TypeScript coverage denominator. The team's 80 percent floor applies to production TypeScript source, which this change does not touch; the repository-wide coverage run must stay at or above the floor. Never lower a threshold to make a step pass.

## Security and performance notes

- Security: test 7 checks that the privilege restatement held; the function must stay `security definer` with `set search_path from current`.
- Performance: the count is served by the partial index on denied events; the per-account lock serializes only calls for the same account.
