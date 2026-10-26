# Requirements: Worker local-only guard

## Intent analysis

`npm run db:seed` and `npm run db:reset` change a whole schema, so they run only against the Supabase CLI's local stack: a loopback address, the CLI's default local password, and a database that identifies itself as the local stack (`scripts/db/local-guard.ts`). `npm run db:worker` also changes data in bulk: with `--reset` it drops and rebuilds a test schema (`worker_1` to `worker_4`), and every run creates and migrates the schema, truncates its tables and deletes accounts by email prefix. It only checks that the address is on this machine. A hosted database reached through a loopback tunnel passes that check, so its worker schemas could be dropped and rebuilt.

This work gives `db:worker` the same guard, with one adaptation: the worker is itself a tool that creates the migration tracking table, so it must work on a stack that has never been migrated.

Origin: finding R-09 of the U1 review; group B5 of `follow-ups/minor-findings-plan.md`.

## Functional requirements

- **FR1** `setupWorker` (`scripts/db/worker.ts`) applies the local-only guard before it changes anything.
  - **FR1.1** Before any connection, the settings pass the address check and the default-local-password check (`assertLocalSettings`). A non-default password is refused before a connection is made.
  - **FR1.2** After connecting and before any other statement, the database must identify itself as the local stack (`assertLocalStack`): the CLI's `postgres` database, a `supabase_admin` role, and, when the database holds a JWT secret, the CLI's default one. A refused database has its connection closed and no `drop`, `create`, `truncate` or `delete` statement is run.
  - **FR1.3** For the worker only, the identity check does not require that the migration tooling has already set the database up (the tracking table may not exist yet). The seed and reset keep requiring it, unchanged: the new option defaults to requiring it.
  - **FR1.4** A refusal reaches the caller as a `ToolingError` with step `guard` and the worker and schema in its detail; no password or hash is echoed.
- **FR2** A stack that has never been migrated still works: the worker sets up its schema when the tracking table does not exist yet.
- **FR3** The seed and reset behaviour is unchanged (same checks, same messages, tracking table still required).
- **FR4** The README description of `db:worker` says it refuses anything but the local stack, like the seed and the reset.
- **FR5** `follow-ups/minor-findings-plan.md` records B5 as done, and notes that `db:migrate` (`scripts/db/migrate.ts`) has only the address check, listed as a separate possible follow-up.

## Non-functional requirements

- **NFR1** Safety: no existing check is weakened; a stack that passed before and is the real local stack still passes.
- **NFR2** Verifiability: unit tests with fake clients cover the refused password, the refused identity (client closed, no changing statement run), the never-migrated stack and the normal path. The real-stack tests that prepare worker schemas (`tests/database/stack-support.ts`) keep working against the real local stack.
- **NFR3** Quality gates: strict type check, lint, format check, unit tests pass; coverage stays at or above 80%.

## Constraints

- No new dependency.
- `tests/database/*` run against the real stack with the default password and already pass the guard.

## Assumptions

- On a fresh local stack `db:start` does not migrate (the tracking table is created by the first migration run, whichever tool runs it), so requiring it would break `db:worker` as the first command. That is why FR1.3 exists.
- A second guard for `db:migrate` is a separate decision: it applies forward-only migrations to `public` and is out of scope here.

## Out of scope

- Guarding `db:migrate`, `db:first-super-admin` or other commands.

## Open questions

None.
