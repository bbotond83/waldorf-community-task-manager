# Code Generation Plan: u4-working-groups

## Summary

- Builds: joining and leaving working groups, a group page with its members under the directory rules, super admins appointing and revoking coordinators with a notice and email, the old direct grant path closed, the C7 facts and the C16 removal steps, and the lifecycle fix that ends coordinator rights
- Touches: one new migration `supabase/migrations/20261051_working_groups.sql`, `src/data/working-groups.ts` and its port, `src/access`, `src/runtime/navigation.ts`, three new group pages under `app/szulo|teacher|admin/munkacsoportok/[id]`, the list pages, `scripts/db/seed`, `verification`, and the role, grant, catalogue, seed and lifecycle tests that change
- Tests: a new database test file with the fixed list and four 50-run race tests, changed role, grant, catalogue, directory, lifecycle and seed tests, port and component tests, a matrix-row unit test, and a role-by-route browser specification

## Ground Rules

- **Lock order.** The build follows the one lock order in `nfr-design/scalability-design.md`: family, accounts, parents, memberships ascending, grants ascending, then authorization-version rows. U4's lifecycle step sits after the family lock and before the account-deactivation loop.
- **No commits.** Nothing is committed until the owner asks, and no branch is created or switched.
- **Fixed targets.** Coverage stays at 80/80/80. The group pages load in under 2 seconds on `db:seed:large`. No target is lowered to make a step pass.
- **Screens.** The group page and the group admin page follow the Stitch designs the owner approves first. The owner compares the built screens by screenshot. Existing browser specs keep their class names, or change in the same step.
- **Review findings built in:**
  - The once key is `<kind>:<grant id>`.
  - U4's removal block takes its own family, account and parent locks and runs before U3's block.
  - `end_admin` is called only for grants that exist.
  - `create or replace` keeps a function's old grants, so `revoke all` is restated after every redefined function.
  - Leave answers the same denied result for someone else's membership and for a missing one.
  - The matrix gets exact rows per route and role, not wildcard rows.
  - Join turns a unique-index violation into ALREADY_MEMBER.
  - The `working_group` facts function still answers for an archived group.
- **Data.** All data is invented. Every test address goes in `scripts/verification/privacy-allowlist.json`.

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

The business rules live in the database functions (`team.md`), so the "business logic" layer of the contract is built and tested with the database layer in Steps 3 and 4.

| Step | Stories and requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | US2.1, US2.2, US2.3 (AC2.1.1 to AC2.3.4), BR40 to BR44, NFR3.10 to NFR3.15, NFR4.10 to NFR4.17, NFR5.8 to NFR5.12, NFR7.12 to NFR7.18, NFR10.5, NFR10.6, NFR11.4 to NFR11.6 |
| 5 to 6 | US2.1, US2.3 (seed), NFR1.8, NFR6.8 |
| 7 to 8 | US2.1, US2.2, US2.3 (port and messages), NFR4.12 |
| 9 to 10 | US2.2, US2.3 (routes and rights), NFR3.16 |
| 11 to 13 | US2.1, US2.2, US2.3 (screens), NFR4.13, NFR8.3, NFR8.4, NFR9.8 |
| 14 to 16 | The Unit's closing evidence |

### Set-up

- [ ] Step 1: Stay on the current branch and working tree; no branch is created or switched. Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [ ] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database and business rules

- [ ] Step 3: Add one migration, `supabase/migrations/20261051_working_groups.sql`, that opens and commits its own transaction.
  - **Membership table.** Add `version integer not null default 1` and `end_reason text` (`left` or `removed`). Fill `end_reason = 'left'` on rows that have already ended, then add a check that `end_reason` is set exactly when the status is ended. `created_at` serves as the join time.
  - **New functions.** Each follows the C1 template (active session, idempotency, result envelope, refusals through `U3R00`), starts with `revoke all` and pins its search path.
    - `working_group_detail(group_id)` (BR42.1 to BR42.5)
    - `working_group_join(key, group_id)`: family then parent lock for share, and the unique violation answered as ALREADY_MEMBER (BR40.1 to BR40.3)
    - `working_group_leave(key, membership_id, version)` (BR40.4 to BR40.6)
    - `coordinator_appoint(key, membership_id, version)` and `coordinator_revoke(key, membership_id, version)`: the check order of `rules.md`, `notice_send` with the once key `<kind>:<grant id>` (BR41.1 to BR41.6)
    - `group_members` and `group_coordinators` (BR43.1)
    - `working_groups_removal_preview` and `working_groups_removal_apply`: these take their own family, account and parent locks (BR44.1, BR44.2)
    - The contact helpers `directory_parent_shares` and `directory_parent_email`
    - The `working_group` facts function
  - **Changed functions.**
    - `drop function end_admin(uuid, uuid)`, then create `end_admin(uuid, uuid, text default 'revoked')` with the detail `grant:group_admin:<reason>`.
    - The general role-change function refuses group_admin for adding and revoking with GRANT_USE_COORDINATOR_ACTION, after its authorization check (BR41.7).
    - `directory_list` moves onto the contact helpers.
    - `lifecycle_run_core` gets U4's step after the family lock and before the deactivation loop: lock the accounts, parents and memberships, then end the existing grants with reason `removed` (BR41.8, NFR11.4).
  - **Notice registries.** Add the target type `working_group` and the kinds `coordinator_appointed` ("Koordinátor lettél:", label "Koordinátori kinevezés") and `coordinator_revoked` ("Megszűnt a koordinátori jogod:", label "Koordinátori jog visszavonása"), with `added_by` set to `u4-working-groups`.
  - **Grants.** After every new and redefined function, restate `revoke all` and the intended grants. Only the page read and the four commands go to `authenticated`.
- [ ] Step 4: Write and run the database tests.
  - **New file `tests/database/working-groups.test.ts`.** It covers the fixed list for each BR40 to BR44 rule, as tabled in `unit-test-instructions.md`. It also holds:
    - the "who sees what" matrix, and the comparison of the directory and the group page
    - the appoint-then-revoke test (two notices, two emails)
    - the archived-group cases
    - the invariant helper, run after every writer
    - the migration-over-seed test (counts, backfill)
    - the four 50-run race tests: join against removal; leave, revoke and appoint each against the lifecycle step, with every parent of the family on a linked account
    - the timing tests for the page read and the commands on `db:seed:large`
  - **Changed files.**
    - `community-roles.test.ts`: fixtures insert grants and memberships directly; BR3.11 and BR3.12 use `coordinator_revoke`; new refusal cases.
    - `identity-grants.test.ts`: the denied case kept, refusal cases added.
    - `identity-catalogue.test.ts`: every new function, and `end_admin`'s new signature, with its grants.
    - The directory and lifecycle tests: coordinator cases added.
  - **Race tests in their own file.** The four race tests go in a separate file, `tests/database/working-groups-races.test.ts`, so they can be run on their own.
  - **Registering the files.** Add both files to `test:database:directory` in `package.json` and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`, as `team.md` requires. Because the race file sits in both lists, its loops run twice per verification; that is accepted, and the time is recorded in `code-summary.md`.

### Seed and data access

- [ ] Step 5: Update `scripts/db/seed` and `db:seed:large`. Each working group gets invented members, and each group gets one invented coordinator with a linked account and a grant made through the migration's functions. Add the test addresses to the privacy allowlist.
- [ ] Step 6: Write and run the seed tests. Change `seed.test.ts`, `seed-timing.test.ts`, `reset.test.ts` and the browser fixtures for the new counts.

### Data port and messages

- [ ] Step 7: Extend `src/data/working-groups.ts` and its port. Add the group detail read, the four commands with the C1 key and version, and the Hungarian message map for every refusal code in `rules.md`. Wire them into the parent, teacher and admin ports.
- [ ] Step 8: Write and run the port tests, colocated as `src/data/working-groups.test.ts`. They cover success, each refusal code mapped to its text, a withheld phone and email absent from the view model, and an infrastructure error mapped at the boundary.

### Access policy

- [ ] Step 9: Update `role-policy.ts`, `authorization.ts`, `src/runtime/navigation.ts` and `verification/authorization-matrix.json` together. The three `[id]` routes get exact rows per role, and the list pages link each card to its group page.
- [ ] Step 10: Write and run the access tests:
  - `role-policy.test.ts`
  - a new `tests/unit/working-group-matrix.test.ts`, which fails unless each of the three routes has an exact row for every role with the expected result (wildcard rows do not count)
  - `navigation-access.test.ts`

### Screens

- [ ] Step 11: After the owner approves the Stitch designs, build the three group pages (`app/szulo/munkacsoportok/[id]`, `app/teacher/munkacsoportok/[id]`, `app/admin/munkacsoportok/[id]`), using `parent-group-*`, `teacher-group-*` and `admin-group-*` classes.
  - **Every page.** Name, description, school year, the no-coordinator notice, and the member list with the "Koordinátor" label and the name linked to the directory card.
  - **Parent page.** Csatlakozom or Kilépek, and the coordinator's confirmation before leaving.
  - **Admin page.** "Koordinátorrá teszem" or "Visszavonom a jogot" on each row, and the note that coordinators must be members.
  - **States.** The success, empty, unavailable, denied, conflict and error states are kept separate.
- [ ] Step 12: Link the list pages' cards to the group pages, and update any navigation entry.
- [ ] Step 13: Write and run the frontend tests.
  - Component tests for each page and its states.
  - A new browser spec `tests/browser/working-groups.spec.ts`: each route as each role, join and leave as a parent, appoint and revoke as a super admin, phone width, keyboard, and an accessibility check.
  - A new `tests/browser/working-groups-timing.spec.ts`: both pages on `db:seed:large`.

### Close

- [ ] Step 14: Confirm the test configuration needs no change (coverage thresholds stay as they are). Amend `contract-summary.md`:
  - C16: U4's removal block runs before U3's directory block.
  - C7: name `group_members` and `group_coordinators`.
- [ ] Step 15: Run `npm run verify:local`, with the local settings loaded and leftover servers stopped. Record the timings in `code-summary.md`.
- [ ] Step 16: Update `verification/AUTHORIZATION.md`, and write `code-summary.md`, `source-manifest.json` and `traceability.json`. Then take screenshots for the owner's comparison with the Stitch designs, checking each one for an error page first.
