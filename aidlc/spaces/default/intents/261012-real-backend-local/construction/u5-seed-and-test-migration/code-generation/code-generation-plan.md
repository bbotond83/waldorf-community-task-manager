# Code Generation Plan: U5 Seed and test migration

## Summary

- Builds: the seed and reset commands (small set and 30-family set, fictitious data only, local-only guard, accounts scoped per schema), the 365-day audit purge, the removal of synthetic mode and everything that depends on it, the move of every data-exercising test and browser spec onto the local database with real sign-in, the CI and verification changes, and the documents (README, Hungarian testing guide, a report on the real workbook in git history and the known limits).
- Touches: `scripts/db/` (guard, seed module `scripts/db/seed/`, seed, reset), `supabase/migrations/20261044_audit_purge.sql`, `src/runtime/`, `src/application/`, `src/data/`, `app/` (routes, pages, actions), the deleted `src/parent-web`, `src/admin-core`, `src/admin-advanced`, `src/teacher-web`, `src/teacher-tracking` and `app/api/synthetic/`, `tests/` (database, integration, coverage, unit, browser), `playwright.config.ts`, `scripts/verification/`, `scripts/start-smoke.mjs`, `.github/workflows/ci.yml`, `package.json`, `.env.example`, `README.md`, `HASZNALATI_UTMUTATO_HU.md`, `verification/`.
- Tests: about 250 new or rewritten tests across fourteen components (guard, seed, reset, purge, deletion proofs, runtime configuration, session and facade rewrites, page and action tests on test doubles, browser specs with accessibility scans, timing tests), 10 to 15 per component, plus the existing suites kept green.
- Notes recorded on purpose: the dependency update (`zod`, `undici`) was already merged with PR #25, so Step 1 only verifies the audit; unit and component tests stay stack-free on injected test doubles, and only the database tests and the browser specs use the stack (the design's reading of NFR3.21); the audit purge is called by housekeeping only (not by seed or reset); the browsers use `worker_1` to `worker_3` in a phase of their own; each deleted module is deleted only when each of its rules has a proof or a recorded reason (NFR2.29); the open items of the infrastructure review (Validate job database settings for build, smoke and browser, `scripts/start-smoke.mjs`, owner connection for reset, one account namespace per schema, the retired `IDENTITY_BROWSER_SCHEMA` constant) are Steps 21 to 24.

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

Prerequisite: Docker Desktop running (the Docker CLI is at `/Applications/Docker.app/Contents/Resources/bin`) and Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` before the command chain). Database steps run against the real local stack; nothing is built on mocks of Postgres or the sign-in service. The new SQL goes into `supabase/migrations/20261044_audit_purge.sql`; merged migrations are never edited. The work is built part by part in the order of the testing contract: implement a layer, then write and run its tests. Traces use the requirement ids (FRn.n) and the NFR ids (NFRn.n) of this unit. The real workbook `source-materials/.../Ovis tábla v2.xlsx` is never read by any code, test or seed.

### Part 0: Skeleton and runners

- [x] **Step 1: Project structure, audit and runners.** Create `scripts/db/seed/` (data module, empty), `scripts/db/local-guard.ts` and the empty test files; add the scripts `db:seed`, `db:seed:large`, `db:reset` and `test:database:seed` to `package.json`; confirm `npm audit --audit-level=high` passes (the `zod` and `undici` update was merged with PR #25) and fix it here if it does not; confirm the Node test runner, Vitest, the real-stack database tests and Playwright run for new files; record the exact unit-scoped commands in `unit-test-instructions.md`. Traces: NFR1.70, NFR2.36, NFR2.30.

### Part A: Audit purge (database)

- [x] **Step 2: Migration `20261044_audit_purge.sql`.** Replace `audit_events_refuse_change()` so an update is always refused and a delete is allowed only while the transaction-local setting `app.audit_purge` is `on` and only for a row older than 365 days; add `audit_purge()` (security definer, `SET search_path FROM CURRENT`, execute only for `service_role`, sets the setting for its own transaction, returns the count, writes no audit event); re-create `identity_housekeeping()` from its `20261043_u4_repairs.sql` body with one call to `audit_purge()`, the count in its result, and its revoke and grant lines restated unchanged; add the catalogue entry for the new elevated function. Traces: NFR1.68, NFR2.35, NFR6.27.
- [x] **Step 3: Tests for the purge.** `tests/database/audit-purge.test.ts` (role matrix: only the system caller; aged events placed through the owner connection with an explicit `occurred_at`, one just under and one just over 365 days; only the aged one is deleted; no personal data in the result), changes to `tests/database/audit.test.ts` (an update, a delete of a recent row and a delete outside the purge are still refused), `tests/database/identity-housekeeping.test.ts` (the result carries the purge count) and `tests/database/identity-catalogue.test.ts` (the new entry); run the migration repeatability test with the new file on every schema. Traces: NFR1.68, NFR6.27.

### Part B: Seed and reset

- [x] **Step 4: Local-only guard.** Implement `scripts/db/local-guard.ts`: the database address must be loopback (`127.0.0.1`, `localhost`, `[::1]`) and the database must identify itself as the local stack; otherwise a plain refusal and no change. It also validates the schema selector (`public` or `worker_1` to `worker_4`). Traces: NFR1.63, NFR2.32.
- [x] **Step 5: Tests for the guard.** Unit tests: hosted-looking address, non-loopback address, missing setting, a database that does not identify itself, a bad schema name; each is refused and a recording fake proves nothing was changed. Traces: NFR1.63.
- [x] **Step 6: Seed data module.** Implement `scripts/db/seed/` with the small set (2 groups, about 6 families with parents and children, a group admin, a super admin, a teacher, a few events and tasks, Hungarian fictitious names, example domains) and the generator for the 30-family set; ids are derived deterministically from the schema name and the record's key with a fixed namespace (exported helper used by tests); account addresses are `<schema>.<tag>@example.test`; the fictitious test passwords live only here. Traces: NFR2.31, NFR1.64, NFR1.65, NFR8.4, FR9.1.
- [x] **Step 7: Seed and reset commands.** Implement `scripts/db/seed.ts` (`db:seed`, `db:seed:large`) and `scripts/db/reset.ts` (`db:reset`), all with `--schema <name>` (default `public`), all through the owner connection of `DATABASE_URL` and the sign-in service's admin interface for accounts: the seed writes one transaction per schema and creates accounts through the admin interface; the reset truncates every table of the chosen schema except reference data (including `audit_events`, which an owner truncate may do), removes every account whose address starts with `<schema>.` (the same prefix `db:worker --reset` removes), and runs the expiry and reminder-tick system functions; each command prints one result line with its duration and no passwords or personal data. Traces: NFR2.30, NFR3.18, NFR3.19, NFR6.28, NFR6.29.
- [x] **Step 8: Tests for seed and reset.** `tests/database/seed.test.ts` and `tests/database/reset.test.ts` on a worker schema: seeding twice changes nothing (a dump comparison), reset plus seed equals a fresh seed, a failure injected midway leaves the schema as it was, reset leaves every table empty except reference data and removes only that schema's accounts, a second schema's accounts and data are untouched, the expiry and tick functions ran, and the output scan with fictitious values finds no password, key or personal value. Add the files to `test:database:seed`, to `scripts/db/shuffled-tests.ts` and its test. Traces: NFR3.18, NFR3.19, NFR6.28, NFR6.29, NFR1.64.
- [x] **Step 9: Timing tests.** Tests that run the small seed (limit 60 s), the reset (30 s), the 30-family seed (120 s) and a real sign-in on seeded data (5000 ms) and fail above a limit, printing the duration. Traces: NFR4.17, NFR4.18, NFR4.19.

### Part C: Removing synthetic mode (application)

- [x] **Step 10: Inventory.** List every importer of the synthetic modules (`src/parent-web`, `src/admin-core`, `src/admin-advanced`, `src/teacher-web`, `src/teacher-tracking`, `src/runtime/synthetic`, `src/runtime/session/session.ts`, `ProfileSelector`, `shell-profile`) and every use of `runtimeMode`, `isSynthetic`, `selectSynthetic`, `switchSynthetic`, `APP_RUNTIME_MODE`, `scenario` and `SYNTHETIC_TEST_COPIES`; write the list with a keep, delete or rewrite decision into `code-summary.md` (working notes) so every later step can be checked against it. For every module to be deleted, list its rules and where each is proven against the database or why it is dropped (the disposition ledger, NFR2.29). Traces: NFR2.29, NFR2.34.
- [x] **Step 11: Runtime configuration and composition.** `src/runtime/config.ts`, `types.ts`, `composition.ts` and `scripts/validate-runtime-config.ts` keep the one production runtime: `APP_RUNTIME_MODE`, `APP_SYNTHETIC_FIXTURE_VERSION`, `SYNTHETIC_TEST_COPIES` and the synthetic branches are removed, a missing or invalid database setting still stops startup naming the setting (FR1.3), `.env.example` and `scripts/start-smoke.mjs` lose the synthetic values and the smoke supplies the database settings the production build needs. Traces: FR1.3, NFR2.34.
- [x] **Step 12: Session and application layer.** Remove `src/runtime/synthetic/`, `src/runtime/session/session.ts` (synthetic tokens and the in-code session secret), `ProfileSelector`, the `selectSynthetic` and `switchSynthetic` gateway and facade methods, the `RuntimeMode` type and the `isSynthetic` field and their checks in `src/application/` (authorization, contracts, session facade, parent and teacher facades), and the profile switcher in `AppShell`. Traces: NFR1.67, FR2.6, FR2.8.
- [x] **Step 13: App routes, pages and actions.** Delete `app/api/synthetic/session` and `app/api/synthetic/reset`; the pages, layouts, actions and session helpers under `app/` (`page.tsx`, `belepes`, `meghivas`, `szulo`, `admin`, `teacher`, `_identity`) use only the production path: the synthetic branches, `parent-local` constants, fixture lookups, test-profile switcher and the synthetic copy variants are removed, the import screen header becomes "Adminisztráció · Import", and markup, Hungarian copy and test ids of the other screens stay unchanged. Traces: NFR1.67, NFR5.8, NFR7.5, FR2.6, FR2.8.
- [x] **Step 14: Delete the synthetic modules.** Delete `src/parent-web`, `src/admin-core`, `src/admin-advanced`, `src/teacher-web`, `src/teacher-tracking` and anything left unused after Steps 11 to 13, each only after its ledger rows have proofs (Step 10); drop their folders from `lint`, `format` and `format:check` where listed. Traces: NFR2.29, NFR2.34.

### Part D: Test migration

- [x] **Step 15: Deletion proofs.** Tests that fail if a removed name, route, cookie or setting exists in production source (`profile picker`, `parent-local`, `/api/synthetic`, `APP_RUNTIME_MODE`, `SYNTHETIC_TEST_COPIES`, `scenario`) and a request test that each old route answers not found; add the five deleted folders to `scripts/verification/replaced-modules.test.ts` and remove them from the legacy allow-list of `scripts/verification/lint-scope.test.ts`. Traces: NFR1.67, NFR2.29.
- [x] **Step 16: Unit and component tests on test doubles.** Rewrite the tests that built on the synthetic adapters, the synthetic composition or `APP_RUNTIME_MODE` (`src/application/*.test.ts`, `src/runtime/**`, `tests/unit/`, `tests/integration/`, `tests/coverage/`) to use the injected test doubles of `tests/support/data-fakes.ts` and `tests/support/identity-fakes.ts` (extending them where a rule needs it); tests that only proved a deleted synthetic behaviour are deleted after their ledger rows have a proof elsewhere; no test imports a synthetic module. Each rewritten file keeps its assertions about copy, test ids and results. Traces: NFR3.21, NFR7.5, NFR2.29.
- [x] **Step 17: Coverage.** Run `npm run test:coverage` and add tests until lines, branches and functions are at least 80% across all production source after the deletions (the seed and reset scripts included); thresholds are never lowered. Traces: NFR2.28.
- [x] **Step 18: Browser harness.** `playwright.config.ts` maps `chromium` to `worker_1` and the first port, `firefox` to `worker_2` and the second, `mobile-chrome` to `worker_3` and the third, each server with its `DATABASE_SCHEMA`, `workers: 1`, synthetic settings removed; a helper in `tests/browser/support/` registers a `test.beforeAll` that resets and seeds the small set for the project's schema and returns the seeded accounts; the constants `IDENTITY_BROWSER_SCHEMA ?? "worker_4"` in `identity.spec.ts`, `directory-coordination.spec.ts` and `notifications-import.spec.ts` are replaced by the project's mapped schema; a guard test fails when a spec does not use the helper; the profile-picker timing specs, their config and support files are deleted. Traces: NFR3.20, NFR2.33.
- [x] **Step 19: Migrate the browser specs.** Move `admin-advanced`, `admin-core`, `functional-fixes`, `list-polish`, `navigation-polish`, `parent-web`, `runtime-foundation`, `teacher-web` and `visual-overhaul` (and keep `identity`, `directory-coordination`, `notifications-import`) to real sign-in with seeded accounts, asserting the same copy and test ids; the accessibility scan stays on the critical flows; three full runs in a row show no interference between browsers. Traces: NFR3.20, NFR3.21, NFR5.8, NFR7.5.
- [x] **Step 20: Sign-in timing in the browser phase.** A new sign-in timing check on seeded data replaces the deleted profile timing specs (5000 ms budget). Traces: NFR4.19, NFR4.20.

### Part E: CI and verification

- [x] **Step 21: Workflow settings.** `.github/workflows/ci.yml`: remove the synthetic settings from both jobs; the Validate job exports `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the running stack (as it already does for the service key) so `build`, `smoke` and `browser` find them; the SBOM job sets build-only placeholder values for the database settings the production build needs and drops the mode and fixture fields from its metadata; the Validate job time limit becomes 90 minutes. Traces: NFR4.20, NFR2.37.
- [x] **Step 22: Verification scripts.** `scripts/verification/run-local-verification.ts` (the `database-seed` key after `database-notifications-import` and before `database-shuffled`; the synthetic environment values removed), `scripts/verification/core.ts`, `validate-manifests.ts`, `aggregate-evidence.ts` and their tests (`runtimeMode` becomes `database`, `fixtureVersion` dropped), `verification/` records and schema, `ci-config.test.ts` (new key and position, `browser` last, no synthetic setting in either job). Traces: NFR2.37, NFR1.67.
- [x] **Step 23: Bundle and scans.** Extend the bundle test: the seed module and the service-role key are absent from client output; run the privacy, secret and no-deploy scans; update the privacy allowlist only for fictitious values. Traces: NFR1.66, NFR1.65.
- [x] **Step 24: Account namespace and owner connection.** Make the seed and reset use the owner connection through `DATABASE_URL` everywhere (the data service connection is never used for truncation), document in the seed module that the address prefix is the same namespace `db:worker` uses, and add the matching assertions to the reset test. Traces: NFR6.28, NFR1.64.

### Part F: Documentation and traceability

- [x] **Step 25: README.** English README: prerequisites (Docker Desktop and its licence check, Node 24, npm 11), the start, stop, seed, large seed and reset commands, the schema selector, the test phases; a test that the README lists each command. Traces: NFR2.38, FR1.5.
- [x] **Step 26: Hungarian testing guide.** Rewrite `HASZNALATI_UTMUTATO_HU.md` for real sign-in, invitations, password reset, the seeded accounts and testing with several people at once. Traces: NFR2.38, FR12.1.
- [x] **Step 27: Report on the workbook and known limits.** Write the report (`verification/reports/` or the path the plan of this unit's summary names) stating that the real workbook is still in git history until the owner rewrites it, and the known limits: reminder recipients are not re-planned when a family changes group, staged-data expiry depends on sign-ins until a scheduler exists, hosted-target checks stay outstanding evidence. Traces: NFR1.69, NFR6.30.
- [x] **Step 28: Final run and traceability.** Run the full local verification (`npm run verify:local`), the three browser runs in a row and the shuffled database run; write `code-summary.md` (files, decisions, tests written but not executed with the reason, deviations), `source-manifest.json` and `traceability.json`. Traces: all NFR ids of this unit.
