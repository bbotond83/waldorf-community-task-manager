## Summary

- Builds: a sign-out button and the Hungarian guidance on the standalone "Nincs jogosultság" page.
- Touches: `app/hozzaferes-megtagadva/page.tsx` (one page), `tests/coverage/app-entrypoints.test.tsx` (one regression test).
- Tests: 1 new regression test (fails before the change, passes after), plus the existing suite kept green.

# Code Generation Plan: sign-out on the no-access page

Source requirements: `inception/requirements-analysis/requirements.md` (FR1, FR1.1, FR1.2, FR2, FR2.1, FR3, FR5, NFR1 to NFR4).

Design choice: reuse `AccessStateExit` (`app/_identity/AccessStateExit.tsx`), which already renders the guidance text and the existing `SignOutButton` for the other no-access screens. No new sign-out logic is written.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n- **Methodology evidence**: Unchanged. Tests sit next to the code or in `tests/` in the same pull request, and each fix commit carries its regression test. No history shows tests written ahead of the code as a rule.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source (Vitest with the Istanbul provider, thresholds 80/80/80 in `vitest.config.ts`).\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.\n\nFor a style-only change the existing gates are the safety net, and they react to styling: browser specs assert computed styles, element sizes, layout at several widths and class hooks, and `tests/unit/design-tokens.test.ts` reads colour tokens only in the form `--name: #rrggbb` inside `:root` of `app/globals.css`. Restyled screens keep those class names, measurements and token format, or the matching tests change in the same pull request.\n\nWe check how restyled screens look by owner review: the owner compares each restyled screen with the Stitch design using screenshots provided by the assistant. We do not add automatic picture-comparison tests.\n\nWe want an automated check on `app/globals.css` (a CSS linter such as Stylelint wired into the project's blocking checks), because nothing but the browser specs catches style mistakes today. This is new work for this change and is planned in later stages.\n\nWe want the floating `latest` versions of `react`, `react-dom`, `zod`, `@axe-core/playwright` and `@playwright/test` pinned during this work, so check results do not change without a code change. This is new work, planned in later stages."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
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
  "input_sha256": "sha256:2c2ee1923a6e7080c60a12671ce9b2284c962c311d5bed5becad163e92779c80",
  "contract_sha256": "sha256:5b3270dea828d8355cf4cf0deaab79a4872948941c42e9fcac5beb7ed9608e7a"
}
```

## Steps

- [x] Step 1: Write the regression test in `tests/coverage/app-entrypoints.test.tsx`. It renders the standalone page and expects the sign-out button (`data-testid="sign-out-button"`) and the guidance text (`data-testid="access-guidance"`). Run it once before Step 2 and confirm it fails. Traces to FR1, FR2, NFR4.
- [x] Step 2: In `app/hozzaferes-megtagadva/page.tsx`, render `<AccessStateExit explain />` after the existing link to the home page. Keep the heading, the existing sentence and the link unchanged. Traces to FR1.1, FR1.2, FR2, FR2.1, FR3.
- [x] Step 3: Run the scoped test file and confirm the regression test now passes. Traces to NFR4.
- [x] Step 4: Run the quality checks on the changed files only: Prettier check, ESLint on the two changed files, strict TypeScript check, and the scoped coverage run. Traces to NFR3.
- [x] Step 5: Record the accessibility check result for the page (no serious or critical axe violations). Traces to NFR1.

## Files

- `app/hozzaferes-megtagadva/page.tsx`: modified.
- `tests/coverage/app-entrypoints.test.tsx`: modified (one new test).
- No new files in the application.
