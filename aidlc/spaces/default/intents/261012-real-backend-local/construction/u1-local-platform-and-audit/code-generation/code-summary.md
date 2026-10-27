# Code Summary: U1 Local platform and audit

Unit `u1-local-platform-and-audit`, intent `261012-real-backend-local`. All 17 plan steps are built and ticked. Test-after was followed layer by layer. Every database-dependent claim below was exercised against the real local stack (Supabase CLI 2.120.0, Postgres 17.11 in Docker Desktop 29.8.2), never against a mock.

## What was built

| Area | Files |
|---|---|
| Stack configuration | `supabase/config.toml` (Postgres, sign-in service, data API gateway and mail catcher only; Studio, storage, realtime, edge runtime, analytics and pooler off; `[api] schemas` = `public`, `worker_1` to `worker_4`), `supabase/roles.sql` (creates the four worker schemas with the API-role rights, applied by the CLI before the data API starts), `supabase/.gitignore` |
| Start, stop, migrate, worker commands | `scripts/db/{common,stack,start,stop,runner,migrate,worker,postgres,shuffled-tests}.ts`; npm scripts `db:start`, `db:stop`, `db:migrate`, `db:worker`, `test:database:stack`, `test:database:shuffled`, `test:scripts` |
| Migrations | `20260806_access_rls.sql` (fixed alias and pinned search path), `20261006_current_roles.sql` (made schema-neutral), new `20261012_platform_audit.sql` and `20261013_platform_idempotency.sql` |
| Runtime database configuration and client | `src/runtime/database/{config,client,redact}.ts` |
| Scans | `scripts/verification/{scan-core.ts,scan-artifacts.ts,privacy-allowlist.json}` |
| CI and pipeline | `.github/workflows/ci.yml`, `scripts/verification/run-local-verification.ts` |
| Repository hygiene | `.gitignore`, `.env.example`; the real-data workbook is untracked with `git rm --cached` (file kept on disk, history untouched) |

### Platform schema (BR3.1 to BR3.9)

- `audit_events`: uuid key, actor account and role, the ten fixed actions, target, organization and group scope, outcome `success` or `denied`, code-shaped `details` (at most 500 characters), UTC time. Append-only (trigger refuses update and delete for everyone, privileges revoked from the API roles). Indexes on actor, target and time.
- `platform_audit_write`: the only writer. `EXECUTE` is revoked from `anon`, `authenticated`, `service_role` and `public`; it is callable only from other functions owned by the trusted role. The actor is never a parameter: the account is the signed-in session (`auth.uid()`), or the nil system account when the caller is a trusted database role (operator command and seed).
- `idempotency_records`: unique on (account, operation, key), 24 hour expiry, fingerprint is a SHA-256 hex hash, only `success`, `validation`, `denied`, `conflict`, `terminal` can be stored. `platform_idempotency_check` serializes concurrent calls with the same key through an advisory lock; `platform_idempotency_store` replaces an expired row in the same statement (insert on conflict); `platform_finish_operation` writes the audit event for a success or denial and stores the result; `platform_cleanup_expired` is for the operator (`service_role`) only.
- `lifecycle_holds`: one open hold per target (partial unique index), release-only updates, version rising by one, rows retained. `platform_touch_version` is the generic optimistic-version trigger for later tables.
- First named audited functions `lifecycle_hold_place` and `lifecycle_hold_release` (granted to `authenticated` and `service_role`) follow the whole pattern: idempotency check, authorization, change, event and stored result in one transaction; denial commits only the denied event; an error rolls back everything.

### Tooling behavior

- `db:start`: checks Docker, ports (names the port and the process holding it), starts the stack, verifies only the intended services run, verifies the published ports, writes `.env.database.local` (address, public key, schema) and `.env.service.local` (database address and service credential for tooling), prints progress lines and a final timing. No key, password or address with a password is ever printed (redaction in `src/runtime/database/redact.ts`).
- `db:migrate [--schema name]`: the runner sets the session search path to `<schema>, pg_catalog`, applies pending files in name order, records each in `migration_runner.applied_migrations` (checksum, forward-only), refuses a file that hard-codes a schema name before touching the database, stops at the failing file and names it.
- `db:worker <worker_n> [--reset]`: validates the name, creates or rebuilds the schema, migrates, empties tables, removes the worker's accounts by the `<worker>.` email prefix, confirms the data API serves the schema (polls up to 10 seconds), and names worker, schema and step on failure.
- Runtime configuration (`readDatabaseConfig`): address (`https` anywhere, `http` only on 127.0.0.1, localhost or ::1), public key (a service credential is refused), session secret (32 or more characters, not the example), schema name. No service-role value is read.
- Client wrapper: one client per process bound to the schema profile; `callOperation` and `read` map every outcome to the existing result states; unexpected errors become `retryable` or `terminal`; error text is redacted; `forSession(token)` acts as a signed-in account.
- Scans: tracked `.xlsx .xls .ods .csv .sql` outside `tests/fixtures/fictitious/` (and the schema-file allowlist), emails and phone numbers (Hungarian and international forms) outside the fixtures folder and the allowlist, JWT-shaped strings, `sb_` keys, private keys and service-role key names with values; the CLI's four documented default keys are allowed by SHA-256 hash.

## Spike findings (plan step 1)

1. **Key names.** `supabase status -o env` prints `API_URL`, `DB_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET`, `REST_URL`, `GRAPHQL_URL`, `MAILPIT_URL` and `INBUCKET_URL`, plus the newer `PUBLISHABLE_KEY` (`sb_publishable_`) and `SECRET_KEY` (`sb_secret_`). The data API accepts both the anon JWT and the publishable key. `supabase start` itself prints all keys as JSON when not attached to a terminal, so the start script captures its output and never shows it. The app setting `SUPABASE_ANON_KEY` is filled from `ANON_KEY`.
2. **Loopback binding: not possible.** The CLI publishes the database (54322), data API (54321) and mail catcher (54324) on all interfaces (`HostIp` empty, `0.0.0.0` and `[::]`), and `supabase start --help` has no bind option. Measured: the ports answer on this Mac's LAN address and VPN address. **Stated fallback applied:** the start command checks every published port on every non-loopback address and, if any answers, stops the stack (data kept) and fails with a message that names the addresses and asks for a host firewall rule; `DB_ALLOW_ALL_INTERFACES=1` (or `--allow-all-interfaces`) acknowledges the rule. CI sets it (isolated runner VM). On this Mac the acknowledgement was used to run the stack for the real tests, so the stack with its well-known default keys was reachable from the local network while it ran; it was stopped afterwards. The README firewall instructions are U5 (FR1.5).
3. **Migrations before the data API.** The data API refuses to start when a schema named in `[api] schemas` does not exist (the CLI then aborts with a health-check error). The CLI applies `supabase/migrations/` while it starts the database, but `20261006_current_roles.sql` is an offline conversion that raises unless an operator baseline setting is present, so the CLI's own migration step is switched off (`[db.migrations] enabled = false`) and one runner applies every file to every schema. The empty worker schemas are created by `supabase/roles.sql`, which the CLI applies during database initialisation, before the data API starts (verified on a fresh volume: 23.8 s start, API healthy). `roles.sql` runs only when the volume is new; `db:worker` re-creates missing schemas and grants idempotently.
4. Postgres in the stack is 17.11 (CLI-pinned image); the existing CI step installs PostgreSQL 18 client tools for `test:database:roles`, which starts its own cluster. The majors differ by design of the CLI release; the note requested by `cicd-pipeline.md` is recorded here.

## Deviations and decisions to confirm

1. **`20261006_current_roles.sql` was edited** (schema-neutral: names unqualified, `current_schema()` for catalogue lookups, `set search_path from current`). Required so one file applies to the default and worker schemas (BR1.5). The operator guard, locks, preflight and policy replacement are unchanged. The existing tests that insert faults by marker string (`tests/database/current-role-migration.test.ts`) and the static SQL test (`src/access/current-role-migration.test.ts`) were updated to the unqualified text; the real-PostgreSQL role-migration suite passes (9 of 9). Only the first migration's checksum is pinned and it was updated (`tests/unit/current-role-references.test.ts`).
2. The runner sets the offline conversion's baseline setting itself, **only for a schema that has no applied migration and no table** (nothing to convert). A populated schema still hits the guard.
3. `supabase/roles.sql` instead of a bootstrap migration (finding 3). Config reading `[db.migrations] enabled = false`.
4. Start output prints the address and the name of the file that holds the public key, not the key (NFR1.13 and NFR1.8 are stricter than W1's "prints the public key").
5. `audit_events.actor_role` allows `none` in addition to the five roles in `entities.md`: a denied attempt by an account without any grant must still be attributable.
6. `platform_actor_role` derives the role from the existing `app_role_grants` table (mapping `kindergarten_teacher` to `teacher`). U2 must keep that table or update this function when it replaces the grants model.
7. `lifecycle_hold_place` and `lifecycle_hold_release` authorize `super_admin` and the system actor only; U3 may refine. They exist so the audit and idempotency pipeline is exercised end to end by real database tests.
8. The privacy allowlist (`scripts/verification/privacy-allowlist.json`) also lists the schema-file paths (otherwise the new `.sql` rule would flag the migrations), the reserved `example.invalid` domain, `git@github.com` (framework tooling), and the record folders `aidlc/`, `.aidlc-archive/`, `source-materials/` for content scans (the workbook extension rule still applies to them: it is what caught the tracked workbook).
9. `.gitignore` ignores `*.xlsx`, `*.xls`, `*.ods` everywhere except `tests/fixtures/fictitious/`, and the workbook path explicitly.
10. Scripts tests run under Node (`npm run test:scripts`, part of `npm test`) and also in Vitest's `domain-coverage` project so they count toward coverage; the production inventory pin in `tests/coverage/production-inventory.test.ts` moved from 164 to 177 files (the 13 new production files).
11. NFR3.4 (random order): `npm run test:database:shuffled` runs the database test files once in a seeded random file order (seed printed); it is part of `verify:local`. Order inside a file stays fixed, every test creates what it needs.
12. Database test files may run in parallel (the unit command in the test instructions does): they take advisory locks per schema, so files that share `public` or a worker schema wait for each other.
13. Two small edits (the npm scripts in `package.json` and imports and an appended block in `scripts/db/stack.test.ts`) were made with a short Python script instead of the file tools; the resulting content is the same as a normal edit.

## Verification results

The complete pipeline `npm run verify:local` passed (including the new database stage, security scans, build, start smoke and all 383 browser tests; stack running, local sha `80bd4f4`). Current executable results (these are authoritative over any older count):

| Check | Result |
|---|---|
| Strict type check, lint, format check | clean |
| Node domain tests (`src/**`, includes 37 new tests) | 295 passed |
| Node scripts tests (`scripts/**`, all new except the scan wiring) | 97 passed |
| Vitest delivery tests | 531 passed |
| Role-migration suite on real PostgreSQL 18 | 9 passed |
| Database tests on the real stack (`test:database:stack`): migrations 11, audit 26, idempotency 30, holds 30, worker 12 | 109 passed; also once in shuffled file order |
| Coverage (`test:coverage`, vitest, 923 tests in the coverage run) | statements 94.22, branches 86.98, functions 94.70, lines 96.39 percent; node native domain coverage 95.64 / 89.17 / 93.52 (line, branch, function); floor 80 not lowered |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Privacy, secrets, SAST, no-deploy scans | pass (privacy 983 files, secrets 1832 files) |
| Production build and start smoke | pass |

Timings against the NFR4 targets (reported, not enforced): stack start 23.6 to 24.5 s (target 90 s), also 23.8 s on a brand-new volume; migrations on the default schema 0.0 to 0.1 s (target 30 s); worker schema setup 0.03 to 0.3 s, four parallel workers three times in a row at most 0.07 s each (target 10 s); privacy plus secret scans 2.8 to 3.3 s together (target 15 s); audit write overhead 0.14 to 0.27 ms and idempotency lookup plus store 0.49 to 0.76 ms per operation (target under 50 ms).

Tracked files regenerated by `verify:local` (`verification/reports/*`) were restored to their committed content; they are bound to a git sha and should be regenerated at the lead's commit.

## Open items for other units

- U2: grants model replaces `app_role_grants` (see deviation 6); policies on `audit_events` for admin reading (currently no API role can read it).
- U5: README (prerequisites, firewall guidance for the published ports, reset commands), seed and reset commands (`platform_cleanup_expired` is ready), removal of the synthetic CI environment values, the workbook history rewrite (manual owner step).
- Repository: `.env.database.local` and `.env.service.local` were written by `db:start` on this machine; both are git-ignored and hold only the CLI's documented local defaults.

## Superseded by later units (note of 2026-10-27)

The text above is kept as written at the U1 checkpoint; these statements were overtaken later.

- **Verification table (R-04):** the table under "Verification results" shows the counts as of the U1 checkpoint. Current counts come from running the commands, not from this table.
- **Audit retention (R-07):** audit rows can now be deleted after 365 days, by `audit_purge()` only (U5, migration `20261044_audit_purge.sql`, made failure-safe and capped by `20261045_audit_purge_isolation.sql`). The append-only rule still refuses every other update and delete. If BR3.4 is reopened, read it with this in mind.
- **Manifest:** `source-manifest.json` now lists the files U1 built under `src/runtime/database/` and `scripts/db/` instead of the two whole folders (later units added files there).
- **Advisories (2026-10-27):** the "4 or 5 moderate advisories" lines in this summary are as of their date. `nodemailer` 10.2.1 and `vitest` 4.1.12 (with the two coverage packages) removed them; `npm audit` reports 0 vulnerabilities (follow-up D3, PR 36).
