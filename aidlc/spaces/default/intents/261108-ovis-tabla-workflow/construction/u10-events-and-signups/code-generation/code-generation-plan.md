# Code Generation Plan: u10-events-and-signups

## Summary

- Builds: community and working-group events with an optional-group model, notices, roles with an organiser mark, the year's tale, sign-ups with a note, food offers, three event notice kinds, and the functions later units call (C13, C14, C16)
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/application`, `src/access`, `app/szulo/esemenyek` (new), `app/admin`, the group page events section, `scripts/db/seed`, `verification`, `contract-summary.md`, and the existing event tests
- Tests: five new database test files with the fixed list (events, notices and roles, sign-ups and offers, races, functions for later units and migration), changed adapter, facade and screen tests, catalogue tests, and a new events browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order of `nfr-design/scalability-design.md`: the event row first, then its notice, role, sign-up and offer rows ascending, then task rows ascending. Row-based commands read the row's event id, lock the event, then lock the row and re-check.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80, each page loads in under 2 seconds on the `db:seed:large` set, and no target is lowered to pass.
- Changed and new screens follow the Stitch designs the owner approves first (`team.md`); the owner compares the built screens by screenshot. Existing browser specs keep their class names, or change in the same step.
- All data is invented; every test address is added to `scripts/verification/privacy-allowlist.json`.
- Review findings carried from the design stages are built in as follows. The owner can change any of them at plan approval.
  - A parent may withdraw a sign-up or offer on a cancelled or finished event; changing needs an open event (BR110.1, BR116.1).
  - A role may hold neither person after a removal and shows korábbi tag; saving requires exactly one (BR105.1).
  - An organiser mark gives no edit right (BR106.2); only a super admin or the group's administrator manages an event.
  - The limits (10 notices, 20 roles, 10 sign-ups, 20 offers) and the food-off rule are checked inside the functions under the event lock, not by table constraints.
  - A super-admin read that lists typed-name roles for the removal screen is added and named in the C16 delta, so U14 has something to call.
  - The cancellation notice's once key includes the event version, so a second cancellation after a reopen tells again; a reopen itself sends nothing.
  - After an event ends, a manager may still change the tale and roles and cancel nothing more; dates and status are refused with EVENT_CLOSED.
  - The reader list is `event_list()` and the coordinator list is `event_list_for_group(group_id)`; no name is used twice.
  - The teacher schedule shows the oldest role's name only, never its person.
  - Contract deltas (C1 lock position of the event, C13, C14, C16 and the new read) are written into `contract-summary.md` in this Unit.

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
| 3 to 4 | US11.1 (AC11.1.1 to AC11.1.3), BR100 to BR104, BR117, BR118, NFR3, NFR5, NFR7 |
| 5 to 6 | US11.3 (AC11.3.1 to AC11.3.3), BR103, BR105 to BR107, NFR7.3, NFR7.4 |
| 7 to 8 | US11.2 and US11.4 (AC11.2.1 to AC11.2.3, AC11.4.1 to AC11.4.3), BR108 to BR116, NFR5.2, NFR5.4, NFR5.5 |
| 9 to 10 | AC17.1.1, AC17.1.4, AC17.1.6, BR117, BR119 to BR124, NFR4, NFR10, NFR11 |
| 11 to 12 | NFR3.9, NFR6.3, NFR6.4 |
| 13 to 15 | All four stories on screen, NFR8, NFR9, NFR4.8 |
| 16 to 17 | The Unit's closing evidence |

### Set-up

- [ ] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [ ] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: events, notices and roles

- [ ] Step 3: Start one migration, `supabase/migrations/20261056_events_and_signups.sql`, that opens and commits its own transaction; steps 5, 7 and 9 add to this same file. In this step: `events` gains `is_summer`, `signup_deadline`, `notice_lead_days`, `food_signup_on` and `tale`, and loses `allergen_note`, `supply_note`, `food_note` and `coordinator_name`; the three notice kinds and the `event` target with its facts function in U5's registries; the audit action names of BR123.1; `event_save` extended (fields, dates, status, notices of W8, the change and cancel notices, once keys with the event version, closing open tasks in ascending id order on cancel, EVENT_CLOSED for dates and status after the end); `event_notices_save` replacing `event_save_notes`; `event_tale_save`; `event_role_save` and `event_role_remove`; the reads `event_list`, `event_get` and `event_list_for_group`, open to every signed-in reader including teachers. Every function starts with `revoke all` and an explicit `grant execute` or none, pins its search path, returns the C1 envelope and refuses through `U3R00`.
- [ ] Step 4: Write and run `tests/database/events-core.test.ts` with the fixed list for `event_save` and the three reads: community and group events, reach for each role including the teacher, EVENT_CLOSED after the end, outdated screen, repeated click, two managers at once, cancel against a parent adding, notice once keys, and today's event tasks unchanged. Update the tests that name the dropped columns. Add the file to `test:database:directory` and the shuffled run.
- [ ] Step 5: In the same migration: the notice, role, sign-up and offer tables with their row checks (organiser only with a parent, not both parent and typed name, position 1 to 10, unique position per event); limits and the exactly-one-person rule inside the save functions; the organiser mark audited; `event_organisers`, `event_is_summer` and `event_deadline` (internal, never granted); the teacher schedule function showing the oldest role's name.
- [ ] Step 6: Write and run `tests/database/events-notices-roles.test.ts` (fixed list for `event_notices_save`, `event_tale_save`, `event_role_save` and `event_role_remove`: limits, exactly one person, organiser rules and no edit right, version conflicts, two savers at once, positions with no gap, the schedule reading) and `tests/database/events-for-later-units.test.ts` (the three internal functions called as the database owner and refused for every signed-in role). Add both files to `test:database:directory` and the shuffled run.

### Database: sign-ups and food offers

- [ ] Step 7: In the same migration: `event_signup_add`, `event_signup_change` and `event_signup_withdraw` (up to 10 per parent and event, note and time within the event, change needs an open event, withdraw is allowed on a closed one, a manager may withdraw); `food_offer_add`, `food_offer_change` and `food_offer_withdraw` (eight categories, three ingredient ticks, up to 20 per parent and event, new offers only while food sign-up is on). Row-based commands read the event id, lock the event, then the row and re-check. The same denied result for a real row of another family and a made-up id.
- [ ] Step 8: Write and run `tests/database/events-signups.test.ts` and `tests/database/events-signups-races.test.ts` (fixed list for all six commands; limits at the last allowed add fired twice; change against withdraw; cancel against add; food switch turned off with existing offers kept; no field linking an offer to a child or health; exact field lists of the reads). Add both files to `test:database:directory` and the shuffled run.

### Database: removal and later units

- [ ] Step 9: In the same migration: `events_removal_preview` and `events_removal_apply` (C16; clear links on sign-ups and offers, parent and organiser on roles, exactly matching typed names; zero counts for a subject kind not held; locks events ascending then rows ascending), `event_role_clear_name` (super admin only), and the super-admin read that lists the typed-name roles for the removal screen.
- [ ] Step 10: Write and run `tests/database/events-removal.test.ts` (the pair for a parent and for a family, rows kept and links cleared, korábbi tag through C6, clear-name refusals, the list read refused for every other role). Extend `tests/database/identity-catalogue.test.ts` (elevated-function list, policy-test list, scope-probe decisions) and `src/data/notification-use-cases.test.ts` for the new functions, tables and notice kinds. Add the new file to `test:database:directory` and the shuffled run.
- [ ] Step 11: Add the migration test `tests/database/events-migration.test.ts` (the migration over a seeded database with events, tasks and places: kept fields and row counts, dropped columns gone) and the privacy, grant and authorization-matrix rows in `verification/authorization-matrix.json`. Add the file to the scripts.
- [ ] Step 12: Update `contract-summary.md` with the deltas listed in the ground rules.

### Application layer and screens

- [ ] Step 13: Replace `EventNoteModel` and the event note screen in `src/application/contracts.ts`, `src/data/admin-tasks.ts`, `src/data/parent-port.ts` and `src/application/parent-facade.ts` with the new read and command models, results and message mapping; add the Hungarian refusal texts; update the seed `scripts/db/seed/write.ts` and `data.ts` with invented events, notices, roles, sign-ups and offers; write and run the changed and new Vitest and Node tests for the adapter, facade and seed.
- [ ] Step 14: Build the screens after the owner approves their Stitch designs: events list with the past-events switch at `/szulo/esemenyek`, event page at `/szulo/esemenyek/[id]`, event form at `/szulo/esemenyek/uj` and `/szulo/esemenyek/[id]/szerkesztes`, the admin menu item Események, and the events section of the working group page. Keep today's class names or change their tests; add `data-testid` to interactive elements; update navigation and access policy files and their tests.
- [ ] Step 15: Write and run the screen, action and access tests, and a browser specification for the critical event flow (list, open, sign up with a note, offer a dish, withdraw) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome.

### Closing evidence

- [ ] Step 16: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and any timing results against the 2-second targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page.
- [ ] Step 17: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.
