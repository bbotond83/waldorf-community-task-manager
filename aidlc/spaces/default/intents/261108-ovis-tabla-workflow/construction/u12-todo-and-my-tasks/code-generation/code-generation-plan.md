# Code Generation Plan: u12-todo-and-my-tasks

## Summary

- Builds: the shared to-do list (tasks owned by a working group or one family, with one claimant, status, done mark, history and attention flag), the My tasks page, the coordinator's management page, pulling tasks into an event checklist, the change notice and the deadline reminder, and the functions later units call (C14, C15, C16, C17)
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/application`, `src/access`, `app/szulo/teendok` (new), `app/szulo/feladataim` (new), `app/szulo/munkacsoportok/[id]/kezeles` (new) with its link on the group page, `app/admin/teendok` (new), the event page (pull list), `scripts/db/seed`, `verification`, `contract-summary.md`, and the existing group-page and catalogue tests
- Tests: new database test files with the fixed list (tasks and constraints, claims, claim races, pull, reads, daily check, functions for later units, removal, migration load), changed adapter, facade and screen tests, catalogue tests, and a new to-do browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order of `nfr-design/scalability-design.md`: to-do commands lock only the to-do task rows, ascending; the pull locks the event row, then the checklist rows (inside `checklist_add_task`), then the to-do rows ascending. No command locks a family row.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80, each page loads in under 2 seconds and each command in under 1 second on the `db:seed:large` set, and no target is lowered to pass.
- The new screens follow Stitch designs the owner approves first (`team.md`): step 12 does not start until the designs for the six screens in `functional-spec.md` exist and the owner has approved them. The owner compares the built screens by screenshot. Existing browser specs keep their class names, or change in the same step; new classes use the `todo-` prefix, and tokens stay in the `--name: #rrggbb` form.
- All data is invented; every test address is added to `scripts/verification/privacy-allowlist.json`. No real task text, person name or contact detail is used.
- New database functions start with `revoke all` followed by an explicit `grant execute` (or none for internal ones), pin their search path, take an idempotency key, return the C1 envelope and refuse through `U3R00`. A new function or table extends `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` in the same step.
- Each new database test file is added by hand to `test:database:directory` in `package.json` and to the shuffled run (`scripts/db/shuffled-tests.ts`), or it never runs.
- The migration file is `supabase/migrations/20261071_todo_and_my_tasks.sql` (the latest file today is `20261070_u8_review_fixes.sql`; the next free number is used if another lands first). Steps 3, 5 and 7 add to this one file.
- Review points from the design stages are built in as follows; the owner can change any at plan approval.
  - Claim, give-back and done mark re-check, after the task row is locked, that the caller is still an active parent with an active family (and administrators still hold the grant). U14's removal block takes the family row, so the re-check, not a missing lock, is what closes the race with a removal (review points of Functional Design and NFR Design).
  - `todo_task_set_attention` is a named internal function used by the removal pair, and `todo_list` and `todo_list_for_group` expose flagged tasks so U14's "Teendő a távozás miatt" list can read them (Functional Design review).
  - The "sibling read" for community readers on the group detail page is `todo_list` filtered by owner group, so no extra function is added.
  - Every update bumps the task version, including claim, give-back and free; edits that change topic, deadline or owner send `todo_changed`, and a note-only edit by the claimant does not.
  - The reminder's once key includes the claimant, so a new claimant after a claim change is reminded.
  - A link from a deleted checklist task does not block a new pull: a pull ignores links whose checklist task no longer exists.
  - Pulling a claimed task keeps the claimant as a helper on the checklist task and says so on the confirmation.
  - A removed family's task shows its owner as "korábbi család".
  - The denied refusal on My tasks for a teacher or a caller without a family is named in the facade and tested.
  - Refusal codes `no_parent_record`, `too_many_tasks` and `status_not_allowed` are in the code-to-message table and tested.
  - The migration number, the daily-check test's script and the section targets of the traceability map are settled while building (NFR design and infrastructure reviews).
  - Contract deltas (C1 audit actions and lock note, C8, C9, C14, C15 `p_expected_versions`, C16, C17) are written into `contract-summary.md` in this Unit.

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
| 3 to 4 | AC2.4.1, AC2.4.2, AC14.1.1 to AC14.1.3, BR180 to BR184, NFR3.21 to NFR3.25, NFR5.15 to NFR5.18, NFR7.18, NFR7.20 |
| 5 to 6 | AC14.2.1 to AC14.2.3, AC14.3.1, BR184.1, BR185, BR186, BR187, NFR5.20 to NFR5.22, NFR7.19, NFR9.11 to NFR9.15 |
| 7 to 8 | AC15.1.1, AC15.1.2, AC17.1.1, AC17.1.6, BR188, BR189, BR190, NFR4, NFR7.21 to NFR7.23, NFR10, NFR11 |
| 9 | Contract and matrix deltas, NFR3.28 to NFR3.31 |
| 10 to 11 | Application layer for all stories |
| 12 to 13 | All stories on screen, NFR8, NFR9 |
| 14 to 15 | The Unit's closing evidence |

### Set-up

- [x] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: tasks, claims and done marks

- [x] Step 3: Start one migration, `supabase/migrations/20261071_todo_and_my_tasks.sql`, that opens and commits its own transaction; steps 5 and 7 add to this same file. In this step: the three tables (`todo_tasks`, `todo_task_history`, `todo_event_links`) with their checks (owner is exactly one of group or family; done status if and only if a done time; not-before not after the deadline; unique source key; unique task and event link), the history no-update and no-delete trigger, the indexes of `performance-design.md`, and row-level security on with no policy for signed-in roles; the audit action values; the notice kinds `todo_changed` and `todo_due` with the `todo_task` target and `notice_facts_todo`; the internal read `checklist_task_done_state`; the internal `todo_task_set_attention`; and the commands `todo_task_save`, `todo_task_claim`, `todo_task_give_back`, `todo_task_free_claim`, `todo_task_update`, `todo_task_mark_done` and `todo_task_undo_done`, each with the post-lock active-parent re-check and a version bump.
- [x] Step 4: Write and run `tests/database/todo-tasks.test.ts` (fixed list for `todo_task_save`: manager reach, another group, a family-owned task by a super admin only, field limits, outdated screen, repeated click, two managers at once, table constraints as database owner, history that cannot be changed), `tests/database/todo-claims.test.ts` (fixed list for claim, give-back, free-claim, update, done and undo: claimant versus other parents, family-owned tasks by that family only with the same denied result as a made-up id, a not-yet-due task, notices for administrator changes and none for a note-only edit, audit rows holding no name or text) and `tests/database/todo-races.test.ts` (two parents claiming at once, done against free-claim, done against edit, claim against U14's removal in both orders, repeated click). Add the files to `test:database:directory` and the shuffled run.

### Database: pull and reads

- [x] Step 5: In the same migration: `todo_pull_to_event` (managers of the event, closed event refused, at most 50 tasks, `p_expected_versions` per task, links whose checklist task is gone ignored, claimed tasks carry the claimant as a helper, all-or-nothing, one audit row); `todo_list` and `todo_get` (one document each, "Az eseményen kész" through `checklist_task_done_state`, flagged tasks, "korábbi tag" and "korábbi család" fallbacks, list cut at 500 with a note); `todo_list_for_group(group_id)` (C14); and `my_tasks_get` (family duties, recurring duties and claimed tasks by week in Budapest time; denied for a teacher and a caller without a family).
- [x] Step 6: Write and run `tests/database/todo-pull.test.ts` (fixed list for the pull: allowed, another group's coordinator refused, closed event, an outdated screen, repeated click, two pulls at once, a pull against a claim, all-or-nothing on a forced failure, deadlock-free with U11's checklist commands) and `tests/database/todo-reads.test.ts` (fixed list for the four reads: every role, denied rather than empty, the exact field list, the week boundaries in both clock-change weeks, the list limit, timings on the large seed). Add both files to `test:database:directory` and the shuffled run.

### Database: reminder, removal and load

- [x] Step 7: In the same migration: `todo_deadline_reminder` (internal, daily, lock step 4, once key with the claimant, one failing task does not stop the others) and its registry row; `todo_removal_preview` and `todo_removal_apply` (C16: names cleared on tasks and history, a removed person's open claim released and flagged, a removed family's open tasks flagged, same counts in preview and apply); and `migration_load_todo` (service role only, once per source key, field name only on a bad row). All granted to no signed-in role except where the contract says otherwise.
- [x] Step 8: Write and run `tests/database/todo-checks.test.ts` (reminder: once keys, run twice, window edges, claimant change, no deadline, a failing task, the clock-change weeks), `tests/database/todo-for-later-units.test.ts` (the internal functions called as the database owner and refused for every signed-in role; `checklist_task_done_state`), `tests/database/todo-removal.test.ts` (the pair for a parent and for a family, zero counts for a subject holding nothing, flagged tasks readable) and `tests/database/todo-migration.test.ts` (the load over a seeded database with the invented workbook, twice, with bad rows). Extend `tests/database/identity-catalogue.test.ts` and `src/data/notification-use-cases.test.ts` for the new functions, tables and notice kinds. Add the new files to `test:database:directory` and the shuffled run.
- [x] Step 9: Add the authorization-matrix rows in `verification/authorization-matrix.json` for the new commands, reads and screens for every role, and update `contract-summary.md` with the deltas listed in the ground rules.

### Application layer

- [x] Step 10: Add the read and command models, results and Hungarian refusal texts (including the new refusal codes) in `src/application/contracts.ts`, `src/data/parent-port.ts`, the data module that holds the to-do reads, and `src/application/parent-facade.ts`; add the access rows in `src/access/role-policy.ts`, `src/application/authorization.ts` and navigation (Feladataim, Teendők); extend the seed (`scripts/db/seed/write.ts` and `data.ts`) with invented tasks and the large seed with a few hundred. Write and run the changed and new Vitest and Node tests for the adapter, facade and seed.
- [x] Step 11: Change the group page: remove the temporary links to the recurring duties and templates lists, add the "Kezelés" link for managers and the group's to-do tasks for readers; change the tests that look for the old links in the same step, keeping today's class names and measurements or changing their tests with them.

### Screens

- [x] Step 12: After the owner approves the Stitch designs, build the screens: the to-do list `/szulo/teendok`, the task page `/szulo/teendok/[id]`, My tasks `/szulo/feladataim`, the management page `/szulo/munkacsoportok/[id]/kezeles` with its four tabs, the task form for coordinators and administrators (`/szulo/munkacsoportok/[id]/kezeles/teendo`, `/admin/teendok`, `/admin/teendok/[id]`), and the "Teendők hozzáadása" pull list on the event page. New `todo-` classes, `data-testid` on interactive elements, button names that include the task topic for screen readers, results announced through the existing status region, phone width and keyboard use.
- [x] Step 13: Write and run the screen, action and access tests, and `tests/browser/todo.spec.ts` for the critical flow (open the list, claim a task, mark it done, see it on My tasks, a manager pulls a task into an event) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome, plus `todo-timing.spec.ts`.

### Closing evidence

- [x] Step 14: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and the timing results against the 2-second and 1-second targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page.
- [x] Step 15: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.
