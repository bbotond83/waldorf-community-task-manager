# Code Generation Plan: U1 Local platform and audit

## Summary

- Builds: the local Supabase stack commands, the migration runner with per-worker schemas, the audit and idempotency storage with their database functions, the runtime database configuration, and the extended privacy and secret scans.
- Touches: `supabase/`, `scripts/db/`, `src/runtime/database/`, `scripts/verification/`, `tests/database/`, `.github/workflows/ci.yml`, `package.json`, `.gitignore`, `.env.example`.
- Tests: about 60 tests across seven components (unit, database-backed integration and an end-to-end start-and-migrate check), 10 to 15 per component.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "classic",
  "test_strategy": "comprehensive",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "comprehensive",
    "strategy_volume": [
      "Ten to fifteen tests per component.",
      "Unit, integration, and E2E tests.",
      "Add performance and security tests when NFRs demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:37019a2673d9609f9cba1d03866d2b51b65aff00c3b258229a4590493cad4de4",
  "contract_sha256": "sha256:8249630496afe806bf8700aca318c689ae19e1a84e4e11c246148a0794aafd3c"
}
```

## Steps

Prerequisite for any step that runs the stack: Docker Desktop is installed and running with the `docker` command available (owner prerequisite, plan question Q3). Steps 1 to 5 need no Docker; steps 6 onward do. If Docker is not ready at step 6, Construction stops there and reports it; nothing is built on mocks.

- [x] **Step 1: Project structure and configuration skeleton.** Create the folders `scripts/db/`, `src/runtime/database/`, `tests/database/`; add the pinned Supabase CLI and database client as exact-version dependencies in `package.json`; add the scripts `db:start`, `db:stop`, `db:migrate`, `db:worker`; add `supabase/config.toml` with only the needed services (disabled: Studio, storage, realtime, edge runtime, analytics, pooler; `[api] schemas` with `public` and `worker_1` to `worker_4`); extend `.gitignore` and `.env.example` (names only). Traces: FR1.1, FR1.4, NFR2.1, NFR2.3. **Spike first**: confirm the CLI's key names, loopback binding, and that migrations apply before the data API starts (stated fallbacks in `infrastructure-specification.md`).
- [x] **Step 2: Verify the test runner and record the unit-scoped commands.** Confirm `node --experimental-strip-types --test` and `vitest` run for the new files; record the exact commands in `unit-test-instructions.md`. Traces: NFR2.7.
- [x] **Step 3: Runtime configuration (business logic).** `src/runtime/database/config.ts`: validate the database address (loopback `http` or any `https`), public key, session secret (32+ characters, not the example) and schema setting (BR1.3); no service-role value is read (BR1.4); startup stops naming the failing setting. Traces: FR1.3, FR1.4, BR1.3, BR1.4.
- [x] **Step 4: Runtime configuration tests.** `src/runtime/database/config.test.ts`: valid local, valid hosted, http with a non-loopback host, bad scheme, missing key, short or example secret, bad schema name, service-role name never read (10 to 15 tests). Run and fix.
- [x] **Step 5: Database client wrapper (repository/data access).** `src/runtime/database/client.ts`: one client per process using the configured schema profile; maps unexpected infrastructure errors to the existing `retryable` and `terminal` result states (BR4.1) and never raises raw errors to screens. Traces: FR4.2, BR4.1.
- [x] **Step 6: Client wrapper tests.** `src/runtime/database/client.test.ts`: success, validation, denied, conflict, retryable and terminal mapping, error redaction (no keys in messages) (10 to 15 tests). Run and fix.
- [x] **Step 7: Migration runner and stack scripts (data model / database behavior).** `scripts/db/runner.ts` applies the files in `supabase/migrations/` to a named schema using a session search path (functions use `SET search_path FROM CURRENT`, BR1.5); `scripts/db/start.ts`, `stop.ts`, `migrate.ts` with progress lines, timings and failure messages (BR1.1, BR1.2, NFR1.11 to NFR1.13); the start script verifies loopback-only ports and that only the intended services run. Fix the reserved-word alias in `supabase/migrations/20260806_access_rls.sql` and update the checksum in `tests/unit/current-role-references.test.ts` (FR1.2). Traces: FR1.1, FR1.2, BR1.1, BR1.2, BR1.5.
- [x] **Step 8: Runner and script tests.** `scripts/db/runner.test.ts` (unit tests with a fake database: ordering, failure naming, hard-coded schema refusal) and `tests/database/migrations.test.ts` (against the real stack: apply to an empty database twice, apply to a worker schema, search-path pin on every elevated function). Also a start-and-migrate end-to-end check and an output test with fake secrets. Run and fix.
- [x] **Step 9: Platform schema (data model).** New migrations: bootstrap `worker_1` to `worker_4` with grants; `AuditEvent`, `IdempotencyRecord`, `LifecycleHold` tables with uuid keys, scope columns, version, timestamps and the indexes of NFR3.3; the audit write function (not callable by application roles, actor derived from the session or a verified system actor); the generic audited-change and idempotent-operation wrappers; the expiry cleanup function; the action and outcome constraints (BR3.1 to BR3.9). Traces: FR3.1, FR3.2, FR3.5, FR3.6, BR3.1 to BR3.9.
- [x] **Step 10: Platform schema tests.** `tests/database/audit.test.ts`, `idempotency.test.ts`, `holds.test.ts`: wrong-role refusal for the audit function and direct insert, update and delete refusal, atomic rollback after an injected failure, denied event committed with a denied result, code-shaped details (accept, free text, over-length), replay of stored results, conflict on a different fingerprint, never storing `retryable`, expired row replacement, two simultaneous calls, stale version refusal, one open hold per target, the added audit time under 50 ms (10 to 15 tests per file group). Run each against the default schema and a worker schema (BR10.4). Fix until green.
- [x] **Step 11: Worker schema setup (API/endpoint layer for tooling).** `scripts/db/worker.ts`: validates the worker name, creates or resets `worker_n`, applies all migrations, grants roles, confirms the data API serves the schema within 10 seconds (BR10.1, BR10.3), removes the worker's accounts by prefix on reset. Traces: FR10.2, BR10.1, BR10.3.
- [x] **Step 12: Worker setup tests.** `tests/database/worker.test.ts`: name validation, create and reset, data API confirmation, two workers in parallel without interference, three consecutive parallel runs, setup time under 10 seconds reported, failure naming worker, schema and step (10 to 15 tests). Run and fix.
- [x] **Step 13: Privacy and secret scans (business logic for tooling).** Extend `scripts/verification/scan-artifacts.ts`: tracked `.xlsx`, `.xls`, `.ods`, `.csv`, `.sql` outside `tests/fixtures/fictitious`, emails and phone numbers outside the fixtures folder, lock files and the allowlist `scripts/verification/privacy-allowlist.json`; JWT-shaped strings and service-role key names with values, with an allowlist of the CLI's documented defaults by hash. Untrack `source-materials/waldorf-community-app/Ovis tábla v2.xlsx` (`git rm --cached`) and ignore it. Traces: FR11.1, BR11.1, BR11.2, NFR1.6, NFR1.7.
- [x] **Step 14: Scan tests.** `scripts/verification/scan-artifacts.test.ts`: planted workbook, email, phone number, JWT and key name (positive); allowed example, fixture file, documented default key (negative); timing report under 15 seconds (10 to 15 tests). Run and fix.
- [x] **Step 15: Environment, CI and build configuration.** Update `.github/workflows/ci.yml` (start the stack with `npm run db:start`, run the database stage, stop the stack always, keep actions pinned and deployment workflows disabled, keep the synthetic environment values until U5), `scripts/verification/run-local-verification.ts` (database stage and the default-schema run), and keep the build and start smoke passing. Traces: FR10.3, BR10.2, NFR2.6.
- [x] **Step 16: CI and verification configuration test.** A test that reads `ci.yml` and checks: no deployment job, actions pinned to full revisions, the stack start and stop steps present, the database stage present (5 to 10 tests). Run the full unit-scoped set, the existing suite, type check, lint, format check and coverage; fix until green at 80% lines, branches and functions.
- [x] **Step 17: Documentation and traceability.** Short comments where non-obvious; a section in `README.md` is deferred to U5 (FR1.5), but `.env.example` and the new scripts' `--help` output are complete; write `code-summary.md`, `traceability.json` and `source-manifest.json` for this unit. Traces: all U1 requirements.

## Traceability (requirement to plan step)

| Requirement | Plan steps |
|---|---|
| FR1.1 | 1, 7 |
| FR1.2 | 7, 8 |
| FR1.3 | 3, 4 |
| FR1.4 | 1, 3, 4 |
| FR3.1, FR3.2 | 9, 10 |
| FR3.5 | 9, 10 |
| FR3.6 | 9, 10 |
| FR4.2 | 5, 6 |
| FR10.2 | 11, 12 |
| FR10.3 | 15, 16 |
| FR11.1 | 13, 14 |
