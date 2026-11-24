# Code Generation Plan: u11-checklists-and-templates

## Summary

- Builds: editable checklist templates with sections and tasks, the eight festival, big-cleaning and ship-repair starting templates, an event's own checklist copied from a template, taking and finishing tasks with notes and times, the organisers' and teachers' parts, the lead-time notice and unclaimed-task alert, retiring today's event tasks, and the functions later units call (C14, C15, C16)
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/application`, `src/access`, `app/szulo/esemenyek` (checklist block, editor, template field), `app/admin/sablonok` (new), the group page templates link and `app/szulo/munkacsoportok/[id]/sablonok` (new), the admin task form, `scripts/db/seed`, `verification`, `contract-summary.md`, and the existing task and event tests
- Tests: new database test files with the fixed list (templates, starting templates, checklist copy and edit, claims, claim races, timed checks, functions for later units, removal, migration), changed adapter, facade and screen tests, catalogue tests, and a new checklists browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order of `nfr-design/scalability-design.md`: the event row first, then the checklist head row, then sections ascending, then checklist tasks ascending, then claims ascending. Template commands lock the template row, then its sections and tasks, and never an event. No command locks a family row.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80, each page loads in under 2 seconds on the `db:seed:large` set (which gains a big-cleaning event with a mostly taken checklist), and no target is lowered to pass.
- The new screens follow Stitch designs the owner approves first (`team.md`): step 14 does not start until the designs for the six screens in `functional-spec.md` exist and the owner has approved them. The owner compares the built screens by screenshot. Existing browser specs keep their class names, or change in the same step; new classes use the `checklist-` prefix, and tokens stay in the `--name: #rrggbb` form.
- All data is invented; every test address is added to `scripts/verification/privacy-allowlist.json`. The starting templates hold no person's name or contact detail.
- New database functions start with `revoke all` followed by an explicit `grant execute` (or none for internal ones), pin their search path, return the C1 envelope and refuse through `U3R00`. A new function or table extends `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` in the same step.
- Each new database test file is added by hand to `test:database:directory` in `package.json` and to the shuffled run (`scripts/db/shuffled-tests.ts`), or it never runs.
- Review points from the design stages are built in as follows; the owner can change any at plan approval.
  - Copying a template is a second command after the event is saved, allowed only into an empty checklist (BR163.2); the event's own version is never read or changed by this unit.
  - A parent may still give back their own place on a task that is not done while the event is cancelled and has not ended (BR165.4); everything else on a cancelled or finished event is read-only.
  - The capacity limit (claims never above helpers needed) is held by a deferred trigger and re-checked inside the claim functions under the task lock.
  - Removing a person frees their open claims and anonymises the rest (BR170.4), a rule stricter than contract C16's first wording; the delta is written in `contract-summary.md`.
  - The migration replaces `task_save_core` (BR169.1) and `event_save_core` (BR170.6) with the lock timing of the existing lock tests unchanged: no new row lock is added just to check a family's standing.
  - Contract deltas (C1 lock position, C4 retired origin, C8, C9, C14, C15 `claimant`, C16) are written into `contract-summary.md` in this Unit.

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
| 3 to 4 | US12.2 (AC12.2.1 to AC12.2.4), US12.3 (AC12.3.3), BR160 to BR162, BR170.1 to BR170.3, NFR3, NFR5 |
| 5 to 6 | US12.3 (AC12.3.1, AC12.3.2), US12.1 (AC12.1.4), BR163, BR164, BR167, BR169, NFR3, NFR5, NFR9.5 to NFR9.7 |
| 7 to 8 | US12.1 (AC12.1.1 to AC12.1.3), US13.1 (AC13.1.5), BR165, BR166, NFR5.2 to NFR5.5 |
| 9 to 10 | US13.1 (AC13.1.2, AC13.1.3, AC13.1.6), BR168, BR170.4 to BR170.6, NFR4, NFR10, NFR11 |
| 11 | Contract and matrix deltas, NFR3.9 |
| 12 to 13 | Application layer for all four stories, BR169.1 |
| 14 to 15 | All four stories on screen, NFR8, NFR9, NFR4.8 |
| 16 to 17 | The Unit's closing evidence |

### Set-up

- [x] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: templates and starting content

- [x] Step 3: Start one migration, `supabase/migrations/20261067_checklists_and_templates.sql` (the next free number if another lands first), that opens and commits its own transaction; steps 5, 7 and 9 add to this same file. In this step: the seven tables (template, template section, template task, checklist head, checklist section, checklist task, claim) with their checks, unique and deferrable position constraints, unique `(task_id, parent_id)` and `(event_id, source_ref)` where set, the indexes of `performance-design.md`, the deferred capacity trigger, and row-level security on with no policy for signed-in roles; the audit action values of BR170.3; the two notice kinds and the two daily-check registry rows; `template_save` (whole template with version, name rules, limits of 30 sections and 300 tasks, teachers' sections stored with one helper and no time), `template_set_removed`, and the reads `template_get`, `template_list_admin`, `template_list(group_id)` and `template_options(group_id)`; the internal `checklist_starting_templates_install` with the Hungarian content of BR162.1 (Nagytakarítás with nine area sections, tips and an organisers' section; Hajó javítás; the eight festival templates), safe to run twice.
- [x] Step 4: Write and run `tests/database/checklist-templates.test.ts` (fixed list for the five template functions: super admin and coordinator reach, another group and another community refused as out of reach, name taken including removed ones, outdated screen, repeated click, two savers at once, remove and restore, positions with no gap) and `tests/database/checklist-starting-templates.test.ts` (the install adds the ten templates once, running it twice adds nothing, the big cleaning has nine areas with summer-only tasks and a 14-day lead time, no name or contact detail in the content, refused for every signed-in role). Add both files to `test:database:directory` and the shuffled run.

### Database: an event's checklist

- [x] Step 5: In the same migration: `checklist_copy_template` (two `insert ... select` statements, summer-only tasks left out of a non-summer event, empty sections skipped, `copiedFromTemplateId` kept for information, only into an empty checklist of an open event, template reached from the caller's side, TEMPLATE_UNAVAILABLE, CHECKLIST_NOT_EMPTY, EVENT_CLOSED); `checklist_section_save`, `checklist_section_remove`, `checklist_task_save`, `checklist_task_remove` and `checklist_reorder` (managers only, own versions on sections and tasks and the head's version for structure and order, tasks with a claim or done mark not deletable, helpers not below the claims, section kind fixed while taken, deadline not after the event's end, the event row never written); `checklist_get` as one document with the claims, the done marks, the caller's rights, the sign-up deadline, `allDone`, and organisers' sections left out for everyone outside the organising team; and the replacement of `task_save_core` that refuses a new event link and keeps an unchanged one (BR169.1) with the existing lock timing.
- [x] Step 6: Write and run `tests/database/checklist-copy-read.test.ts` (fixed list for the copy and `checklist_get`: summer filter, empty-section skip, second copy refused, template change after the copy leaves the event alone, organisers' sections invisible to a parent and to a teacher, teachers read-only, caller with no access gets the denied refusal) and `tests/database/checklist-edit.test.ts` (fixed list for the section, task and reorder commands: manager only, an organiser who is not a manager refused, deletion refused with claims, section kind locked, outdated screens and two managers at once, the event's own version unchanged, closed event read-only) and `tests/database/task-event-link-retired.test.ts` (new link refused, unchanged link saved, link removed, tasks with no event as before). Add all three to `test:database:directory` and the shuffled run.

### Database: taking and finishing tasks

- [x] Step 7: In the same migration: `checklist_claim`, `checklist_claim_change`, `checklist_claim_withdraw` and `checklist_claim_typed` (a parent with a family for parents' tasks, the organising team for organisers' tasks, nobody for teachers' tasks; task row locked before claims are counted; each person once; note up to 500 characters; time only when the time matters and inside the event; give-up allowed until done, also on a cancelled event that has not ended; the organising team removes any claim on an open event; another person's removal audited), and `checklist_task_mark_done` and `checklist_task_undo_done` (a helper or the organising team; who and when recorded; undo by whoever marked it or the organising team; another person's undo audited). Taking counts toward nothing: no rota, fair-share, standing or reminder function reads a claim.
- [x] Step 8: Write and run `tests/database/checklist-claims.test.ts` (fixed list for all six commands, including the same denied result for an organisers' task a parent cannot see and a made-up id, notes, times inside and outside the event, give-up on a cancelled event, audit rows holding no name or text) and `tests/database/checklist-claims-races.test.ts` (two people taking the last place, one wins and the other is told it is taken; the same parent twice; claim against give-up; mark done twice and done against undo; cancel against a claim; limit trigger as the last line of defence). Add both files to `test:database:directory` and the shuffled run.

### Database: timed notices, removal and later units

- [x] Step 9: In the same migration: `event_lead_notice_check` and `checklist_unclaimed_check` (internal, run only through `timed_checks_run_system`, daily, lock step 4; the first sends "Közeleg: [cím]" once when the lead time is reached, to everyone the event is for including its creator; the second sends "Gazdátlan feladatok: [cím]" once per deadline date to the organisers from three days before the deadline; one failing event does not stop the others); `checklist_claimant_ids` and the replacement of `event_save_core` that adds those parents to the cancellation and change notice; `checklist_add_task` (C15, with the optional `claimant`, the `source_ref` repeat rule and the lock order); and `checklists_removal_preview` and `checklists_removal_apply` (C16; open claims deleted, other claims anonymised, done marks cleared, same counts in preview and apply). All granted to no signed-in role.
- [x] Step 10: Write and run `tests/database/checklist-checks.test.ts` (both checks: once keys, run twice, window edges, lead time or deadline moved afterwards, no lead time or deadline, recipients for a community and a group event, the creator included, no person named), `tests/database/checklist-for-later-units.test.ts` (the internal functions called as the database owner and refused for every signed-in role; `checklist_add_task` repeat, claimant parent, typed name and inactive parent; `checklist_claimant_ids` in the cancellation notice) and `tests/database/checklist-removal.test.ts` (the pair for a parent and for a family, open claims freed, kept claims showing korábbi tag through C6, zero counts for a subject holding nothing). Extend `tests/database/identity-catalogue.test.ts` (elevated-function list, policy-test list, scope-probe decisions) and `src/data/notification-use-cases.test.ts` for the new functions, tables and notice kinds. Add the new files to `test:database:directory` and the shuffled run.
- [x] Step 11 (migration test and matrix resource rows done; no separate route rows were added, because the existing `/szulo/esemenyek/**`, `/admin/esemenyek/**` and `/admin/**` rows already cover the new routes, and no new resource kind was introduced; the `contract-summary.md` deltas are not written, as that file belongs to the earlier contract design stage): Add `tests/database/checklist-migration.test.ts` (the migration over a seeded database with events and linked tasks: kept rows and counts, new tables empty, existing task and event tests green) and the privacy, grant and authorization-matrix rows in `verification/authorization-matrix.json`. Update `contract-summary.md` with the deltas listed in the ground rules. Add the migration test to the scripts.

### Application layer

- [x] Step 12 (done except, on purpose: the seed only installs the ten templates, with no demo-event checklists or big-cleaning event; navigation entries come with the screens): Add the read and command models, results and Hungarian refusal texts for templates, the event checklist, claims, done marks and the timed notices in `src/application/contracts.ts`, `src/data/parent-port.ts`, `src/data/admin-tasks.ts` (or the data module that holds the template reads) and `src/application/parent-facade.ts`; add the access rows in `src/access/role-policy.ts`, `src/application/authorization.ts` and navigation; extend the seed (`scripts/db/seed/write.ts` and `data.ts`) to call the install function for the local community, give some demo events a checklist, and add a big-cleaning event with a mostly taken checklist to the large seed. Write and run the changed and new Vitest and Node tests for the adapter, facade and seed.
- [x] Step 13: Remove the event select, its hint and the event lookups from `app/admin/_components/TaskFields.tsx` and the task form's data loading, and change the tests that pick an event for a task in the same step; keep today's class names and measurements, or change their tests with them.

### Screens

- [x] Step 14: After the owner approves the Stitch designs, build the screens: the checklist block on the event page `/szulo/esemenyek/[id]` (sections, task rows with helpers "x/y", tip in place, Elvállalom with note and time, Kész, Visszaadom, Visszavonás, the organisers' section marked "Csak a szervezők látják", the teachers' plain list, the deadline line, the closing-round callout), the "Indítás sablonból" field on the new-event form with the lead-time pre-fill and summer hint, the checklist editor `/szulo/esemenyek/[id]/feladatlista` with its link for managers, the administrator templates list and editor `/admin/sablonok`, `/admin/sablonok/uj`, `/admin/sablonok/[id]`, and the coordinator's `/szulo/munkacsoportok/[id]/sablonok` with its link on the group page. New `checklist-` classes, `data-testid` on interactive elements, button names that include the task title for screen readers, results announced through the existing status region, phone width and keyboard use.
- [x] Step 15: Write and run the screen, action and access tests, and `tests/browser/checklists.spec.ts` for the critical flow (open an event, take a task with a note, mark it done, give it back, a manager copies a template into a new event) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome.

### Closing evidence

- [x] Step 16: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and the timing results against the 2-second targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page.
- [x] Step 17: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.
