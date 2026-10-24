# Code Generation Plan: U3 Directory, settings and coordination

## Summary

- Builds: the real tables, policies and use-case functions for people and structure (Directory), settings, and tasks, sign-ups, swaps, cancellations, notes and the teacher schedule (Coordination), the lifecycle, the database adapters behind the parent, admin and teacher ports in the production composition, the invitation link for a parent, and the owner-approved screen changes (partner picking and confirming swaps, extended admin forms).
- Touches: `supabase/migrations/` (new files only), `src/data/` (new database adapters), `src/runtime/production/`, `src/application/` (port additions), `src/access/` (parent matrix and role policy), `app/` (parent, admin and teacher pages and actions), `scripts/` (verification, shuffled tests, config test), `tests/database/`, `tests/integration/`, `tests/browser/`, `package.json`, and the deletion of `src/directory`, `src/coordination`, `src/parent-experience` and `src/privacy-audit`.
- Tests: about 400 tests across fourteen components (unit with fakes, real-stack database, contract, component, and browser with accessibility checks), 10 to 15 per component, plus the race, lock-order, timing and lifecycle-completeness tests the NFRs name.
- Deviation from the approved design, recorded on purpose: rule BR34.1 listed `src/parent-web`, `src/admin-core`, `src/teacher-web` and `src/teacher-tracking` for deletion in U3. They are still the running code of the synthetic composition, which only U5 removes, so U3 builds the database adapters beside them (in the production composition) and U5 deletes them with their ledger proof; the design files are frozen by review, so the correction is recorded here and in `code-summary.md`. Function names in the design use dots (`duty.sign_up`); in SQL they are written with underscores (`duty_sign_up`).

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

Prerequisite: Docker Desktop running (the Docker CLI is at `/Applications/Docker.app/Contents/Resources/bin`; add it to PATH) and Node 24 (`export PATH=/opt/homebrew/opt/node@24/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH` before the command chain). Every database step runs against the real local Supabase stack; nothing is built on mocks. New SQL goes into new migration files numbered above `20261023`; merged migrations are never edited. The design is built part by part, each part in the order of the testing contract: implement a layer, then write and run its tests. Traces use the functional design ids (BRn.n), the requirement ids (FRn.n) and the NFR ids (NFRn.n) of this unit.

### Part 0: Skeleton and runners

- [x] **Step 1: Project structure and configuration skeleton.** Create `src/data/` (database adapters: `parent-port.ts`, `admin-port.ts`, `teacher-port.ts`, `schedule.ts`, `results.ts`, `errors.ts`, `index.ts`) and the empty test folders; extend `package.json` `lint`, `format` and `format:check` with `src/data` and add a small test that fails when a folder under `src` or `app` is outside the lint and format scope; add the script `test:database:directory`; add `database-directory` to `scripts/verification/run-local-verification.ts` after the identity stage, add every new database test file to `scripts/db/shuffled-tests.ts`, and extend `scripts/verification/ci-config.test.ts`. Traces: NFR2.10, NFR2.16, NFR3.9.
- [x] **Step 2: Verify the test runners and record the unit-scoped commands.** Confirm the Node test runner, Vitest, the real-stack database tests and Playwright run for new files; record the exact commands in `unit-test-instructions.md`. Traces: NFR2.16.

### Part A: Directory and Settings (database)

- [x] **Step 3: Directory and Settings schema (data model).** Migration `20261024_directory_schema.sql`: tables `organizations`, `school_years`, `groups`, `families`, `group_memberships`, `parents`, `parent_contacts`, `children`, `organization_settings`, `reminder_settings` with the columns, constraints, unique and partial unique indexes of `entities.md` (one account per parent, one active membership per family and group, name uniqueness) and the indexes NFR3.6 lists; typed ids across blocks (no foreign keys); row-level security on every table with the policies of BR30.1, BR30.5 (own, co-parent, admin in reach), BR30.8 and BR30.9; the group-reach helper (family reached through an active membership in a group where the actor holds a group admin grant; assignment through its task's group) written once and reused; no table rights for the service-role key. Traces: FR3.4, BR30.1, BR30.5, BR30.8, BR30.9, NFR1.25, NFR1.26, NFR3.6.
- [x] **Step 4: Directory and Settings schema tests.** `tests/database/directory-schema.test.ts`: constraints and indexes, the unique account link, the role matrix over the new tables including the co-parent and every other role, the cross-organization isolation test, the privilege list for `service_role` (10 to 15 tests); default and worker schema. Fix until green. Traces: NFR1.25, NFR1.26, NFR1.31.
- [x] **Step 5: Directory and Settings functions (repository layer).** Migration `20261025_directory_functions.sql`: `directory_save` (family with parents, contacts, children and memberships, in one call), `structure_save` (school year and group), `directory_archive_item` and `directory_restore_item` (group, school year, child), `settings_get`, `settings_save`, each security definer with `SET search_path FROM CURRENT`, no execute for anon, caller and reach checks, version checks returning the stored result codes (`VERSION_CONFLICT`, `SETTINGS_STALE`, `SETTINGS_RECIPIENT_INVALID`), idempotency through U1's record function, consent handling for the optional profile. Traces: BR30.1 to BR30.4, BR30.6, BR30.9, BR30.10, BR32.8.
- [x] **Step 6: Directory and Settings function tests.** `tests/database/directory-functions.test.ts` (reach, validation limits, stale versions, consent, membership reach over the target group, duplicate membership, settings codes, repeated idempotency key) (10 to 15 tests). Run and fix. Traces: BR30.2, NFR6.11, NFR6.12.

### Part B: Coordination (database)

- [x] **Step 7: Coordination schema (data model).** Migration `20261026_coordination_schema.sql`: tables `events`, `tasks`, `assignments`, `change_requests`, `contribution_notes` per `entities.md` (event notes, task end and location, change request task ids and assignment versions), the unique constraint for one non-removed assignment per family and task, one open request per assignment, the capacity check support index, policies for admins in reach and parents of the assignment's family, allergen and note visibility (BR31.8, BR31.9), indexes of NFR3.6. Traces: BR31.1, BR31.8, BR31.9, NFR3.6.
- [x] **Step 8: Coordination schema tests.** `tests/database/coordination-schema.test.ts` (constraints, unique rules, role matrix per table, note and allergen visibility, cross-organization isolation) (10 to 15 tests). Traces: NFR1.26, NFR1.29, NFR1.31.
- [x] **Step 9: Event, task and note functions.** Migration `20261027_coordination_functions.sql`: `event_save`, `event_save_notes`, `task_save` (capacity not below taken places, group equals the event's group, cancelled event closes tasks, task cancellation), `contribution_save`; stale versions return `VERSION_CONFLICT`. Traces: BR31.1, BR31.8.
- [x] **Step 10: Event, task and note function tests.** `tests/database/coordination-functions.test.ts` (10 to 15 tests). Traces: BR31.1, BR31.8, NFR6.12.

### Part C: Kernel use cases (database)

- [x] **Step 11: Sign-up and listing use cases.** Migration `20261028_kernel_signup.sql`: `duty_list`, `duty_get` (states available, full, ineligible, assigned, swap-pending, cancellation-pending, allergen note rule, own note), `duty_sign_up` (task row lock, the fixed check order of BR31.2 with `DUTY_VERSION_STALE`, `DUTY_CLOSED`, `DUTY_ALREADY_ASSIGNED`, `DUTY_INELIGIBLE`, `DUTY_FULL`), `assignment_assign` and `assignment_remove` (admin, no override, `ASSIGNMENT_INELIGIBLE`, `ASSIGNMENT_CAPACITY_FULL`), each in the elevated-function catalogue. Traces: BR31.2, BR31.3, BR31.7, BR31.11, BR32.6.
- [x] **Step 12: Sign-up and listing tests.** `tests/database/kernel-signup.test.ts`: every check and code in order, state mapping per state, admin assign and remove, plus `tests/database/kernel-race.test.ts` with 20 parallel sign-ups for 5 places (exactly 5 places, no family twice) and the double click case (10 to 15 tests). Traces: NFR3.7, BR31.3.
- [x] **Step 13: Swap and cancellation use cases.** Migration `20261029_kernel_swaps.sql`: `swap_candidates`, `swap_request`, `swap_respond`, `swap_incoming`, `swap_withdraw`, `cancellation_request`, `swap_decide`, `cancellation_decide` (stored task ids and versions compared at confirmation and approval, tasks locked in ascending id order, other open requests on an exchanged assignment withdrawn, `approval.approve` and `approval.reject` audit events through U1's audit function in the same transaction, codes `REQUEST_VERSION_STALE`, `REQUEST_DUPLICATE`, `REQUEST_CONFLICT`, `SWAP_CANNOT_BE_APPLIED`, `SWAP_REQUEST_NOT_OPEN`, `APPROVAL_ALREADY_DECIDED`, `APPROVAL_INVALIDATED`). Traces: BR31.4, BR31.5, BR31.6.
- [x] **Step 14: Swap and cancellation tests.** `tests/database/kernel-swaps.test.ts` (partner list shows only task title, date and family name; each actor and each stale case; both confirm exchange; decline; admin decision; withdraw; same-task and duplicate-place refusals; audit events; no deadlock for crossing swaps and archive-versus-swap) (10 to 15 tests). Traces: NFR1.33, NFR3.8.
- [x] **Step 15: Family archive, restore, invitation link and dashboard use cases.** Migration `20261030_kernel_family.sql`: `family_archive` (cascade of BR30.7, tasks locked in id order), `family_restore` (`RESTORE_CONFLICT`), `invitation_accept_parent` (links the parent in the same transaction as the account and grant, checks target and family scope, releases the reservation on refusal; the invitation creation function gains the target check), `dashboard_get` (open approvals and an import-conflict count function returning zero until U4), `governance_revoke` (U2's functions plus the self-lockout check). Traces: BR30.3, BR30.7, BR32.3, BR32.5, BR32.10.
- [x] **Step 16: Family and invitation tests.** `tests/database/kernel-family.test.ts` and `tests/database/directory-link.test.ts` (archive cascade and withdrawn requests, restore, link race with two connections, refused acceptance leaves the invitation pending, dashboard counts, governance self-lockout) (10 to 15 tests each). Traces: NFR3.11, NFR6.10.
- [x] **Step 17: Teacher schedule function.** Migration `20261031_schedule.sql`: `schedule_get` with the filter rule repeated, the field sources of `entities.md`, no contacts, notes or ids, group grant check. Traces: BR33.1 to BR33.3.
- [x] **Step 18: Schedule tests.** `tests/database/schedule.test.ts` (grant per role, filter, empty state, field shape, privacy) (10 to 15 tests). Traces: NFR1.30.
- [x] **Step 19: Lifecycle functions.** Migration `20261032_lifecycle.sql`: `lifecycle_list` and `lifecycle_run` (eligible-delete and eligible-anonymize, grace period and hold blockers, confirmation and stale codes, deletion and anonymization of every table listed in BR35.2, deactivation of parent accounts through U2's function, `lifecycle.delete` or `lifecycle.anonymize` audit event). Traces: BR35.1, BR35.2.
- [x] **Step 20: Lifecycle tests.** `tests/database/lifecycle.test.ts` (each state and code, completeness search of every U3 table for the original values, accounts deactivated, audit event, the rule that removed assignments leave only through the lifecycle) (10 to 15 tests). Traces: NFR1.36, NFR3.10.
- [x] **Step 21: Rewrite of U2's functions and placeholder tables.** Migration `20261033_identity_group_reach.sql`: `create or replace` versions of the U2 functions that read `app_families` and `app_assignments` (invitation creation and its stale-reservation replacement, the session and scope helpers, the access-change functions) using the group reach defined in `entities.md`; move the access tests onto the new tables; migration `20261034_placeholder_drop.sql` (sorts last) with the catalogue check that drops `app_families` and `app_assignments` only when nothing still names them. Traces: NFR1.32, NFR6.14.
- [x] **Step 22: Rewrite and catalogue tests.** Run U2's whole identity suite (`npm run test:database:identity`) against the rewritten functions and fix until green; `tests/database/placeholder-drop.test.ts` (drop happens when unused, is skipped with a deliberate user and names it); extend `identity-catalogue.test.ts` and the service-role privilege test with every U3 function and table (10 to 15 tests). Traces: NFR1.27, NFR1.28, NFR1.32, NFR6.14.
- [x] **Step 23: Migration repeatability and timing tests.** Extend `tests/database/migrations.test.ts` to U3's files in the default and a worker schema; add the 150-family data set generator (`tests/database/dataset.ts`) and `tests/database/directory-timing.test.ts` (list, detail, schedule, action, dashboard timings; reported targets and the 1500 ms ceilings; the U2 access-check timing re-run) (10 tests). Traces: NFR3.5, NFR4.6 to NFR4.9, NFR6.9.

### Part D: Adapters and application layer

- [x] **Step 24: Database adapters behind the ports (repository and business layer).** In `src/data/`: the parent, admin and teacher port implementations that call the functions through U1's database client wrapper and return the existing result states and codes (BR32.8), map unexpected errors once to retryable or terminal failures (BR32.4), derive the family from the session's account (BR32.2) with no constants, and expose the exported list of use cases that U4 must connect to notifications (BR31.10). Extend the ports in `src/application/` with `respondToSwap`, `withdrawRequest`, `listSwapRequests`, the counterpart version on `requestSwap`, and the admin payload fields. Traces: BR32.1, BR32.2, BR32.4, BR32.8, BR31.10.
- [x] **Step 25: Adapter tests.** `src/data/*.test.ts` with fakes for the database client (result mapping, error mapping, family from account, no constants, hand-off list) and `tests/database/data-adapters.test.ts` against the real stack (every port operation, every code in the table of BR32.8 in a code-by-code contract test) (10 to 15 tests per component). Traces: NFR2.17, NFR6.13.
- [x] **Step 26: Production composition and session wiring.** Replace the "unlinked" production slot: `src/runtime/production/composition.ts` builds the three facades from the adapters and U2's session; `app/szulo/_lib/*`, `app/admin/_lib/*` and the teacher equivalents use the production facade in production mode and keep the synthetic one in synthetic mode (until U5); the parent and admin session helpers read the real session and the family or reach from the database. Update the parent matrix and role policy in `src/access/` with the respond and withdraw actions. Traces: FR4.1, FR2.8, BR32.2, BR32.7.
- [x] **Step 27: Composition and wiring tests.** `tests/integration/production-wiring.test.ts` and `src/access` tests (production mode builds the facades, synthetic mode unchanged, access matrix and role policy for the new actions, no constants in the production path) (10 to 15 tests). Traces: BR32.2, BR32.7.

### Part E: Screens

- [x] **Step 28: Screen changes (frontend).** Parent swap page with the partner list and counterpart version; new `app/szulo/cserek/page.tsx` (incoming requests with Confirm and Decline, own requests with Withdraw) with its actions; parent navigation link; admin record, assign and notes forms with the new fields and the family selector; Hungarian messages for `DUTY_CLOSED`, `DUTY_ALREADY_ASSIGNED`, `SWAP_CANNOT_BE_APPLIED`, `SWAP_REQUEST_NOT_OPEN`, `ASSIGNMENT_INELIGIBLE`, `ASSIGNMENT_CAPACITY_FULL`; data-testid attributes on all new controls; the parent notification adapter returns the empty state for real accounts until U4. Traces: BR32.7, BR32.9, NFR5.4, NFR5.5, NFR7.3.
- [x] **Step 29: Screen tests.** `tests/integration/swap-screens.test.tsx`, `admin-forms.test.tsx`, `copy.test.ts` (component tests of the new states, messages and labels) (10 to 15 tests per component); existing component tests for other pages stay unchanged and green. Traces: NFR5.5, NFR7.3.
- [x] **Step 30: Browser and accessibility tests.** `tests/browser/directory-coordination.spec.ts` against a production build on the real stack: two parents signed in at once sign up for the last place and see each other's sign-up, a swap requested, confirmed by the other family and applied, a cancellation approved by the admin, an invited new parent links and sees their family's tasks, a teacher sees only granted groups, the extended admin forms, the notification page for a real parent, each with the automated accessibility scan; one reported timing of the parent task list page. Traces: FR5.1 to FR5.5, FR6.1, NFR3.7, NFR4.6, NFR5.4, NFR6.15.

### Part F: Clean-up, configuration and documentation

- [x] **Step 31: Remove the replaced modules.** Delete `src/directory`, `src/coordination`, `src/parent-experience` and `src/privacy-audit` with their tests only when every ledger row of the module has a passing proof from Parts A to D (search test that nothing imports them); the four running adapters and `src/teacher-tracking` stay for U5 (see the deviation above); the search test that the old constants (fixed family id, parent id, local parent login) are gone from the production path. Traces: BR34.1, NFR2.17, ledger D1 to D22, D30, D31.
- [x] **Step 32: Environment, build and CI configuration.** `.env.example` unchanged (no new setting); verify `.github/workflows/ci.yml` runs the new stage within its timeout; run the full verification chain (type check, lint, format check, all tests, coverage at or above 80% on all production source, production build, start smoke, browser tests, bundle scan, dependency audit). Traces: NFR2.16, NFR2.17.
- [x] **Step 33: Documentation and traceability.** Write `code-summary.md` (what was built, the deviation note, the correction notes, test counts from the current run, the list of use cases U4 connects to notifications, outstanding evidence), `source-manifest.json`, and `traceability.json` mapping every functional requirement and rule to its steps and tests. Traces: all FR and BR ids of the unit.
