# Code Generation Plan: u7-swaps-and-duty-changes

## Summary

- Builds: swaps between families across any kind of duty with a reason, the other family's accept or decline, withdrawal, daily expiry, an administrator's reassignment of a published duty, reversal of an applied swap, cancellations decided by an administrator, and the functions later units call (C9 check, C16 removal pair, C19 block)
- Touches: one new migration in `supabase/migrations`, the swap code in `src/data`, `src/application` and `src/access`, the parent swaps page, the new administrator swap list, the reassign action on the rota screen and the approvals screen in `app/`, `scripts/db/seed`, `verification`, `contract-summary.md`, and the catalogue tests
- Tests: six new database test files with the fixed list (schema and C5/C11 changes, proposing and answering, administrator commands, races, expiry and removal, timing), updated kernel swap, catalogue, adapter, facade, policy and access tests, and a new swaps browser specification

## Ground Rules

- Build order follows `functional-spec.md` ("Conversion of Existing Code") and the lock order of BR77.1 and `nfr-design/scalability-design.md`: duty rows ascending, then place rows ascending, then the request row, all in one pass; only then C5 and C11, whose own locks find rows already held. No command adds a family row lock just to check a family's standing (project rule, learned 2026-11-17).
- All database work goes in one new forward-only migration, `supabase/migrations/20261059_swaps_and_duty_changes.sql`, that opens and commits its own transaction; steps 3, 5, 7 and 9 add to this same file. Applied migration files are never edited.
- Nothing is committed until the owner asks, and no branch is created or switched.
- Measurable targets are inputs: coverage stays at 80/80/80; the read and command timings of `nfr-design/performance-design.md` (NFR9.1 to NFR9.3) are measured as the median of 5 warm runs on the `db:seed:large` set; no target is lowered to pass.
- New screens follow the Stitch designs the owner approves first (`team.md`); step 13 does not start until the owner has approved the designs for the parent swaps page, the proposal form, the administrator swap list, the reassign action and the approvals screen. The owner compares the built screens by screenshot. Existing classes keep their names (`parent-` and `admin-` prefixes); existing browser specs keep their class names or change in the same step.
- All data is invented; every test address or phone number is added to `scripts/verification/privacy-allowlist.json`.
- Refusal codes for the new rewritten functions follow `security-design.md`: a missing request or place and "not yours" both answer `denied` / `authorization_denied`, so the kernel tests that assert `request_not_found` or `place_not_found` change in step 8 in the same pull request.
- Every command of this unit ends through `platform_finish_operation` (stored result for successes and denials, denied audit entry), looks up its idempotency key first, starts with `revoke all` followed by an explicit `grant execute` (or none for internal functions), pins its search path and returns the C1 envelope.
- `swap_decide` loses its grant (BR75.4); the approvals screen and its adapter drop the swap branch.
- The notice kinds `swap_withdrawn`, `swap_expired`, `swap_cancelled`, `swap_reversed` and `duty_reassigned`, the audit actions `swap.reversed` and `duty.reassigned`, and the facts function `notice_facts_change_request` are added without touching existing rows (`entities.md`).
- The race tests repeat each two-at-once case 20 times inside the test file, because the shuffled run shuffles files once and does not repeat them.
- Contract deltas (C5 `place_add`, C9 check row, C11 no-family change, C16 block, C19 block) are written into `contract-summary.md` in this unit.

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
| 3 to 4 | Schema, notices, audit values, C5 `place_add`, C11 no-family change, closed table read: BR71.3, BR74.1, BR76.2, BR77.3, NFR1.3, NFR3.4, NFR3.5 |
| 5 to 6 | US8.2 and US8.3 on the family side (AC8.2.1 to AC8.2.3, AC8.2.5, AC8.2.6, AC8.2.8, AC8.2.9, AC8.3.1), BR70.1, BR70.3, BR71, BR72, BR77.1, BR77.2, NFR3.9 |
| 7 to 8 | US5.4, the administrator parts of US8.2 and US8.3 (AC5.4.1 to AC5.4.6, AC8.2.4, AC8.2.10, AC8.3.2), BR70.2, BR74, BR75, BR76, NFR3, NFR4 |
| 9 | Two people at once, all commands: AC8.2.9, BR77.1, NFR5 |
| 10 to 11 | AC8.2.7, BR73, BR77.3, BR77.4, NFR10.1, contracts C9, C16 and C19, seed, matrix and timings (NFR9.1 to NFR9.3) |
| 12 to 14 | All three stories on screen, NFR8, NFR9.4 |
| 15 to 16 | The unit's closing evidence |

### Set-up

- [x] Step 1: Stay on the current branch and working tree (no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database: schema, notices, closed table read and the C5 and C11 changes

- [x] Step 3: Start `supabase/migrations/20261059_swaps_and_duty_changes.sql` (own transaction). In this step: widen `change_requests` as `entities.md` lists (source and target family, applied versions, ended reason, decided by and at, the new statuses `expired`, `cancelled` and `reversed`, the row checks that a swap names its target place, duty, family and version and a cancellation names none, the reason up to 500 characters); convert existing rows (an open swap whose source is `swap_pending` gets its stored versions raised by one; an old `approved` swap stays as history with no applied versions); drop the policy `change_requests_read` and revoke `select` on the table from signed-in accounts; add the five notice kinds, the facts function `notice_facts_change_request` (reads ended requests too, returns nothing for an unknown id), the audit actions `swap.reversed` and `duty.reassigned`, and the rota week empty reason `cancelled`; add C5 `place_add(duty, family)` with the closed-duty and already-assigned checks of `place_reassign`, no grant; change `coordination_withdraw_requests` to return both places of a swap while keeping the status `withdrawn`; change C11 `rota_adjust_picks_after_change` to accept a null new family for a `rota_week` place (week empty with reason `cancelled`, a picking week's pick deleted and its slot reassigned to the weekend family unless that Saturday has begun, a weekend slot place with a null family raises an error).
- [x] Step 4: Write and run `tests/database/swaps-schema.test.ts`: the row checks attacked as the database owner (NFR7.3), the conversion of old open and approved rows, that no signed-in role can select from `change_requests` (permission error for parent, group admin, super admin, teacher), `place_add` allowed and refused (closed duty, family already on the duty, no room, no grant for any signed-in role), `coordination_withdraw_requests` returning both places, the C11 no-family change for a free week, a picking week with and without a pick, a weekend whose Saturday has begun, and the error for a weekend slot place, the facts function for each of the five kinds plus the existing three, and the migration applied over a seeded database with existing row counts unchanged. Add the file to its `test:database:*` script and to `DATABASE_TEST_FILES` in `scripts/db/shuffled-tests.ts`.

### Database: proposing, answering, withdrawing and the family reads

- [x] Step 5: In the same migration, rewrite into the DutyChanges block (BR70.1, BR70.3, BR71.1 to BR71.5, BR72.1 to BR72.5, BR73.1 command side, BR74.3, BR77.1, BR77.2) `swap_candidates`, `swap_request`, `swap_respond` (accept applies in one transaction in the order of BR72.2 and stores the applied versions; decline), `swap_withdraw` and `swap_incoming`, keeping the existing names and dropping the old `_core` bodies; fold `swap_standing_check` into BR71.4's C10 plus C11 check; drop the same-group rule and the `DUTY_ROTA_MANAGED` refusal for swaps; lock duties, then places, then the request ascending in one pass; a replayed `swap_respond` returns the request's current status as the outcome.
- [x] Step 6: Write and run `tests/database/swaps-propose-answer.test.ts` with the fixed list for propose, accept, decline and withdraw: allowed (any kind of duty and any group), refused (weekend slot, place already in a request, started duty, changeover clash, same-week clash with the plain reason), out of reach (teacher, a parent of neither family, a made-up id answering the same denied refusal as a real one), outdated screen (place version and request version), repeated click (rows counted, the stored result, a used key with different inputs, another account with the same key), the pick following the duty or the slot going back to the weekend family, the notice recipients and text (the reason only in `swap_requested`), and the reads `swap_candidates` and `swap_incoming` returning display names only and the reason only to the two families. Add the file to the scripts.

### Database: administrator commands, cancellations and the closed approvals read

- [x] Step 7: In the same migration add `duty_reassign` (super admin for rota duties, group reach otherwise; open swap or cancellation on the place ended first with `swap_cancelled` and `cancellation_decided` notices; `place_reassign`, or `place_add` for a flagged empty week; C11 with the new family; `duty_reassigned` notices; audit `duty.reassigned`), `swap_reverse` (versions and started-duty checks, same rules with families the other way round, `swap_reversed` notices, audit `swap.reversed`), `swap_list` (flag "can be reversed now" computed in the query), `cancellation_request`, `cancellation_decide` (request marked first, then `place_release`, then the C11 no-family change for a rota duty; `cancellation_decided` notice; audit `approval.approve` or `approval.reject`; `CANCELLATION_EXPIRED` for a started duty) and `cancellation_list` for the approvals screen; revoke execute on `swap_decide`. Denials end through `platform_finish_operation`; an audit entry that cannot be written rolls the change back.
- [x] Step 8: Write and run `tests/database/swaps-admin.test.ts` with the fixed list for reassign, reverse, request cancellation and decide cancellation: allowed (super admin on a rota duty, group admin on a manual duty), refused (working-group admin on a rota duty, started duty, changed since, rule clash), out of reach (parent, teacher, admin outside the group, a swap with one rota duty read only by a super admin), outdated screen, repeated click (one audit entry only), the audit entry and its rollback with a temporary failing trigger inside the test, the flagged week and the pick returning to the weekend family, filling the flagged week with `duty_reassign`, `swap_decide` no longer callable, and one denied audit entry per command for an unauthorised account. Update the kernel tests that asserted the old codes or the old group and rota-duty rules (`tests/database/kernel-swaps.test.ts`, `coordination-functions.test.ts`, `community-duties.test.ts`, `community-roles.test.ts` and any other failing file named by the run) in the same step. Add the file to the scripts.

### Database: two people at once

- [x] Step 9: Write and run `tests/database/swaps-races.test.ts`: two acceptances, an acceptance and a withdrawal, an acceptance and a reassignment, an acceptance and an expiry run, two proposals for the same place, a cancellation request against a swap request on the same place, two reassignments of one duty, a reversal against a reassignment, each in both orders and repeated 20 times with no deadlock and the second command refused with the rule it now breaks. Add the file to the scripts.

### Database: daily check, removal block and later units

- [x] Step 10: In the same migration: `dutychanges_swap_expiry_check` (set-based updates per kind, places returned to active, notices with once keys, internal, never granted to a signed-in role) with its registry row (check `swap_expiry`, run kind `daily`, after the existing checks, last lock step), and `dutychanges_removal_preview` and `dutychanges_removal_apply` (C16: open requests of the removed family cancelled with `swap_cancelled`, ended requests cleared of the person's fields and reasons, counts only in the preview, lock order family, then places ascending); document the C19 block that U8's `slot_give_up` joins (it refuses a place in an open request).
- [x] Step 11: Write and run `tests/database/swaps-for-later-units.test.ts`: the check just before and after the start of the earlier duty in both clock-change weeks, a swap and a cancellation expiring, running twice and two runs at once changing nothing more, `swap_expired` once per request, the commands answering `SWAP_EXPIRED` and `CANCELLATION_EXPIRED` before the run, a failing run recorded while other checks still run; the removal pair for a parent, a family and a subject with nothing, rows kept and links cleared, counts only in the preview, and no grant for any signed-in role. Extend `tests/database/identity-catalogue.test.ts` (elevated-function list, policy-test list, scope-probe decisions) and `src/data/notification-use-cases.test.ts` for the new functions, notice kinds and the retired `swap_decide`, and check the existing timed-run tests still pass with the new registry row. Add the file to the scripts.
- [x] Step 12: Extend the large seed (`scripts/db/seed`) with a published year of all four rotas, invented event and manual duties and 200 change requests in every status, and the ordinary seed with a small invented set; add the swap and cancellation rows to `verification/authorization-matrix.json` for every role and retire `swap_decide` there; add the privacy allowlist entries; update `contract-summary.md` with the deltas in the ground rules; write and run `tests/database/swaps-timing.test.ts` (candidates, incoming, swap list, one accept and the daily check against the targets, median of 5 warm runs after one warm-up) and add it to the scripts.

### Application layer and screens

- [x] Step 13: Update the swap and cancellation code in `src/data` (`parent-port.ts`, `admin-tasks.ts`, new reads and commands, no direct table read), `src/application` (`parent-facade.ts`, contracts, message mapping with the Hungarian text for every refusal code including the denied state replacing `request_not_found`), `src/access` (`role-policy.ts`, `authorization.ts`, navigation with the new administrator swap list) and the Server Actions under `app/szulo/cserek`, `app/admin/beosztas` and `app/admin/jovahagyasok`; remove the swap branch of the approvals adapter; write and run the Vitest and Node tests for the port, facade, mapping, policy and seed, including a test that counts the data calls of each page (NFR9.4), and update `src/data/parent-port.test.ts`, `admin-port.test.ts`, `src/access/request-actions.test.ts` and `tests/unit/navigation-access.test.ts`.
- [x] Step 14: Build the screens after the owner approves their Stitch designs: the parent swaps page `/szulo/cserek` (incoming and own requests with reason, status and accept, decline and withdraw; expired and ended ones shown with why), "Csere kérése" from a duty card (choose the other place with a date filter, optional reason with the Hungarian hint that the other family and the administrators see it, plain refusal text), the administrator swap list with the reverse action and the "changed since" message, "Átadás másik családnak" and "Család kijelölése" on a rota duty in `/admin/beosztas`, and the approvals screen listing cancellations only with the reason and what approving a rota duty does. Use the `parent-` and `admin-` classes, add `data-testid` to interactive elements, show error and denied states only after a successful read, and keep all text Hungarian in the copy module.
- [x] Step 15: Write and run the screen, action and access tests and a browser specification `tests/browser/swaps.spec.ts` for the critical flow (propose with a reason, the other family accepts, an administrator reassigns a rota duty and reverses a swap) with no serious or critical accessibility violations in Chromium, Firefox and mobile Chrome; update `parent-cancellation-style.spec.ts`, `admin-approvals-style.spec.ts` and `parent-web.spec.ts` where the changed screens alter them.

### Closing evidence

- [x] Step 16: Run the full `npm run verify:local` with the local settings loaded and no leftover app server; record the counts, coverage and the timing results against the targets on the large seed in `code-summary.md`; send the owner screenshots of each built screen after checking none shows an error page; list the functions that no screen calls yet (daily check, removal pair, C19 block) as tested directly.
- [x] Step 17: Write `code-summary.md`, `source-manifest.json` and `traceability.json` for this unit.
