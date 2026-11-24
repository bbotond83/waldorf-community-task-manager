# Code Generation Plan: u8-animal-care-and-information

## Summary

- Builds: a school year's morning and afternoon animal-care slots, sign-up, giving a slot up until 24 hours before, the fair-share panel, the monthly fair-share reminder and the daily empty-slot warnings, the information page with its six starting sections, who may edit them, and the duty-card links to them
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/application`, `src/access`, `app/szulo/allatok` (new), `app/informacio` (new, shared by every role), the animal-care settings screen in `app/admin`, the duty card, `scripts/db/seed`, `verification`, and the existing catalogue, duty-card and notice tests
- Tests: new database test files with the fixed list (calendar and slot creation, sign-up and give-up, races, fair share, the two daily checks, information sections, duty-card links, migration), changed adapter, facade and screen tests, catalogue tests, and a new animal-care and information browser specification

## Ground Rules

- Build order follows `functional-spec.md` (workflows W1 to W8) and the lock order of `nfr-design/scalability-design.md`: calendar row, then slot duty rows ascending, then place rows ascending; sign-up and give-up lock the duty, then the place, as U2 and U7 do. No command locks a family row; standings are read without a lock.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80, each page loads in under 2 seconds on the `db:seed:large` set (which gains a year's slot calendar with about 60% of the slots held by invented families, and section text of realistic length), and no target is lowered to pass.
- The new screens follow Stitch designs the owner approves first (`team.md`): step 14 does not start until the designs for the five screens in `functional-spec.md` exist and the owner has approved them. The owner compares the built screens by screenshot. Existing browser specs keep their class names, or change in the same step; new classes use the `parent-`, `admin-` and `info-` prefixes, and tokens stay in the `--name: #rrggbb` form.
- All data is invented; every test address is added to `scripts/verification/privacy-allowlist.json`. The six starting sections are copied from the spreadsheet review's appendices and checked to hold no person's name or contact detail before they go into the migration.
- New database functions start with `revoke all` followed by an explicit `grant execute` (or none for internal ones), pin their search path, return the C1 envelope and refuse through `U3R00`. The four new tables have row-level security on, no policy and no `select` grant for signed-in roles. A new function or table extends `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` in the same step.
- Each new database test file is added by hand to `test:database:directory` in `package.json` and to the shuffled run (`scripts/db/shuffled-tests.ts`), or it never runs.
- Review points from the design stages are built in as follows; the owner can change any at plan approval.
  - `slot_give_up` reads the place and the caller's family without a lock and returns the same denied refusal for "not yours" and "does not exist" before any lock is taken; only the caller's own place is then locked and rechecked (NFR3.4).
  - The 24-hour limit is judged inside the database on the start time read under the lock, so a start-time change racing a give-up gives one consistent answer (NFR5.6).
  - The section owner is resolved by group name in the school year current today on every call and never cached (BR87.6).
  - Section text is stored as the author wrote it and turned into React elements by the app's own renderer; no raw HTML reaches the browser, and the link rule is checked on saving and on rendering (BR87.5).
  - The migration replaces `rota_duty_card` starting from its latest applied definition (`20261053_full_rotas_and_weekend_picks.sql`) and changes only the added `info_links` field; a test reads a card before and after and finds the same fields otherwise. It re-creates the audit action check with the complete current list plus two actions.
  - The migration file is `20261068_animal_care_and_information.sql` (the next free number if another lands first); steps 3, 5, 7 and 9 add to this same file, which opens and commits its own transaction.
  - The two daily checks are registered at lock step 4 and do not lock a family, task or assignment row.
  - Contract deltas (C4 origin `animal_slot`, C8 new kinds and target type, C9 two registered checks, C19) are written into `contract-summary.md` in this Unit.

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
| 3 to 4 | US7.1 (AC7.1.1), BR80.1 to BR80.5, BR89.1, NFR3, NFR4.1, NFR5.5, NFR5.6 |
| 5 to 6 | US7.1 (AC7.1.1 to AC7.1.3), US7.4 (Give-up 1 to 5), BR81.1 to BR81.6, BR82.1 to BR82.5, NFR3.4, NFR5.2 to NFR5.4 |
| 7 to 8 | US7.2 (AC7.2.1 to AC7.2.3), US7.3 (AC7.3.1 to AC7.3.3), BR83.1 to BR85.6, FR17.1, FR17.3, NFR5.8, NFR9.4, NFR10 |
| 9 to 10 | US10.1 (AC10.1.1 to AC10.1.3), US10.2 (AC10.2.1, AC10.2.2), BR86.1 to BR88.3, NFR1, NFR3.12, NFR3.13, NFR5.7 |
| 11 | Contract and matrix deltas, NFR3.11, migration check |
| 12 to 13 | Application layer for all five stories |
| 14 to 15 | All five stories on screen, NFR8, NFR9, NFR3.12 |
| 16 to 17 | The Unit's closing evidence |

### Set-up

- [ ] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [ ] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: the year's slots and the information page

- [ ] Step 3: Start one migration, `supabase/migrations/20261068_animal_care_and_information.sql`, that opens and commits its own transaction; steps 5, 7 and 9 add to this same file. In this step: re-create the duty origin check with `animal_slot`; create the four tables (slot calendar, animal slot, fair-share round, information section) with their checks, unique keys (calendar, date and part; calendar and month; community and key) and the slot date index, row-level security on with no policy and no `select` grant for `authenticated`; add the two audit actions (`animal_calendar.saved`, `animal_slots.created`) by re-creating the audit action check with the complete current list; add `animal_calendar_get`, `animal_calendar_save` (times, alert group, version, moved start times for slots after today, one notice per holding family), `animal_slots_create` (one set-based statement over C3 `school_weeks` with "on conflict do nothing", returns the count) and the internal `info_section_owner_group`.
- [ ] Step 4: Write and run `tests/database/animal-calendar-slots.test.ts` (fixed list for the three calendar functions: super admin only, a group admin, a parent and a teacher refused as out of reach, morning not earlier than afternoon, alert group of another year refused, outdated screen, repeated click and a second creation adding none, two super admins creating at once giving one set, the break weeks and weekends, today's slots keeping their times, audit rows holding no name) and `tests/database/animal-table-rights.test.ts` (each of the four tables selected as each signed-in role gives a permission error). Add both files to `test:database:directory` and the shuffled run.

### Database: signing up and giving up

- [ ] Step 5: In the same migration: `animal_slots_list` (the requested weeks, at most eight, with the row fields of `functional-spec.md`, no contact details, the give-up allowed flag, the open-swap flag, the started flag); the use of the existing `duty_sign_up` on a slot duty with its changeover reason; and `slot_give_up` (denied check first with no lock, then duty and place locks, the origin check `SLOT_NOT_RELEASABLE`, the 24-hour limit `SLOT_GIVE_UP_TOO_LATE`, `DUTY_CLOSED` after the start, the open swap `REQUEST_CONFLICT`, the version, `place_release`).
- [ ] Step 6: Write and run `tests/database/animal-sign-up-give-up.test.ts` (fixed list for sign-up on a slot and for `slot_give_up`: allowed, a taken slot, a started slot, the changeover rule, a family with no family refused, another family's slot and a made-up place giving the same denied result, limit edges at 24 hours, an open swap, outdated screen, repeated click, no limit per family) and `tests/database/animal-slot-races.test.ts` (two families taking one slot, one wins; the same parent twice; give-up against sign-up; give-up against a swap proposal; give-up against a start-time change; run beside the swap race tests to show no deadlock). Add both files to `test:database:directory` and the shuffled run.

### Database: fair share and the two daily checks

- [ ] Step 7: In the same migration: `animal_fair_share` (the caller's family first, counts of active slot places grouped by family joined to the C20 standings, average and own share, no standing row counting as staying); `animal_fair_share_check` (the first weekday of the month, a week of the year, the round row inserted first under its unique key, one reminder per parent of each family below its share that may hold a duty, the counts created and skipped); `animal_empty_slots_check` (free slots on D+1 to D+3, one message per family a day listing the slots it may hold, the day-before alert to the super admins and the alert group's coordinators, once per person per day); the four notice kinds with their fact functions and the target type `animal_signup`; and the two registry rows at lock step 4 with `added_by` `u8-animal-care`. All internal functions are granted to no signed-in role.
- [ ] Step 8: Write and run `tests/database/animal-fair-share.test.ts` (fixed list for the read: counts and shares for staying, leaving and new families, no standing row, no held slot, a slot given up, never blocking, the caller's family first) and `tests/database/animal-checks.test.ts` (both checks: once keys, run twice, a missed first weekday made up by the next run, a month already recorded, no calendar, window edges on a Friday and a weekend, a slot filled before the run, a family that may not hold a duty that day, someone who is both super admin and coordinator alerted once, no family named in any message, the registry order, refused for every signed-in role, two runs at once). Extend `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` for the new functions, tables and notice kinds. Add the new files to `test:database:directory` and the shuffled run.

### Database: the information page and the duty-card links

- [ ] Step 9: In the same migration: `info_sections_list` (visible sections in order with the caller's edit right, hidden sections marked and returned to super admins only), `info_section_update` (a coordinator of the owning group changes the text only, a super admin changes everything), `info_section_create` (key made from the title, `INFO_KEY_TAKEN`), `info_section_set_hidden`, the validation of title, text, season months and link addresses (`INFO_TEXT_INVALID`, `INFO_GROUP_INVALID`), the internal `info_links_for_duty` (BR88.1 to BR88.3, watering March to October, hidden sections left out), the replacement of `rota_duty_card` that adds `info_links` and changes nothing else, and the six starting sections with their owner names, checked to hold no name or contact detail.
- [ ] Step 10: Write and run `tests/database/info-sections.test.ts` (fixed list for the four functions: every role reading with one hidden section, a coordinator of the owning group editing text only, a coordinator of another group and one whose grant was revoked refused, the owner carried to a new school year by name, no current year or no group of that name leaving only super admins, outdated screen, repeated click, two editors at once, tags and bad links refused, sections never deleted), `tests/database/info-links-duty-card.test.ts` (morning, afternoon and weekend cards, watering in and out of season, a hidden section never linked, the card before and after the migration identical apart from `info_links`, a direct call refused for every signed-in role) and `tests/database/animal-migration.test.ts` (the migration over a seeded database: kept rows and counts, new tables holding only the six sections, the existing duty, swap, rota and notice tests green). Add the three files to `test:database:directory` and the shuffled run.
- [ ] Step 11: Add the privacy, grant and authorization-matrix rows for the new functions, tables and routes in `verification/authorization-matrix.json` (each new screen walked through for parent, group admin, super admin, teacher and signed out), and update `contract-summary.md` with the deltas listed in the ground rules. Add the migration test to the scripts.

### Application layer

- [ ] Step 12: Add the read and command models, results and Hungarian refusal texts (with the decimal comma for shares) for the calendar, the slot list, sign-up, give-up, the fair share, the sections and the duty-card links in `src/application/contracts.ts`, `src/data/parent-port.ts`, a new `src/data/animal-care.ts` and `src/data/information.ts` (adapters over the functions), and `src/application/` facades; add the section text renderer (paragraphs, bulleted and numbered items, bold and links, everything else as text, links checked by the same rule as on saving) with its unit tests; add the access rows in `src/access/role-policy.ts`, `src/application/authorization.ts` and the navigation (Állatgondozás for parents, Információ for every signed-in role); extend the seed (`scripts/db/seed/write.ts` and `data.ts`) to give the local community a calendar and slots, and the large seed a year's slots with about 60% held and section text of realistic length. Write and run the changed and new Vitest and Node tests for the adapters, facades, renderer and seed.
- [ ] Step 13: Add the information links to the existing duty-card screens, keeping today's class names and measurements, or change their tests with them.

### Screens

- [ ] Step 14: After the owner approves the Stitch designs, build the screens: the sign-up page `/szulo/allatok` (fair-share panel, two weeks of day rows with morning and afternoon, taken and free states, "Ti", "Már foglalt", Elvállalom, Lemondás with confirmation, Csere within 24 hours, button names that include the day and part, results in the status region, focus kept on the row), the information page `/informacio` (section accordions with anchors, a duty link opening its section expanded, Szerkesztés for those allowed), the section editor (text with a short formatting help and the warning about phone numbers, email addresses and children's names; for a super admin also title, owner, season months, order, add, hide and restore), the animal-care settings of a school year in the admin area (two times, alert group, Időpontok létrehozása with its result), and the links on duty cards. Classes use the `parent-`, `admin-` and `info-` prefixes, `data-testid` on interactive elements, phone width and keyboard use.
- [ ] Step 15: Write and run the screen, action and access tests, and `tests/browser/animal-care.spec.ts` for the critical flow (open the sign-up page, take a slot, give it up, follow a duty link to a section, a coordinator edits a section) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome.

### Closing evidence

- [ ] Step 16: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and the timing results against the 2-second targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page.
- [ ] Step 17: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.

### Owner review changes

- [ ] Step 18: Keep migration 20261069 and add a read-only teacher page `/teacher/allatok` with its menu entry, tests and expectations.
- [ ] Step 19: Add migration 20261070 (calendar first-save conflict result; caller checked before the section lock; hidden sections out of a coordinator's reach) with database tests for the two-at-once, repeated-click and hidden cases.
- [ ] Step 20: Run the full `npm run verify:local`, send the owner a screenshot of the teacher page, and ask for approval again.
