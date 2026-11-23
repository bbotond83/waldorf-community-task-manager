# Code Generation Plan: u9-recurring-duties

## Summary

- Builds: recurring duties: schedules owned by a group, a family or the family on a rota week; occurrences created 14 days ahead; done marks with a 24-hour undo; skipping with a reason; bottle cleaning that follows the water week; the starting list; due and overdue notices; plus the functions later units call (reads for U12, duty-card line for U2, removal block C16)
- Touches: one new migration in `supabase/migrations`, a new recurring module in `src/data`, `src/application`, `src/access` and `app/` (group page section, form, family page, duty-card line, school calendar number), `scripts/db/seed`, `verification`, `contract-summary.md` and the catalogue tests
- Tests: six new database test files with the fixed list (core and reads, schedule commands, done and skip with races, daily check and notices, functions for later units, timing), changed catalogue, adapter, facade and access tests, and a new recurring browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order decided in `nfr-design/scalability-design.md` (D-SCAL-1) and the "Settled for Code Generation" table of `infrastructure-design/infrastructure-specification.md`: family, rota week, then the schedule row, then occurrence rows ascending. The schedule and occurrence steps are added at the end of C1. No command locks an occurrence before its schedule. The earlier wording of BR141.2 and the functional spec ("schedule row first") is read as "after any family or rota-week lock the command needs".
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80; group page, family page, duty card, save and mark done finish under 2 seconds; the daily check finishes under 5 seconds (second run under 2) with every schedule due, notices created and email mocked, on the `db:seed:large` set (median of 5 runs); no target is lowered to pass.
- New screens follow the Stitch designs the owner approves first (`team.md`); the owner compares the built screens by screenshot. New classes use the `recurring-` prefix (kebab-case); existing browser specs keep their class names or change in the same step.
- All data is invented; every test address or phone number is added to `scripts/verification/privacy-allowlist.json`.
- Function names follow `functional-spec.md`. Reads return the result envelope with the data, and a denied reader gets the denied refusal, never an empty list.
- Decisions carried from the design stages and their reviews, built in as follows. The owner can change any of them at plan approval.
  - **Occurrences are their own records.** Done marks live on the occurrence (ADR-003); no duty or place row is created. C18's `place_mark_done` is not used.
  - **Notice window (D-REL-1).** With `days_past` = today minus due date (Budapest): the due notice goes out for an open occurrence on days 0 to 2 if none was sent; from day 3 only the overdue notice goes out if none was sent, and the due notice is never sent late any more. A family never receives both in one run. Once keys are built from schedule, due date and kind.
  - **Removed parent (D-REL-3).** Occurrences carry `done_by_removed` and `skipped_by_removed` flags. The state constraints allow no person only when the matching flag is true; the removal apply clears the person and sets the flag in one update; screens show "korábbi tag".
  - **Super admin (D-SEC-1).** A super admin who is none of the owner people can read, undo and skip but not mark done. The authorization matrix and tests carry that row.
  - **Lock list per command.** Save and switch on or off: family or rota week if the owner needs it, then the schedule row, then occurrence rows ascending. Mark done, undo and skip: read the occurrence without a lock to find its schedule and owner, lock family and rota week if needed, then the schedule row, then the occurrence row, then re-check. The owner of a schedule never changes, so the unlocked read cannot go stale. For a rota-week occurrence the holder is read with `rota_family_for`, the family is locked, then the rota week, then `rota_family_for` is read again; a changed holder is refused with VERSION_CONFLICT.
  - **Rota-week numbering.** Water weeks are numbered from the first published water week on or after the schedule's start date (BR143.2) of the plan of its school year; the count restarts with the next year's plan (owner-confirmed 2026-11-22). The daily check also recalculates future unnoticed occurrences of a rota-week schedule against the currently published weeks, as a save does (BR144.1), so a republish that adds or removes a water week is picked up on the next run; occurrences with a notice, a done mark or a skip stay.
  - **Failing schedule in the daily check.** Each schedule runs in its own sub-transaction. A failure is recorded in U5's run record with the schedule id (the record's detail field is extended if it cannot hold one, in this migration), and the other schedules continue.
  - **Daily check scope.** Removed or anonymised families and archived groups create nothing more (BR143.4). A group with no coordinator notifies its members (BR151.2). `notice_send` is called after the schedule's locks are released, with the notice facts already read, so no family lock can be taken after a schedule row.
  - **Execute right.** `recurring_due_check` is granted only to U5's service-role entry point; no signed-in role can run it.
  - **Audit actions** are named: `recurring_schedule_saved`, `recurring_schedule_set_active`, `recurring_occurrence_done`, `recurring_occurrence_undone`, `recurring_occurrence_skipped` and `recurring_removal_applied`. They hold actor and opaque ids only, never a title, name or reason.
  - **Removal functions** are named `recurring_duties_removal_preview` and `recurring_duties_removal_apply`, as the functional spec says.
  - **Row-count test.** The migration adds registry rows and audit action values. The "no existing row changes" test compares the rows of the existing business tables and lists them by name; registry and audit-action additions are asserted separately.
  - **Contract deltas** (C1 two added steps, C8, C9, C14, C16, C18 not used, and the BR141.2 and BR149.1 readings above) are written into `contract-summary.md` in this Unit so U14 and later units see them.
  - **Race tests** repeat each two-at-once case 20 times inside the test file, because the shuffled run shuffles files once and does not repeat them.
  - **New internal functions** go into the elevated-function list and policy-test list of `tests/database/identity-catalogue.test.ts`, and `src/data/notification-use-cases.test.ts` is extended for the notice kinds and target.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n- **Methodology evidence**: Unchanged. Tests sit next to the code or in `tests/` in the same pull request, and each fix commit carries its regression test. Recent merges show this for screens (#2, #3, #6) and for the database (#45 added its migration and its test file together). No history shows tests written ahead of the code as a rule.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source (Vitest with the Istanbul provider, thresholds 80/80/80 in `vitest.config.ts`). That figure counts application code, meaning TypeScript and JavaScript under `app/`, `src/` and `scripts/`; it does not see SQL.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. All of these run through `npm run verify:local`, which the `Validate` job runs on every pull request in Chromium, Firefox and mobile Chrome. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.\n\nOur database rules are tested on the real local database stack in `tests/database/`, with the tests acting as the real database roles and signed-in accounts. Each new test file must be added by hand to its `test:database:*` script and to the shuffled run; a file listed in neither never runs.\n\nBecause the coverage figure cannot see the database, every database rule gets a fixed list of must-have tests: allowed; refused; out of reach; outdated screen; repeated click; and two people acting at once.\n\nThe one-off spreadsheet migration script lives in the repository. Its automatic checks use only an invented workbook in `tests/fixtures/fictitious/`. The owner additionally does trial runs against the anonymised workbook, on the owner's computer only, to prove the script reads the real layout. The anonymised workbook stays outside the repository and is not used for anything until the anonymiser has been fixed and re-run and the owner has checked the result.\n\nThe existing gates react to styling: browser specs assert computed styles, element sizes, layout at several widths and class hooks, and `tests/unit/design-tokens.test.ts` reads colour tokens only in the form `--name: #rrggbb` inside `:root` of `app/globals.css`. Changed screens keep those class names, measurements and token format, or the matching tests change in the same pull request. New screens follow `DESIGN.md`.\n\nWe design new screens in Stitch before building them. We check how new or restyled screens look by owner review: the owner compares each built screen with its Stitch design using screenshots provided by the assistant. We do not add automatic picture-comparison tests.\n\nStylelint checks `app/globals.css` as a blocking step of `npm run verify:local`. `react`, `react-dom`, `zod`, `@axe-core/playwright`, `@playwright/test`, `stylelint` and `stylelint-config-standard` stay on exact versions, guarded by `tests/unit/dependency-pins.test.ts`. CI installs from `package-lock.json`, so the development tools still marked `latest` change only when the lockfile is refreshed."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06) \n- ALWAYS stop leftover app servers (pkill -f next-server) before a full npm run verify:local, because a leftover server on port 3100 can block the browser runs. (learned 2026-11-14) \n\n- ALWAYS add every phone number or e-mail address used in a test to scripts/verification/privacy-allowlist.json, or the privacy scan fails the verification run. (learned 2026-11-14) \n\n- ALWAYS check owner-review screenshots for error pages before sending them, because a wrong address in the screenshot script silently shows an error screen instead of the intended screen. (learned 2026-11-14) \n\n- ALWAYS extend tests/database/identity-catalogue.test.ts (elevated-function list, policy-test list, scope-probe decisions) and src/data/notification-use-cases.test.ts when a new database function or table is added, or they fail on the new objects. (learned 2026-11-17)"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
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
  "input_sha256": "sha256:7e57f43a84dafdf2f881bad3d2e69af7d331a70373be3005b521dbe35ed51924",
  "contract_sha256": "sha256:5d63c64b08ccc084f9928899775ef98244d8bddec8541e8f8aa3fbb85933a4f8"
}
```

## Steps

| Step | Stories and requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | US9.1 (AC9.1.1 to AC9.1.3), the reads, BR141, BR142, BR150, NFR1, NFR3.5, NFR7.3, NFR7.9, NFR9.4 |
| 5 to 6 | US9.1 commands, BR141 to BR144, BR147.1, NFR3.2, NFR4.1, NFR5.1, NFR5.4 |
| 7 to 8 | US9.2 (AC9.2.1, AC9.2.2), BR145, BR146, NFR3.3, NFR3.4, NFR3.8, NFR3.9, NFR5.2, NFR5.3, NFR5.7 |
| 9 to 10 | US9.3, US17.1 (AC17.1.1, AC17.1.6), BR143, BR147, BR149, NFR5.5, NFR5.6, NFR7.4 to NFR7.7, NFR10.1 |
| 11 to 12 | BR150.2, BR151, NFR6.4, NFR11, NFR3.6, NFR3.7 |
| 13 | US9.4 (AC9.4.1 to AC9.4.3), BR148, NFR3.10, NFR6.3, NFR9.1 to NFR9.3, NFR9.5 |
| 14 to 16 | All four stories on screen, NFR4.8, NFR4.9, NFR8 |
| 17 to 18 | The Unit's closing evidence |

### Set-up

- [x] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: tables, notices and reads

- [x] Step 3: Start one migration, `supabase/migrations/20261064_recurring_duties.sql`, that opens and commits its own transaction; steps 5, 7, 9 and 11 add to this same file. In this step: the tables `recurring_schedules` and `recurring_occurrences` with their row checks (exactly one owner of the right kind, group, family or rota job; a season with both months or none and from not after to; interval 1 to 52; `rota_weeks` only on a rota-week owner; one occurrence per schedule and due date; done with person and time, or `done_by_removed` with time; open with neither; skipped with a reason and the skip person or `skipped_by_removed`; title up to 200, category up to 100, reason up to 200 characters), the unique key, the index on due date for open rows and the index on owner, no right for a signed-in account on either; the notice kinds `recurring_due` and `recurring_overdue`, the target type `recurring_duty` with `recurring_notice_facts`, the registry row for `recurring_due_check` (run kind `daily`, a `lock_step` after the existing checks, execute right for U5's service-role entry point only), and the audit action values of the ground rules, all added without touching existing rows; the reads `recurring_list_for_group`, `recurring_occurrence_get`, `recurring_my_occurrences`, `recurring_bottle_for_duty` and `recurring_list(group_id)` with reach per BR150, returning display names only. Every function starts with `revoke all` and an explicit `grant execute` or none, pins its search path and returns the C1 envelope.
- [x] Step 4: Write and run `tests/database/recurring-core.test.ts`: the row checks attacked as the database owner (NFR7.3), including both removed-flag sides (D-REL-3), the exact fields each read returns and that no signed-in role can read the tables (NFR1.2), the 60-day overdue cut and the 14-day lead in the reads, korábbi tag, teacher and signed-out reach, denied (not empty) for a refused reader, an empty list only after a successful read, and the migration applied over a seeded database with the existing business tables' row counts unchanged and the registry and audit additions asserted separately (NFR7.9). Add the file to its `test:database:*` script and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`.

### Database: schedule commands

- [x] Step 5: In the same migration: `recurring_schedule_save` and `recurring_schedule_set_active` (BR141, BR142, BR144, BR147.1; coordinator of the group and super admin for groups, super admin only for family and rota-week schedules; the owner is never changed on an existing schedule; version check; idempotency key; saving removes later open occurrences with no notice and creates today's, in one transaction; switching off skips later open occurrences with the fixed reason "kikapcsolva"; the lock list of the ground rules; one audit entry each, in the same transaction).
- [x] Step 6: Write and run `tests/database/recurring-commands.test.ts` with the fixed list for the two commands: allowed; refused for a parent, a teacher, a coordinator of another group and a coordinator on a family or rota-week schedule (also by direct call); out of reach; outdated screen (VERSION_CONFLICT); repeated click (rows counted); two coordinators saving at once; validation refusals (season, interval, lengths, owner change); the audit entry and its rollback with a temporary failing trigger inside the test; atomic save and atomic switch-off with a forced failure midway (NFR7.1, NFR7.2); timing of save on the large seed (NFR9.2). Add the file to the scripts.

### Database: done, undo and skip

- [x] Step 7: In the same migration: `recurring_occurrence_mark_done`, `recurring_occurrence_undo_done` and `recurring_occurrence_skip` (BR145, BR146; reach per owner kind with the rota-week holder read live and re-read after the lock; the same denied refusal for a real and a made-up id; one done mark naming one person and time; undo by the marker, a coordinator or a super admin within 24 hours in Budapest time; skip with a reason by a manager or super admin, final; super admin cannot mark done; RECURRING_CLOSED, RECURRING_UNDO_TOO_LATE and VERSION_CONFLICT codes; idempotency key; one audit entry each).
- [x] Step 8: Write and run `tests/database/recurring-occurrences.test.ts` with the fixed list for the three commands: allowed for each owner kind; refused for a parent of another family, a person outside the group, a teacher, and a super admin on mark done (same refusal for real and made-up ids); undo on both sides of the 24-hour mark; right lost between two requests (revoked grant, left group, removed parent, swapped week) refused on the next command (NFR3.8, NFR3.9); outdated screen; repeated click (audit rows counted); two at once (two mark-dones; mark done against undo and against skip in both orders; a swap against mark done in both orders), each repeated 20 times with no deadlock; the super-admin read, undo and skip rows for group, family and rota-week occurrences (NFR3.5, D-SEC-1); timing of mark done on the large seed. Add the file to the scripts.

### Database: daily check, notices and bottle cleaning

- [x] Step 9: In the same migration: `recurring_due_check` (takes the moment of the run; for each active schedule in its own sub-transaction, in ascending id order: creates occurrences up to 14 days ahead by the start date and interval only, inside the season, with rota-week schedules counting published water-carrying weeks from the first on or after the start date, and recalculates a rota-week schedule's future unnoticed occurrences against the published weeks; sends the due notice on days 0 to 2 and the overdue notice from day 3 as the notice window says, once each through `notice_send` after the schedule's locks are released; recipients are the group's coordinators, or its members when it has none, or the parents of the owning family; skips removed or anonymised families and archived groups; internal, never granted to a signed-in role) and `recurring_notice_facts` (title and due date only, works for the service role).
- [x] Step 10: Write and run `tests/database/recurring-check.test.ts`: the notice-window table (runs on days 0, 1, 2 with no earlier run; day 3 and day 4 after a due notice; first run only on day 2; first run only on day 3 giving one overdue and no due; save after the day's run; twice on one day) asserted by the notices created; the moments just before and after each boundary in both clock-change weeks (NFR7.6); a republish that adds or removes a water week and a run across the school-year boundary (NFR7.7); two runs at once and the check against a switch-off creating each occurrence and notice once (NFR5.5, NFR5.6); a failing schedule recorded with its id while other schedules and other checks still run, and a failed email leaving the check intact (NFR7.5); notice texts and recipients read from the local test mailbox with no other family, no person who marked it and no contact detail (NFR10.1); timing on the large seed with every schedule due and email mocked (NFR9.3); the bottle-cleaning follow-the-week cases (a swap, a cancellation and a reassignment of the water week). Add the file to the scripts.

### Database: functions for later units

- [x] Step 11: In the same migration: `recurring_duties_removal_preview` and `recurring_duties_removal_apply` (C16: for a removed parent clear the done and skip person and set the removed flag in one update, keep the rows; for a removed family flag its schedules and write nothing else; return the same counts in preview and apply; zero counts for a subject kind it does not hold; locks family, then schedules ascending, then occurrences ascending; service role and database owner only).
- [x] Step 12: Write and run `tests/database/recurring-for-later-units.test.ts`: `recurring_list`, `recurring_my_occurrences` and `recurring_bottle_for_duty` called as the role each is granted to; the removal pair for a parent, for a family and for a subject that holds nothing, rows kept and counts equal (NFR11.1); a swap writing no row of this unit and the existing swap and rota tests unchanged (NFR11.2); the catalogue grants of every internal function (NFR3.6, NFR3.7). Extend `tests/database/identity-catalogue.test.ts` (elevated-function list, policy-test list, scope-probe decisions) and `src/data/notification-use-cases.test.ts` for the new functions, tables, notice kinds and target, and check the existing timed-run tests pass with the new registry row. Add the file to the scripts.

### Seed, authorization and contracts

- [x] Step 13: Add the starting list to the seed script (`scripts/db/seed/write.ts`) with invented Hungarian titles (the bottle-cleaning schedule every 4th water week; six animal-care items with three rabbit items off; playground and maintenance rounds every 4 weeks; mowing, weeding and compost with seasons), a school year of schedules and occurrences on the large seed, and the changed seed-count tests in the same step; add the recurring rows to `verification/authorization-matrix.json` for every role including the super-admin rows (NFR3.10), the privacy allowlist entries, and the contract deltas of the ground rules in `contract-summary.md`.

### Application layer and screens

- [x] Step 14: Add the recurring module in `src/data` (port and adapter), `src/application` (contracts, facade, message mapping with the Hungarian refusal text for every code) and `src/access` (`role-policy.ts`, `authorization.ts`, navigation), with the Server Actions under a new `app/_recurring` module beside the library module; write and run the Vitest and Node tests for the adapter, facade, mapping, policy and seed, including a test that counts the data calls of each page (NFR9.4).
- [x] Step 15: Build the screens after the owner approves their Stitch designs: the group recurring duties at `/szulo/munkacsoportok/[id]/ismetlodo` with coordinator controls, the form at `/szulo/ismetlodo/uj` and `/szulo/ismetlodo/[id]/szerkesztes`, my recurring duties at `/szulo/ismetlodo`, the bottle-cleaning line with Kész on the duty card at `/szulo/beosztas/[id]` and the interval number on the school calendar admin page. Use the `recurring-` classes, add `data-testid` to interactive elements, show the states "lejárt", "kihagyva" and "Kész" in words as well as colour, show the error and denied states and the empty text only after a successful read (NFR4.9), keep Kész, Mégsem and Kihagyom native buttons, and keep all text Hungarian; the teacher sees the list without buttons.
- [x] Step 16: Write and run the screen, action and access tests and a browser specification for the critical recurring flow (coordinator adds a schedule, member marks done, undo, a coordinator skips with a reason, the bottle-cleaning line on the duty card) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome.

### Closing evidence

- [x] Step 17: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and the timing results against the targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page; list the functions that no screen calls yet (daily check, removal pair, `recurring_list`, `recurring_my_occurrences`) as tested directly.
- [x] Step 18: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.
