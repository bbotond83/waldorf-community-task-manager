# Code Generation Plan: Password reset clears the lockout

## Summary

- Builds: `completePasswordReset` clears the failed-sign-in counter right after the password changed, before it ends the other sessions.
- Touches: `src/identity/reset.ts`, `src/identity/reset.test.ts`, and the B2 entry of `follow-ups/minor-findings-plan.md`.
- Tests: about 4 new or changed unit tests in the existing colocated file; the existing suite stays green.

## Traceability

| Plan step | Requirement |
|---|---|
| Step 3 | FR1.1, FR1.2, FR1.3, FR2.1, FR2.2, FR2.3, NFR1, NFR2 |
| Step 4 | FR1.1, FR1.2, FR1.3, FR2.1, FR2.2, FR2.3, NFR1, NFR3 (and review R-01, R-02) |
| Step 5 | FR3 (and review R-03) |

## Steps

- [x] Step 1: Project structure and production configuration skeleton. No new files or configuration.
- [x] Step 2: Verify the existing test runner and record the exact unit-scoped command (see `unit-test-instructions.md`): `node --experimental-strip-types --test src/identity/reset.test.ts`.
- [x] Step 3: Business logic - implement. In `src/identity/reset.ts` move the `sign_in_attempt_clear` call to directly after the successful password update and before the `sessions_remove` loop; arguments unchanged; its result stays ignored (a failed result changes nothing). The comment above the session removal and the new call explain the order. Review R-01: an unexpected exception from the clear is out of scope because the admin port returns failures as results.
- [x] Step 4: Business logic - write and run its tests. In `src/identity/reset.test.ts`: update the success test to the new call order (clear first, then `sessions_remove`); add a test that a reset whose session removal fails still made the clear call, before the removal attempts, and still returns `dependency-failure-terminal` with `RESET_SESSIONS_NOT_ENDED`, the sign-out and the `follow_up_failed` event; add a test that a failing clear result leaves a successful reset successful and still ends the other sessions; add a test (review R-02) that no clear call happens on a rejected code, a rejected password rule and a failed password update; and one where both the clear and the session removal fail and the terminal result is unchanged.
- [x] Step 5: Documentation and traceability. In `follow-ups/minor-findings-plan.md` mark B2 done and record the accepted limit (other sessions can stay open up to 30 days when their removal fails; owner: the repository owner, Botond; revisit if the session lifetime changes or a session-revocation fix is planned). Write `code-summary.md` and `traceability.json`.

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
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
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
  "input_sha256": "sha256:3d292c6045d13da5e4d7456ce512bed1710e7c19d4cd1fcfbb8c23797b5346c2",
  "contract_sha256": "sha256:ccfc2d241c3297baee8acc2adf0300e8dd8d3a3c089e4a5c084dd757a212e135"
}
```

Only the business-logic layer applies: one function in `src/identity/reset.ts`. There is no database, repository, endpoint or screen change.
