# Code Generation Plan: u14-removal-and-anonymisation

## Summary

- Builds: removing a parent or a family across every kind of record (one transaction, preview before, flagged items after), the new duties step, "korábbi tag" and "korábbi család" in history, emptying the removed person's own texts, the new delete-or-anonymise decision, and the confirmation, result and restore screens
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/application`, `src/access`, `app/admin` (parent and family removal, result, restore, data lifecycle), the seed, `verification`, `contract-summary.md`, and existing removal tests that expect the old behaviour
- Tests: six new database test files with the fixed list (commands, duties and names, emptied texts, races, delete or anonymise, reads and timing), changed adapter, facade and screen tests, catalogue tests, and a new removal browser specification

## Ground Rules

- Where the design files disagree, the "Which Text Wins" table in `nfr-design/logical-components.md` decides, then the "Notes for the Code Plan" in `infrastructure-design/infrastructure-specification.md`.
- Order inside each command: active session, idempotency key, super admin of the subject's community, subject lookup, `SELF_REMOVAL`, `last_super_admin` (defensive), and only then locks: the family row, then the family's tasks (`reminder_lock_family_tasks`). Place locks stay where `family_archive_core` takes them today, after the version check. No new wrapper-level lock is added.
- A refused caller takes no lock.
- Each replaced database function starts from its latest definition in `supabase/migrations` and is compared with it before the step is ticked. The tests of the units that own it pass unchanged, except the ones step 4 lists.
- New database functions start with `revoke all`, pin their search path, and get an explicit `grant execute` only if they are a command or a read. Commands take an idempotency key, return the C1 envelope and refuse through `U3R00`. New functions extend `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` in the same step.
- Each new database test file is added to `test:database:directory` in `package.json` and to `scripts/db/shuffled-tests.ts`; step 14 searches both for every file name.
- The migration is `supabase/migrations/20261073_removal_and_anonymisation.sql` (the next free number is used if another lands first). Steps 3 and 5 add to this one file.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80, and the preview, the removal, the result page and the later run each take under 2 seconds on the busiest family of `db:seed:large`. No target is lowered to pass.
- The new or changed screens follow Stitch designs the owner approves first (`team.md`): step 12 does not start before that. New classes use the `admin-` prefix, tokens stay in the `--name: #rrggbb` form, and interactive elements carry `data-testid`.
- All data is invented; every test address is on `scripts/verification/privacy-allowlist.json`.
- Open review points are settled as follows; the owner can change any at plan approval.
  - A failed session end keeps today's behaviour: three tries, then a warning on the result page. The database already refuses the account. Step 10 checks what the existing sign-in reconcile job does for a removed account and records in `code-summary.md` how long such a sign-in can live; a test shows that the removal stays committed.
  - Race tests also cover a loan, a checklist claim and a to-do claim made during a removal.
  - A lock give-up (error 40001) shows "nothing changed"; the retry works, and a test resubmits the same key.
  - Timing tests use the fixed large seed and measure once after one warm-up run.
  - 30 days is the earliest time for delete or anonymise, not a deadline. It stays manual.
  - A parent removed on their own gets "Anonimizált szülő" at once. A removed family's stored names stay until the later run.
  - The data-lifecycle screen's delete or anonymise label uses the same "is anything still pointing at the family" check as the run.

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
| 3 to 4 | AC3.6.2, AC3.6.4, AC3.6.5, AC3.6.7, BR200 to BR205, BR207, NFR1.1 to NFR1.4, NFR3.1, NFR3.4 to NFR3.6, NFR4, NFR5, NFR11.1, NFR11.2, NFR11.5 |
| 5 to 6 | AC3.6.6, BR205.2, BR205.3, BR206, NFR1.5, NFR9, NFR11.3, NFR11.4 |
| 7 to 10 | Application layer for all stories, NFR3.2, NFR3.7 |
| 11 to 13 | All stories on screen |
| 14 to 15 | The Unit's closing evidence, NFR1.6, NFR6 |

### Set-up

- [x] Step 1: Stay on the current branch and working tree. Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: removal

- [x] Step 3: Start `supabase/migrations/20261073_removal_and_anonymisation.sql`, in its own transaction. In this step: the audit actions `lifecycle.parent_removed` and `lifecycle.family_removed`; `duties_removal_preview` and `duties_removal_apply` (frees future manual places with today's reminder planning and notice, keeps and counts rota, weekend and animal-care places); `working_groups_sole_coordinator_groups`; new versions of the events, checklists, recurring-duties and swap steps that also empty the subject's own texts (a required text becomes "—"); the changed `parent_display_name` and `family_display_name`; and new bodies for `parent_remove` and `family_archive`: the checks and locks of the ground rules, the account ids read before any step, the eleven steps in the C16 order, the single parent's name replaced, one audit row with counts, the authorization versions raised, and the account ids and groups left without a coordinator in the stored result. The `DUTY_ROTA_MANAGED` refusal of family archiving goes away.
- [x] Step 4: Write and run `tests/database/removal-commands.test.ts` (fixed list for both commands, self-removal, last super admin, last parent, no lock for a refused caller, returned account ids and the held session refused, audit fields, a failed audit write and a refusing step leaving every table unchanged, restore), `removal-duties.test.ts` (freed and kept places, reminder plan and notice, done marks, every history read showing the former names), `removal-texts.test.ts` (each kind of own text emptied, another person's text and shared texts kept) and `removal-races.test.ts` (two removals; parent against family; removal against swap, sign-up, slot give-up, loan, checklist claim and to-do claim; another family's sign-up not blocked; the same key resubmitted after error 40001). Add the shared setup in `removal-support.ts`. Change the old tests that expect "korábbi tag" for a family, the `DUTY_ROTA_MANAGED` family-archive refusal, or the old archive behaviour, and extend the two catalogue tests. Register the new files.

### Database: reads and delete or anonymise

- [x] Step 5: In the same migration: `removal_preview` (the eleven previews in order, totals, version, groups without a coordinator, the same refusals as the command, no locks, no writes); `removal_flagged_items` (only items flagged by this removal, titles, dates and links, no person's name); `lifecycle_family_still_referenced`; the new `lifecycle_run_core` (today's conditions, the steps again, delete only when nothing points at the family, leaving and new standings deleted either way, audit with counts); and `lifecycle_list` using the same check for its eligibility.
- [x] Step 6: Write and run `tests/database/removal-reads.test.ts` (fixed list for both reads, exact field lists, handled items disappearing, timings of preview, removal, flagged items and later run on the large seed) and `removal-lifecycle.test.ts` (fixed list for the later run, zero counts for finished steps, one case per record kind that forces anonymise, delete followed by a scan of every family and parent column, no invented name left in any table). Change the affected cases of `lifecycle.test.ts`. Register the new files.

### Data access and application layer

- [x] Step 7: Add `src/data/removal.ts` (preview, flagged items, both removal commands with their reports) and extend the lifecycle mapping in `src/data/admin-settings.ts`; family archiving in `src/data/admin-records.ts` and parent removal in `src/data/directory.ts` return the report. Validate subject kind, ids and versions.
- [x] Step 8: Write and run `src/data/removal.test.ts` (5 to 8 tests) and update the changed adapter tests.
- [x] Step 9: Add the models, the facade (`src/application/removal-facade.ts`) and the Hungarian texts, including `SELF_REMOVAL`, `last_super_admin` and the new report fields; add the access rows in `src/access/role-policy.ts` and `src/application/authorization.ts`; add the rows in `verification/authorization-matrix.json`. Write and run `src/application/removal-facade.test.ts` and the changed policy tests.
- [x] Step 10: Server actions: parent and family removal end every returned account's sign-in with today's retrying helper, show the warning if one fails, log only the code and account id, and lead to the result page; an unexpected error says nothing changed. Write and run the action tests, including a failed session end.

### Screens

- [x] Step 11: Make the Stitch designs for the four screens in `functional-spec.md` (parent confirmation, family confirmation, removal result, restore confirmation) at desktop and phone width, with invented names, and get the owner's approval.
- [x] Step 12: Build the screens: the per-kind counts, coordinator warning and refusals on the parent confirmation; the new family confirmation page that replaces the one-click archive on the family record; the result page with flagged items and groups (also reachable from the archived family); and the restore page's list of what does not come back. Hungarian text, phone width, keyboard use, results announced through the existing status region.
- [x] Step 13: Write and run the screen tests and `tests/browser/removal.spec.ts` (preview, remove a family, see the result, restore; remove a parent) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome, plus `removal-timing.spec.ts` and `removal-screenshots.spec.ts`. Update browser specs that use today's archive button.

### Closing evidence

- [x] Step 14: Extend the large seed so its busiest family has records of every kind. Update `contract-summary.md` with the C6 and C16 changes. Check that every new database test file is listed in `package.json` and `scripts/db/shuffled-tests.ts`.
- [x] Step 15: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record counts, coverage and timings in `code-summary.md`; write `traceability.json` and `source-manifest.json`; send the owner screenshots after checking none shows an error page.
