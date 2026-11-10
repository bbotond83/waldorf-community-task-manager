# Code Generation Plan: u2-first-rota-slice

## Summary

- Builds: the school calendar (changeover date and break weeks), one indoor-cleaning rota per school year (draft, adjust, discard, publish), the duty and place functions the later units use, and the parent's rota overview and duty card
- Touches: one new migration in `supabase/migrations`, `src/data`, `src/access`, `src/runtime`, `app/admin`, `app/szulo`, `app/teacher`, `scripts/db`, `verification`, and the tests that count duties or notices
- Tests: two new database test files with the fixed list, a rota component test, an updated role-by-screen browser specification, and the existing suites extended for rota duties and the new notice kind

## Ground Rules

- Build order follows `functional-spec.md`, "Conversion of Existing Code", and the lock order of `nfr-design/scalability-design.md`.
- Nothing is committed until the owner asks, and no branch is created or switched: U1's uncommitted work stays in the working tree and U2 builds on top of it. The owner decides later how to split the commits.
- Measurable targets are inputs: coverage stays at 80/80/80, and the timing ceiling stays at 1500 ms.
- New screens follow the Stitch design the owner approves first (`team.md`); the owner compares the built screens by screenshot.

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
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
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
  "input_sha256": "sha256:c641c2c8dae704e348414eaa406c7b8535303d2c6e397b1c6b1ba8f4807b7e30",
  "contract_sha256": "sha256:33d6dcb00d5a59adb9d6f9f293812591067e95d72be813d1d9d7269e3fd7c964"
}
```

## Steps

| Step | Requirements |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | AC4.1.1, AC4.1.2, AC5.1.x, AC5.2.x, BR20 to BR27, NFR3 to NFR7, NFR11 |
| 5 to 6 | BR24.1, BR24.2, NFR9, NFR1.2 |
| 7 to 8 | BR25.1, NFR3.5, NFR3.7 |
| 9 to 11 | AC5.1.x, AC5.2.x, AC5.3.1, AC8.1.1, AC8.1.2, NFR8 |
| 12 to 14 | The Unit's closing evidence |

### Set-up

- [ ] Step 1: Stay on the current branch and working tree (U1's uncommitted work is the base; no branch is created or switched). Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [ ] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database

- [ ] Step 3: Add one migration (next file name after `20261047`) that opens and commits its own transaction, covering the "Conversion of Existing Code" table of `functional-spec.md`: `school_years.changeover_date`; the break week, rota plan and rota week tables with a unique plan per school year, versions and read-only access for application roles; the duty origin columns with a partial unique index; `assignments.source` widened with `rota_publish` and the done mark; the `notifications` kind, target and optional task checks with the `rota_published:<plan>:<parent>` dedupe key; the audit actions `rota.publish` and `rota.discard`. Functions, each following the shared convention (revoke all, explicit grant, result envelope, refusals through `U3R00`): the C3 calendar functions and break week add and remove; school year save with the changeover date; make a draft (BR21), change a week, discard with the hand-change count, publish (BR23, locks in the order of `scalability-design.md`, calling `duty_create` per week); `duty_create` (C4); `place_mark_done` (C18); the three internal place functions (C5); the rota overview and duty card reads; `notification_list`, `notification_link` and `notification_mark_read` for a notice with no task. Every one of today's task change, assign, remove, sign-up, swap, cancellation and decision functions, and family archiving, gets the shared `DUTY_ROTA_MANAGED` check, and today's task lists and the teacher schedule treat rota duties as specified.
- [ ] Step 4: Write and run the database tests. Add `tests/database/rota-calendar.test.ts` (BR20) and `tests/database/rota-plan.test.ts` (BR21 to BR27) with the fixed list in `unit-test-instructions.md`, including the forced-failure publish with a test-only trigger on `notifications`, the duplicate-duty test through `duty_create`, the two-at-once draft, publish and hand-change tests, and a migration test over seeded data with one row per change. Extend the existing duty, notification and lifecycle tests for rota duties and the new notice kind. Add each new file to `test:database:directory` and to the shuffled run.

### Seed and data access

- [ ] Step 5: Update `scripts/db/seed` so the 2026-2027 year has a changeover date and invented break weeks (no plan is seeded). Add a rota port and adapter in `src/data` (calendar, plan, weeks, publish, overview, duty card) with the Hungarian message mapping for each refusal code, and give the notice list the new kind.
- [ ] Step 6: Write and run the seed and adapter tests, including the exact field list the overview returns (NFR1.2).

### Access policy

- [ ] Step 7: Update `role-policy.ts`, `authorization.ts`, `src/runtime/navigation.ts` and `verification/authorization-matrix.json` together for the calendar, rota, overview and duty card, and the proposed teacher overview.
- [ ] Step 8: Write and run the access tests: `role-policy.test.ts`, the matrix test for every new row, and `navigation-access.test.ts`.

### Screens

- [ ] Step 9: After the owner approves the Stitch designs, build `/admin/tanev` (school year, changeover date, break weeks), `/admin/beosztas` (draft, adjust, discard, publish), `/szulo/beosztas` (overview), `/szulo/beosztas/[id]` (duty card) and the teacher overview, with `admin-` and `parent-` classes and success, empty (nothing published), denied and error states.
- [ ] Step 10: Leave rota duties out of today's task lists and forms, and show the rota text in the notice list.
- [ ] Step 11: Write and run the frontend tests: a rota component test, updated list tests, and `tests/browser/rota.spec.ts`, which walks each new screen as each role, including a draft that parents cannot see.

### Close

- [ ] Step 12: Confirm the test configuration needs no change: coverage thresholds stay as they are.
- [ ] Step 13: Run `npm run verify:local` (with the local settings loaded). On the 30-family set, time the pages named in NFR9.1 and a full-year publish, and record the results in `code-summary.md`.
- [ ] Step 14: Update `README.md` and `verification/AUTHORIZATION.md`, then take screenshots for the owner's comparison with the Stitch design.

### Review fixes (the owner asked for them when rejecting the Unit checkpoint)

The design is unchanged: `functional-spec.md` W6 and BR24.2 already say a super admin may open any card and a working-group admin uses the parent overview. These steps bring the code in line.

- [ ] Step 15: Super admin duty card. Add a read-only duty card at `/admin/beosztas/[id]` that reuses the existing card view and parts; update the `AUTH-ROTA-DUTY-SUPER-ADMIN-ALLOW` matrix row, `role-policy.ts`, `authorization.ts`, `verification/AUTHORIZATION.md` and the access tests together.
- [ ] Step 16: Working-group admin. Add the menu link to the rota overview (`/szulo/beosztas`) and make the matrix, summary and tests say the same: the card is open to the holding family, which includes a group admin who is a parent of that family.
- [ ] Step 17: Teacher menu. Keep `/teacher/beosztas` and leave one clearly worded entry per purpose instead of the two similar ones ("Beosztás" and "Takarítási beosztás"); update the navigation and the specs that name or count teacher entries.
- [ ] Step 18: Write and run the tests for steps 15 to 17, run `npm run verify:local` (local settings loaded), then update `code-summary.md` (a "Review fixes" section) and `source-manifest.json`.
