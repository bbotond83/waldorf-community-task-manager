# Code Generation Plan: u6-full-rotas-and-weekend-picks

## Summary

- Builds: leaving and new families with the changeover rule, all four yearly rotas in one draft and one publish, five weekend duties with picks (pick, change, administrator assigns), the Wednesday reminder, Friday-noon alert and Friday-before rota-week reminder, and the functions later units call (C10, C11, C12, C16, C20)
- Touches: one new migration in `supabase/migrations`, `src/data/rota.ts`, `src/access`, `src/runtime`, `app/admin/tanev`, `app/admin/beosztas`, `app/admin` (new unpicked list), `app/szulo/beosztas`, `scripts/db/seed`, `verification`, `contract-summary.md`, and the existing rota tests
- Tests: eight new database test files with the fixed list (standing, draft grid, plan, picks, pick races, checks, functions for later units, migration), changed rota adapter and screen tests, access tests, and an updated rota browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order of `nfr-design/scalability-design.md`: families, then the plan row and rota week rows, then weekend pick rows, then duty rows, then place rows, each ascending.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80, each page loads in under 2 seconds and draft and publish finish in under 5 seconds on the `db:seed:large` set, each check in under 2 seconds, and no target is lowered to pass.
- Changed and new screens follow the Stitch designs the owner approves first (`team.md`); the owner compares the built screens by screenshot. Existing browser specs keep their class names, or change in the same step.
- All data is invented; every test address is added to `scripts/verification/privacy-allowlist.json`.
- Review findings carried from the design stages are built in as follows. The owner can change any of them at plan approval.
  - A picking week whose family is no longer allowed on its Monday (for example a removed family) is treated like a week with no family: it owes no pick, its slot stays with the weekend family, and the weekend family and the administrators are told on Wednesday (BR63.3, BR64.3). Rows with reason `not_drafted` in a published plan never count as a missing picker.
  - The daily check also sends the Friday-noon alert when it runs after Friday noon and the alert has not gone out, so a missed Friday-noon run is caught up (BR64.2).
  - Avoiding two jobs in one week is best effort inside the fairness order, and the evening-out step never moves a week onto a family that already has a job that week when another week can be moved. The planning screen can still show "Két feladat egy héten" warnings on a fresh draft.
  - The evening-out step repeats over all full-year pairs until no week can move. The part-year check in the draft test is: a part-year family's weeks are within one of its duty weeks divided by the number of families present in them.
  - The Tanév screen says under the standings list that a standing only takes effect around the changeover date, and shows that date.
  - The DUTY_INELIGIBLE reason is returned only to a super admin or to a parent of the family it is about; every other caller gets the bare code.
  - Standings, weekend slots and picks hold a family id and no person. What happens to them when a family is deleted or anonymised is recorded in `contract-summary.md` (C16) as U14's decision.
  - The duty card has its own reach test (unrelated parent, teacher, working-group administrator), and the grant test names every internal function, including `weekend_picks_due_check`, `weekend_picks_alert_check` and `rota_week_reminder_check`.

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
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06) \n- ALWAYS stop leftover app servers (pkill -f next-server) before a full npm run verify:local, because a leftover server on port 3100 can block the browser runs. (learned 2026-11-14) \n\n- ALWAYS add every phone number or e-mail address used in a test to scripts/verification/privacy-allowlist.json, or the privacy scan fails the verification run. (learned 2026-11-14) \n\n- ALWAYS check owner-review screenshots for error pages before sending them, because a wrong address in the screenshot script silently shows an error screen instead of the intended screen. (learned 2026-11-14)"
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
  "input_sha256": "sha256:999d92c3bba4d841472e4ba6c73cff72b9560820c912ee7564a6e0812882ff46",
  "contract_sha256": "sha256:c024f4f709c4133abfa772370e48f46abeef293b966889a9d3fdb7fb897c21a9"
}
```

## Steps

| Step | Stories and requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | US4.2 (AC4.2.1 to AC4.2.3), BR60, NFR3, NFR5 |
| 5 to 6 | US5.1 (AC5.1.1 to AC5.1.5), BR61, BR62, NFR6.4, NFR7.1, NFR9.2 |
| 7 to 8 | US6.1 (AC6.1.1 to AC6.1.5), BR63, BR65, NFR5.2, NFR5.3, NFR7.2, NFR7.3 |
| 9 to 10 | US6.2 (AC6.2.1 to AC6.2.3), AC6.1.3, BR64, BR66, NFR5.5, NFR7.5, NFR7.6, NFR9.3 |
| 11 to 12 | US5.3 (AC5.3.1 to AC5.3.3), BR65, NFR1.2, NFR4.8 |
| 13 to 14 | NFR3.9 |
| 15 to 17 | All five stories on screen, NFR8, NFR4.9 |
| 18 to 20 | The Unit's closing evidence |

### Set-up

- [x] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: standings and the changeover rule

- [x] Step 3: Start one migration, `supabase/migrations/20261053_full_rotas_and_weekend_picks.sql`, that opens and commits its own transaction; steps 5, 7 and 9 add to this same file. In this step: the standings table (one row per family and school year, version, row-level security on, no select for application roles); `family_may_hold_duty` (C10, with the reason), `family_standing` and `families_with_standing` (C20), all internal; the signed-in command `family_standing_set` (super admin, version with 0 for no row, idempotency key, audit `family.standing_set`, returns the number of flagged duties); the flagged-duties query; the audit action list; the eligibility check added to `duty_sign_up`, `assignment_assign` and today's swap request and acceptance (the reason only for a super admin or the family's own parent); `school_calendar_get` returning standings and flagged duties to super admins. Every function starts with `revoke all` and an explicit `grant execute` or none, pins its search path, returns the C1 envelope and refuses through `U3R00`.
- [x] Step 4: Write and run `tests/database/rota-standing.test.ts` with the fixed list for `family_standing_set` and for the eligibility check in each of the four changed functions: leaving refused from the changeover date, new refused before it, a week judged by its Monday, a family with a `leaving` row refused in later years, flags appearing and disappearing when the standing or the changeover date changes, and the existing tests of the four changed functions still green. Add the file to `test:database:directory` and to the shuffled run.

### Database: four rotas

- [x] Step 5: In the same migration: widen the rota job and empty-reason lists; add the `not_drafted` rows for existing plans (BR62.6); rewrite `rota_plan_make` for four rotas (BR61.1 to BR61.6, turn-taking with in-memory counts, the new-family start, the evening-out step); extend `rota_week_set` (ROTA_SAME_WEEK_CLASH, DUTY_INELIGIBLE, break weeks only for indoor cleaning and water carrying), `rota_plan_get` (per-rota counts, empty weeks with reasons, uneven and two-jobs warnings, flagged weeks) and `rota_plan_publish` (preconditions for all four rotas; weekly duties for three rotas; weekend slot rows and five duties per week with all places to the weekend family; the publishing notice through `notice_send`; one `rota.publish` event); the weekend slot table; the duty origin `weekend_slot`, the new categories and the place source `weekend_pick`; the protection check widened to weekend duties; the rota-plan notice facts listing all four rotas.
- [x] Step 6: Write and run `tests/database/rota-draft-grid.test.ts` (NFR6.4: family counts 1, 2, 3, 20 and 30, break patterns, years, mixes of leaving and new families; each property asserted with a query in a rolled-back transaction) and `tests/database/rota-four-plan.test.ts` (fixed list for adjust and publish with four rotas, forced failure midway, one notice per parent listing only that family's weeks, each of today's change functions refusing a weekend duty). Update `tests/database/rota-plan.test.ts`, `rota-calendar.test.ts` and `rota-migration.test.ts` where the four-rota plan changes their expectations. Add `tests/database/rota-full-migration.test.ts` (the migration over a seeded database with a draft and a published plan: row counts, `not_drafted` rows, existing duties and notices unchanged). Add the new files to `test:database:directory` and the shuffled run.

### Database: weekend picks

- [x] Step 7: In the same migration: the weekend pick table with its unique indexes and the check that keeps the shelter cleaning out; one helper that turns a week's Monday into the Wednesday, Friday-noon and Saturday boundaries in Budapest time; one internal step that writes or changes a pick and moves the place with `place_reassign`; the signed-in commands `weekend_pick_set` (a parent of the picking family; first pick until Saturday, change until Friday noon) and `weekend_pick_assign` (super admin until Saturday, audit `weekend_pick.assign`, notice `weekend_pick_assigned`); `rota_duty_card` extended with the job facts (watering from March to October by the week's Monday, bottles, day and part of day) and, for the week's three families and super admins, the weekend state; `rota_overview` extended with four rotas and the five weekend holders; `weekend_unpicked_list` for super admins (open picks from this week on with free slots, and the missed picks of the school year).
- [x] Step 8: Write and run `tests/database/weekend-picks.test.ts` (fixed list for pick, change and assign; every refusal code; break week; picker who is also the weekend family; missing or no-longer-allowed picker; who sees the weekend state; the duty card refused for an unrelated parent, a teacher and a working-group administrator; exact field lists of the overview, card and unpicked list; the pick-and-place invariant query after every case) and `tests/database/weekend-picks-races.test.ts` (two families on one slot, pick against assign, pick against the other family's change, time boundaries in a normal week and in both clock-change weeks, a right revoked between two requests). Add both to `test:database:directory` and the shuffled run.

### Database: checks and functions for later units

- [x] Step 9: In the same migration: the six notice kinds in U5's registry and the notice facts for rota and weekend duties (link to the duty card, or to the unpicked list for the two administrator kinds; text from the duty only); `weekend_picks_due_check` (Wednesday reminder, missing-picker notices, and the alert when Friday noon has passed), `weekend_picks_alert_check` (Friday-noon run) and `rota_week_reminder_check`, each registered with its run kind and `lock_step`, each returning created and skipped; `rota_check_change` and `rota_adjust_picks_after_change` (C11), `rota_family_for` (C12), `rota_planning_removal_preview` and `rota_planning_removal_apply` (C16), all internal.
- [x] Step 10: Write and run `tests/database/rota-checks.test.ts` (each check: due, not due, already sent, run twice, two runs at once, run one day late, a forced failure recorded while the others run, each notice's text read from the local test mailbox with no other family's details, each check under 2 seconds on the large seed) and `tests/database/rota-contracts.test.ts` (the functions for later units called as the database owner; a signed-in account refused; the grant list by name). Add both to `test:database:directory` and the shuffled run.

### Seed and data access

- [x] Step 11: Update `scripts/db/seed` and `db:seed:large` (invented standings: one leaving and one new family; a four-rota draft in the normal seed and a published four-rota plan with some picks in the large seed). Extend `src/data/rota.ts` and its port with the standing command and read, the four-rota plan, overview and card shapes, the pick and assign commands and the unpicked list; add the Hungarian message for every new refusal code, empty-week reason and warning in `src/data/copy.ts`.
- [x] Step 12: Write and run the seed and adapter tests: `scripts/db/seed` tests, `src/data/rota.test.ts`, `tests/database/data-adapters.test.ts` for the new calls, and `tests/integration/copy.test.ts` for every new code.

### Access policy

- [x] Step 13: Update `src/access/role-policy.ts`, the authorization helpers, `src/runtime/navigation.ts` and `verification/authorization-matrix.json` together: the standing command, the assign command and the unpicked list for super admins only; the pick command for parents and working-group administrators acting for their own family; a row per viewer and command.
- [x] Step 14: Write and run the access tests: `src/access/role-policy.test.ts`, `src/access/access-matrix.test.ts` and `tests/unit/navigation-access.test.ts` for every changed row.

### Screens

- [x] Step 15: After the owner approves the Stitch designs, change `/admin/tanev` (standings list with Marad, Távozik and Új, the note about the changeover date, the flagged-duty list) and `/admin/beosztas` (four columns, per-rota counts, empty weeks with reasons, the two warnings, cell editor offering only allowed families), and add the unpicked list "Ki nem választott?" to the admin dashboard with its assign action, using `admin-` classes and `app/admin/rota-actions.ts`.
- [x] Step 16: Change `/szulo/beosztas` (four rotas and the weekend duties per week; stacked cards at phone width) and `/szulo/beosztas/[id]` (card texts per job, the weekend picker as a fieldset of native radio buttons with `data-testid` attributes, the weekend family's list, "Ki mit választott?"), the teacher's overview sub-page, and the notice links for the new kinds, using `parent-` classes and `app/szulo/actions.ts`.
- [x] Step 16b (noted extension, after the reviewer's Major finding): new forward-only migration `20261054_weekend_pick_ineligible_family.sql`. `weekend_pick_owed` is false for a picking family that `family_hold_reason` refuses on the week's Monday (leaving, new, archived), and `weekend_picks_due_check` treats such a week like a week with no family (weekend family and administrators told on Wednesday). Tests for the three cases are in `tests/database/rota-checks.test.ts`; no new test file. Follow-up migration `20261055_weekend_pick_step_keeps_reason.sql` keeps the `DUTY_INELIGIBLE` refusal with its reason (BR60.4) for a pick by such a family.
- [x] Step 16a (noted extension, asked for by the coordinator after Step 14): map the `DUTY_INELIGIBLE` refusal (state `validation`, extra `reason`) to its one Hungarian sentence on the parent and admin sign-up, swap and assign screens (`app/szulo/_lib/action-state.ts`, `app/admin/_lib/action-state.ts`), and the weekend pick conflicts on the parent pick form. No new unit or requirement; it closes the open item recorded in the code-generation diary.
- [x] Step 17: Write and run the frontend tests: `tests/integration/rota.test.tsx` for each new state (picker default, taken, saved, conflict, locked, not needed; unpicked list empty, filled, denied, error; standings saved and stale), and `tests/browser/rota.spec.ts` for the role walk (each changed screen as each role, phone width, keyboard, accessibility clean), with `tests/browser/rota-timing.spec.ts` for the 2-second pages on the large seed.

### Close

- [x] Step 18: Confirm the test configuration needs no change: coverage thresholds stay as they are. Amend `contract-summary.md` with the deltas listed in `functional-spec.md` (C5, C8, C9, C10, C11, C20) and the C16 note that U14 decides what happens to standings, slots and picks of a deleted or anonymised family.
- [x] Step 19: Run `npm run verify:local` (with the local settings loaded and leftover servers stopped). On the `db:seed:large` set, time the pages, the draft, the publish and the three checks, and record the results in `code-summary.md`.
- [x] Step 20: Update `README.md` (resetting the local database for the four-rota plan, and what the daily and Friday-noon runs now send) and `verification/AUTHORIZATION.md`, write `code-summary.md`, `source-manifest.json` and `traceability.json`, then take screenshots with `tests/browser/rota-screenshots.spec.ts` for the owner's comparison with the Stitch designs (checking each for an error page first).
