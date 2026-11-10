# Code Generation Plan: u1-community-foundation

## Summary

- Builds: one community with six working groups, the new role rules, the working-group list screen, and removal of the old import
- Touches: one new migration in `supabase/migrations`, `src/access`, `src/runtime`, `src/data`, `app/admin`, `app/teacher`, `app/szulo`, `scripts/db`, `verification`, and the tests that assert the old groups
- Tests: three new database test files with the fixed list, a new role-by-screen browser specification, a working-group component test, and the existing suites rewritten to the new rules

## Ground Rules

- Build order follows `functional-spec.md`, "Conversion of Existing Code", which lists every existing rule that changes.
- Nothing is committed until the owner asks.
- Measurable targets are inputs: coverage stays at 80/80/80, and the timing ceiling stays at 1500 ms.

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

| Step | Stories |
|---|---|
| 1 to 2 | Set-up for all |
| 3 to 4 | US1.1, US1.2, US1.3, US19.1 |
| 5 to 6 | US1.1, US1.3 |
| 7 to 8 | US1.3 |
| 9 to 11 | US1.2, US1.3 |
| 12 to 15 | US1.1, US19.1, and the Unit's closing evidence |

### Set-up

- [x] Step 1: Start a new branch `feat/u1-community-foundation` from an up-to-date `main`. Other work's uncommitted changes are not carried in. Run the existing suite for a baseline and record the counts in `code-summary.md`.
- [x] Step 2: Verify the runners and the unit-scoped commands in `unit-test-instructions.md`.

### Database

- [x] Step 3: Add one migration that opens and commits its own transaction, covering W1 of `functional-spec.md`: the clean start, the structure change, every rule in "Conversion of Existing Code", the C2 and C6 functions, the working-group list and name-only family list, a database check that a task has its event's scope (BR1.3), an index on tasks with no group, and removal of the import's functions and tables. Family archive, restore and removal also raise the authorization version of the affected accounts, so screens and navigation stop at the next request (NFR3.4).
- [x] Step 4: Write and run the database tests. Add `tests/database/community-structure.test.ts`, `community-roles.test.ts` and `community-duties.test.ts` with the fixed list in `unit-test-instructions.md`, including a forced-failure copy of the migration that proves nothing changes (NFR7.1). Rewrite the existing database tests that assert kindergarten groups. Delete the import's. Extend `directory-timing.test.ts`. Add each new file to `test:database:directory` and the shuffled run, and rename `test:database:notifications-import` to `test:database:notifications`.

### Seed and data access

- [x] Step 5: Update `scripts/db/seed` with the six groups as one list, parent memberships, the new role fixtures (a group administrator who is also a parent, one with two groups, a teacher of the whole community) and community-wide items. Update `scripts/db/reset.ts`. Update the data adapters in `src/data` for optional groups, the working-group list, the family name list, and the three-way schedule read. Remove `src/data/imports.ts`.
- [x] Step 6: Write and run the seed and adapter tests.

### Access policy

- [x] Step 7: Update `role-policy.ts`, `authorization.ts`, `src/runtime/production/access.ts` (all of an administrator's groups), `src/runtime/navigation.ts` and `verification/authorization-matrix.json` together. Group administrators lose records and the import is removed.
- [x] Step 8: Write and run the access tests: `role-policy.test.ts`, the matrix test for every row, and `navigation-access.test.ts`.

### Screens

- [x] Step 9: Build the working-group list at `/szulo/munkacsoportok`, `/teacher/munkacsoportok` and `/admin/munkacsoportok` from the Stitch design the owner approved, with the `workgroup-` class prefix and success, empty, denied and error states.
- [x] Step 10: Change today's screens: the task and event forms' group choice, "Munkacsoport" with a description on Nyilvántartások and no family membership field, the teacher filter, the "Koordinátor" label, and the "Szülői nézet" / "Adminisztráció" link.
- [x] Step 11: Write and run the frontend tests: a working-group component test, updated teacher and admin component tests, and `tests/browser/community-roles.spec.ts`, which walks each screen of `functional-spec.md` as each role, including a role revoked and a parent archived while signed in.

### Import removal and close

- [x] Step 12: Remove the import screen and actions, `src/import-parser`, `scripts/db/import-timing-stage.ts` and its test, the `test:database:import-timing` script, the import tests and browser specification, and the verification rows. Remove `@e965/xlsx` and its lockfile entry, and keep the dependency pin test and dependency scan green.
- [x] Step 13: Confirm the test configuration needs no change: coverage thresholds stay as they are, and removed paths drop out of the lint, format and verification scripts.
- [x] Step 14: Run `npm run verify:local`. On the 30-family set, time the four pages named in NFR9.1 in a browser and record the results in `code-summary.md`.
- [x] Step 15: Update `README.md` and `verification/AUTHORIZATION.md`, then take screenshots for the owner's comparison with the Stitch design.
