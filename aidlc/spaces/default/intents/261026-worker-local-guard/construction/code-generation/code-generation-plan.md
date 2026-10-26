# Code Generation Plan: Worker local-only guard

## Summary

- Builds: `db:worker` runs the same local-only guard as the seed and reset (loopback address, default local password, database identity), without requiring that the migration tracking table already exists.
- Touches: `scripts/db/local-guard.ts`, `scripts/db/worker.ts`, `scripts/db/local-guard.test.ts`, `scripts/db/tooling.test.ts`, `tests/database/worker.test.ts`, `README.md`, and the B5 entry of `follow-ups/minor-findings-plan.md`.
- Tests: about 6 new or changed unit tests (fake database) and 2 changed real-stack tests; the existing suite stays green.

## Traceability

| Plan step | Requirement |
|---|---|
| Step 3 | FR1.1, FR1.2, FR1.3, FR1.4, FR2, FR3, NFR1 |
| Step 4 | FR1.1 to FR1.4, FR2, FR3, NFR2 (and review R-01, R-03, R-04, R-05) |
| Step 5 | FR4, FR5 (and review R-02) |

## Steps

- [ ] Step 1: Project structure and production configuration skeleton. No new files or configuration.
- [ ] Step 2: Verify the existing test runners and record the exact unit-scoped commands (see `unit-test-instructions.md`).
- [ ] Step 3: Business logic - implement. In `scripts/db/local-guard.ts` give `assertLocalStack` and `connectLocalStack` an optional `{ requireManaged }` parameter (default `true`, so seed and reset are unchanged). In `scripts/db/worker.ts` `setupWorker` connects through `connectLocalStack(settings, deps.connect, { requireManaged: false })` inside the existing error-wrapping `try`, so a refusal of either check carries step `guard` plus the worker and schema, and the client of a refused database is closed before any statement.
- [ ] Step 4: Business logic - write and run its tests. `scripts/db/local-guard.test.ts`: with `requireManaged: false` a database without the tracking table passes while the other identity reasons still refuse; the default (seed and reset) still refuses a database without it (review R-05). `scripts/db/tooling.test.ts`: worker tests use a loopback URL with the CLI default password and a fake that answers the identity query (review R-04); new tests: a non-default password is refused before any connection, a database that does not identify itself is refused with the client closed and no drop/create/truncate/delete statement, the error carries worker and schema and no password (review R-03), and a never-migrated stack (no tracking table) still works. `tests/database/worker.test.ts` (real stack): the unreachable-database test uses the default password so it still fails at step `connect`, and a new test shows a wrong password is refused at step `guard` before any connection (review R-01).
- [ ] Step 5: Documentation and traceability. README: `db:worker` refuses anything but the local stack. `follow-ups/minor-findings-plan.md`: B5 done, with the recorded decision (for the worker the default-password check is the effective barrier against a hosted database reached through a tunnel; the identity check adds database name, role and JWT secret; the stricter alternative, requiring the tracking table, was considered and rejected because `db:start` does not migrate and the worker must work as the first command; a local stack with a custom password is now refused, like seed and reset) and the note that `db:migrate` has only the address check. Write `code-summary.md` and `traceability.json`.

- [x] Step 6: Revision after the code review (the person asked for it). R-01: reword the password refusal in `scripts/db/local-guard.ts` so it names the database tools in general instead of only the seed and the reset, and keep the key phrases the B4 test matches (or adjust that test). R-02: in `scripts/db/worker.ts` set the step to `guard` before the guarded connection so `error.step` and `detail.step` agree, then set it back to `connect`-style handling for the connection; assert `detail.step` in the guard tests. Re-run the affected unit tests, the real-stack worker tests and the checks; update `code-summary.md`.

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

Only the business-logic layer applies: database tooling scripts. No database object, endpoint or screen change.
