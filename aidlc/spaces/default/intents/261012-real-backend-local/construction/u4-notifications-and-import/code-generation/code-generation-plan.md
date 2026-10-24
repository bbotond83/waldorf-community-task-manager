# Code Generation Plan: U4 Notifications and Excel import

## Summary

- Builds: real notification records for parents, simulated reminder jobs with recipients and attempts, the notice and job writes inside U3's use cases, and the Excel import (server-only workbook parser with one pinned library, preview with conflicts, atomic commit with re-matching, interruption and recovery, staged data visible only to the starting super admin), the database adapters for the notification, reminder and import port operations in the production composition, and the owner-approved import screen changes.
- Touches: `supabase/migrations/` (new files from `20261036` on), `src/data/` (adapters), `src/import-parser/` (new server-only module), `src/application/` (port and model additions), `src/runtime/production/`, `app/` (import screen, upload action, notification and reminders wiring), `next.config.ts`, `package.json` (one pinned library, scripts, lint lists), `scripts/` (verification, shuffled tests, lint scope, replaced modules), `tests/database/`, `tests/integration/`, `tests/browser/`, and the deletion of `src/notifications` and `src/import-migration`.
- Tests: about 350 tests across thirteen components (unit with fakes, parser, real-stack database, contract, component, and browser with accessibility checks), 10 to 15 per component, plus the staged-data privacy, race, lock-order, atomicity, timing and hand-off completeness tests the NFRs name.
- Notes recorded on purpose: the four running synthetic adapters stay until U5 (same coexistence as U3); import-created assignments write no parent notices and plan reminder jobs only (NFR6.26); the archive sheets are counted, not copied (BR41.10); function names in the design use no dots (`import_commit`); U3's `dashboard_import_conflicts` body is replaced and its marker test inverted.

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

Prerequisite: Docker Desktop running (the Docker CLI is at `/Applications/Docker.app/Contents/Resources/bin`) and Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` before the command chain). Every database step runs against the real local Supabase stack; nothing is built on mocks. New SQL goes into new migration files numbered from `20261036` on; merged migrations are never edited. The design is built part by part, each part in the order of the testing contract: implement a layer, then write and run its tests. Traces use the functional design ids (BRn.n), requirement ids (FRn.n) and NFR ids (NFRn.n) of this unit.

### Part 0: Skeleton and runners

- [x] **Step 1: Project structure and configuration skeleton.** Create `src/import-parser/` (server-only parser module: `index.ts`, `template.ts`, `limits.ts`, `workbook.ts`) and the empty test folders; extend `package.json` `lint`, `format` and `format:check` with `src/import-parser`; add the script `test:database:notifications-import`; add the stage `database-notifications-import` to `scripts/verification/run-local-verification.ts` after `database-directory` (before `database-shuffled`), add every new database test file to `scripts/db/shuffled-tests.ts` and update `scripts/db/shuffled-tests.test.ts`, extend `scripts/verification/ci-config.test.ts` (stage key, position, script), and add `src/import-parser` to `scripts/verification/lint-scope.test.ts`. Traces: NFR2.18, NFR2.25, NFR2.27, NFR3.16.
- [x] **Step 2: Verify the runners and pin the xlsx library.** Confirm the Node test runner, Vitest, the real-stack database tests and Playwright run for new files; choose the one read-only xlsx library (no formula evaluation, maintained, minimal dependencies), add it as an exactly pinned dependency, run `npm audit` (high and critical must stay zero), record the choice and the alternatives considered for `code-summary.md`, and record the exact unit-scoped commands in `unit-test-instructions.md`. Traces: NFR2.19, NFR1.49.

### Part A: Notifications and reminders (database)

- [x] **Step 3: Notifications schema (data model).** Migration `20261036_notifications_schema.sql`: tables `notifications`, `reminder_jobs`, `reminder_recipients`, `reminder_attempts` per `entities.md` (unique live job per task and threshold, unique dedupe key, at most 3 attempts), the indexes NFR3.13 lists, row-level policies (a parent reads and may set `read_at` on their own rows only; no other role reads notifications; admins reach jobs through functions), no table rights for the service-role key, typed ids across blocks. Traces: BR40, NFR1.43, NFR3.13.
- [x] **Step 4: Notifications schema tests.** `tests/database/notifications-schema.test.ts`: constraints and indexes, the policies per caller (parent whose notice it is, another parent, teacher, group admin, super admin, signed-out, deactivated), cross-organization isolation, the privilege list (10 to 15 tests); default and worker schema. Traces: NFR1.43, NFR1.53.
- [x] **Step 5: Notification and reminder functions.** Migration `20261037_notifications_functions.sql`: `notification_list` (own, newest first, the display mapping of BR40.2), `notification_mark_read`, `reminder_plan`, `reminder_run_due` (system caller or organization member, idempotent), `reminder_list` (one row per job, counts only), `reminder_retry`, each security definer with `SET search_path FROM CURRENT`, caller checks as the rules' callers paragraph says, catalogue entries, stored result codes. Traces: BR40.2 to BR40.8, BR42.3, BR42.4.
- [x] **Step 6: Notification and reminder function tests.** `tests/database/notifications-functions.test.ts`: list mapping for every kind and job status, mark read once and twice, planning (thresholds, missed threshold, started or closed task, recipients by setting), the tick (success, failure, third failure terminal, no duplicate notices, first-run notices for linked parents), retry codes REMINDER_NOT_RETRYABLE and REMINDER_STALE, tick concurrency (10 to 15 tests). Traces: NFR6.22, NFR6.21, NFR3.14.
- [x] **Step 7: Notification writes inside U3's use cases.** Migration `20261038_notifications_hooks.sql`: `create or replace` of the U3 functions on the hand-off list (`duty_sign_up`, `assignment_assign`, `assignment_remove`, `swap_request`, `swap_respond`, `swap_withdraw`, `cancellation_request`, `swap_decide`, `cancellation_decide`, `family_archive`, `family_restore`) and of `task_save`, `event_save`, `settings_save`, `lifecycle_run` adding exactly the notices and job or recipient changes of the BR40.9 table, in the same transaction; the dedupe keys of `entities.md`. Traces: BR40.1, BR40.5, BR40.9.
- [x] **Step 8: Hand-off, failure-injection and race tests.** `tests/database/notifications-handoff.test.ts`: every entry of U3's `NOTIFICATION_USE_CASES` and the extra functions produces the BR40.9 notices and job changes, a use case whose notice write fails rolls back as a whole, idempotent replays create nothing twice, a genuine repeat (sign up again after cancelling) creates a new notice, the swap exchange re-plans both tasks, a withdrawn swap's notice reads cancelled, lifecycle removes the family's notices and recipients; extend the unit test of the exported list; run U3's `test:database:directory` and fix regressions (10 to 15 tests). Traces: BR42.5, NFR6.18, NFR6.25, NFR1.56.

### Part B: Import (database)

- [x] **Step 9: Import schema (data model).** Migration `20261039_import_schema.sql`: tables `import_runs`, `import_rows`, `import_staged_rows`, `import_conflicts`, `sheet_registry` (seeded with the 17 sheets, 8 interactive and 9 archive, by the migration), constraints and indexes of `entities.md` and NFR3.13, policies: runs and rows and conflicts reachable only by the super admin who started the run, `import_staged_rows` readable and deletable by that admin only (and by the system expiry function), no table rights for the service-role key. Traces: BR41.7, BR41.10, NFR1.44, NFR1.52.
- [x] **Step 10: Import schema tests.** `tests/database/import-schema.test.ts`: constraints, the registry seed (exactly 17, 8 and 9), the role matrix per caller including a second super admin and the service-role key, cross-organization isolation (10 to 15 tests). Traces: NFR1.44, NFR1.45, NFR1.53.
- [x] **Step 11: Import preview, resolve, status, cancel, expire and recovery functions.** Migration `20261040_import_functions.sql`: `import_preview_create` (takes the parsed rows, matches by the ordered decision table of BR41.4, records matched id and version, builds the fingerprint, cancels the admin's earlier open run, returns run id, version and the preview model), `import_conflict_resolve`, `import_status` (the mapping of BR41.13), `import_cancel`, `import_expire` (system caller or super admin), `import_mark_interrupted`, `import_recover`; stored codes. Traces: BR41.1, BR41.3 to BR41.5, BR41.8, BR41.9, BR41.13.
- [x] **Step 12: Import function tests.** `tests/database/import-functions.test.ts`: every matching case (email hit, name hit, differing emails, several hits, duplicate in file, unknown group or family), conflict resolution and the version sequence, status mapping for every run state, one open run per admin including the double-preview race, expiry with a controllable clock, mark interrupted and recovery codes (10 to 15 tests). Traces: BR41.4, BR41.5, BR41.8, BR41.13, NFR3.14, NFR1.47.
- [x] **Step 13: Import commit.** Migration `20261041_import_commit.sql`: `import_commit` (fingerprint, open conflicts and confirmation checks; re-matching of every row inside the transaction with `IMPORT_MATCH_CHANGED`; applying rows through U3's save functions with recorded versions, derived idempotency keys and ascending id lock order; archive rows recorded as archived and counted as skipped; no Notification rows for imported assignments but reminder jobs planned; ONE `import.commit` audit event with counts; staged rows deleted; whole rollback on failure). Traces: BR41.6, BR41.10, NFR6.26.
- [x] **Step 14: Import commit tests.** `tests/database/import-commit.test.ts`: success counts, each IMPORT_* code, drift between preview and commit (record added, changed, archived), a failing row set proves rollback including the run status, idempotent repeat, double click, crossing swap and archive against the commit (no deadlock), no notices and jobs planned for imported assignments, the audit event content (counts and run id only), staged rows gone (10 to 15 tests). Traces: NFR1.54, NFR6.19, NFR6.20, NFR6.26, NFR3.15, NFR1.55, NFR1.60.
- [x] **Step 15: Dashboard count, lifecycle cleanup and catalogue.** Migration `20261042_import_dashboard_lifecycle.sql`: replace the body of `dashboard_import_conflicts` (BR41.12), extend `lifecycle_run` to also clear the U4 data of the family (done in Step 7 for notifications; here nothing personal remains in jobs or recipients), invert U3's marker test; extend the elevated-function catalogue and the service-role privilege tests with every U4 table and function; migration repeatability for U4's files in the default and a worker schema. Traces: BR41.12, BR42.4, NFR1.51, NFR1.56, NFR6.17.
- [x] **Step 16: Catalogue, history-leak, timing and data-set tests.** `tests/database/import-catalogue.test.ts` (catalogue, privileges, repeatability), `tests/database/import-privacy.test.ts` (leftover search of the history tables after an import with fictitious personal values, conflict-list shape, expiry), `tests/database/notifications-timing.test.ts` with the data-set generator extended to 3000 notifications and 600 jobs (timings of NFR4.10 to NFR4.16 where the database side applies; U3 and U2 timing re-runs) (10 to 15 tests). Traces: NFR1.46, NFR3.12, NFR4.12, NFR4.13, NFR4.14, NFR4.15.

### Part C: Parser and adapters

- [x] **Step 17: Server-only workbook parser.** In `src/import-parser/`: read the uploaded bytes with the pinned library; checks in the order of BR41.2 (format, size and uncompressed limits from the ZIP directory before expansion, the 17 sheets, the template headers of rules.md, cell safety with the phone exception, consent column, invalid phone dropped and counted); output the staged rows and warnings for `import_preview_create`; no path, no formula evaluation, no macros; `import 'server-only'`. Traces: BR41.2, NFR1.48, NFR2.19, NFR2.21.
- [x] **Step 18: Parser tests and the fictitious workbook generator.** `src/import-parser/*.test.ts` and `tests/support/workbook.ts`: generator for the 17-sheet template (fictitious names, '+36' phone, invalid phone, consent mark, duplicates, ambiguous matches, a formula cell, a long cell, a zip-bomb-style file made in test code), each IMPORT_* code, the 5 MB and 6 MB boundaries, the path guard that no code or test reads `source-materials/`, timing for the maximum workbook (10 to 15 tests per component). Traces: BR41.11, NFR1.48, NFR1.50, NFR4.16, NFR2.24.
- [x] **Step 19: Database adapters behind the ports.** In `src/data/`: parent port `listNotifications` and `markNotificationRead` with the lazy reminder tick, admin port `reminders.list`, `reminders.retry`, `import.preview` (parses the uploaded bytes, calls the function), `import.status`, `import.resolve`, `import.commit`, `import.recover` and a cancel, returning the existing result states and codes (BR42.3), run id and run version carried in the preview model, a fresh idempotency key per attempt, marking the run interrupted after a retryable commit failure; extend `src/application/` models (`ImportPreviewModel` gains `runId`, `runVersion`, file name) and the upload action input; remove the interim port from the production path for these operations (governance, lifecycle and settings stay). Traces: BR42.1, BR42.3, BR41.9.
- [x] **Step 20: Adapter tests.** `src/data/*.test.ts` with fakes (result and error mapping, fresh keys, run id and version sequence, interrupted marking, lazy tick) and `tests/database/notifications-adapters.test.ts` against the real stack (every operation; the code-by-code contract test of BR42.3) (10 to 15 tests per component). Traces: NFR2.26, NFR6.23, NFR6.20.
- [x] **Step 21: Composition, upload action and configuration.** Wire the new adapters in `src/runtime/production/`; the upload server action in `app/admin/` reading the file as bytes with the 5 MB check and a Hungarian message; `next.config.ts` `experimental.serverActions.bodySizeLimit` of 6 MB. Traces: BR42.1, BR41.2, NFR2.20.
- [x] **Step 22: Wiring tests.** `tests/integration/notifications-wiring.test.ts` (production mode builds the notification and import operations, synthetic mode unchanged, the body-limit setting present, no interim port in the production path for these operations) (10 to 15 tests). Traces: NFR6.24.

### Part D: Screens

- [x] **Step 23: Import screen changes (frontend).** In production mode only: the file input and upload form, the run id and run version in the resolve, commit and recovery forms (no constants), a fresh idempotency key per attempt, the confirm text and result panel from the real outcome counts, the file name on the 'Forrás' line, no scenario selects or `scenario` field, the 'new upload' link on the result step; Hungarian messages for the new codes (IMPORT_UNSAFE_CELL, IMPORT_MATCH_CHANGED and the others); data-testid on new controls; synthetic mode unchanged. Traces: BR42.2, NFR5.6, NFR5.7, NFR7.4.
- [x] **Step 24: Screen tests.** `tests/integration/import-screens.test.tsx`, `import-actions.test.ts`, extend `copy.test.ts` (states, messages, labels, key freshness, version sequence for two conflicts) (10 to 15 tests per component); existing import and other screen tests stay unchanged and green. Traces: NFR5.7, NFR7.4.
- [x] **Step 25: Browser and accessibility tests.** `tests/browser/notifications-import.spec.ts` against a production build on the real stack (own server port as in U3): a super admin uploads the fictitious workbook, resolves two conflicts, confirms and sees real counts, a second import after the first, an interrupted commit and recovery (failure injected), a non-super-admin cannot reach the import, a parent sees only their own notification after a sign-up and a swap, a real admin sees the reminders list; an accessibility scan on every import step; one reported preview timing. Traces: FR7.1, FR7.3, FR8.1, NFR5.6, NFR4.10, NFR6.24.

### Part E: Clean-up, configuration and documentation

- [x] **Step 26: Remove the replaced modules.** Delete `src/notifications` and `src/import-migration` with their tests only when every ledger row of the module has a passing proof from Parts A to C (a search test that nothing imports them); add them to `scripts/verification/replaced-modules.test.ts`; remove them from the lint allow-list; fix the production-inventory count; the notification part of `src/parent-web` and the import and reminder parts of `src/admin-advanced` stay for U5. Traces: BR43.1, NFR2.26.
- [x] **Step 27: Environment, build and CI configuration.** `.env.example` unchanged; verify `.github/workflows/ci.yml` runs the new stage within its timeout; run the full verification chain (type check, lint, format check, all tests, coverage at or above 80% on all production source, the scans, production build, bundle scan after the build, start smoke, browser tests, dependency audit) and the U1 to U3 database suites. Traces: NFR2.25.
- [x] **Step 28: Documentation and traceability.** Write `code-summary.md` (what was built, deviations, test counts from the final run, the xlsx library choice and alternatives, outstanding evidence), `source-manifest.json`, and `traceability.json` mapping every functional requirement and rule to its steps and tests. Traces: all FR and BR ids of the unit.
