# Code Generation Plan: Audit purge isolation

## Summary

- Builds: a new migration that caps the audit purge at 5000 rows per call and isolates a purge failure inside the housekeeping job.
- Touches: `supabase/migrations/20261045_audit_purge_isolation.sql`, `tests/database/audit-purge.test.ts`, `tests/database/identity-housekeeping.test.ts`, `tests/database/migrations.test.ts`, and the B1 entry of `follow-ups/minor-findings-plan.md`.
- Tests: about 7 new database tests on the real local stack (CI runs them); the existing suite stays green.

## Traceability

| Plan step | Requirement |
|---|---|
| Step 3 | FR1.1, FR1.2, FR1.3, FR2.1, FR2.2, FR3.1, FR3.2, FR4 |
| Step 4 | FR1.1, FR1.2, NFR2 (and review R-02, R-04) |
| Step 5 | FR2.1, FR2.2 (and review R-03) |
| Step 6 | FR4, NFR1 |
| Step 7 | FR3.3, FR5 (and review R-01, R-04, R-05) |

## Steps

- [ ] Step 1: Project structure and production configuration skeleton. No new folders or configuration; the new file sits beside the existing migrations and the migration runner picks it up by name.
- [ ] Step 2: Verify the existing test runner and record the exact unit-scoped commands (see `unit-test-instructions.md`). The database tests use `node --test` against the local stack; CI starts the stack.
- [ ] Step 3: Data model / database behavior - implement. `supabase/migrations/20261045_audit_purge_isolation.sql` redefines `audit_purge()` (delete the oldest 5000 aged rows by id, same signature, same system-caller-only rule, same setting) and `identity_housekeeping()` (purge inside a `BEGIN ... EXCEPTION WHEN OTHERS` block; result carries `audit_purge_failed`), and restates the function rights.
- [ ] Step 4: Data model / database behavior - write the failure-isolation tests. In `tests/database/identity-housekeeping.test.ts`: a failing purge (a delete trigger that always raises, dropped afterwards) leaves the other clean-up committed, reports `audit_events_purged` 0 and `audit_purge_failed` true with no error text, leaves the aged event in place, and the next run purges it; the success case reports `audit_purge_failed` false. Also (review R-02): after the failed purge the deletion setting is not `on` and an owner delete of an aged row is still refused.
- [x] Step 5: Data model / database behavior - write the cap tests. In `tests/database/audit-purge.test.ts` (review R-03): 5001 aged rows give 5000 deleted then 1 deleted, with the survivor being the youngest aged row; exactly 5000 aged rows leave none; recent rows are never touched; updates and deletes outside the purge are still refused (the existing tests keep covering this and stay green).
- [x] Step 6: Migration tracking test. In `tests/database/migrations.test.ts`: the new file is applied after the purge file in the default and a worker schema, and a second run changes nothing. The elevated-function catalogue test (`identity-catalogue.test.ts`) needs no change because the function list and callers are the same; it must still pass.
- [x] Step 7: Documentation and traceability. Mark B1 done in `follow-ups/minor-findings-plan.md`; record there the accepted limits from the review: a statement timeout cancels the whole call and is not caught by the exception block, so the 5000-row cap is the protection against timeouts (R-01); a failed purge writes no log line and shows only as `audit_purge_failed` in the result, an accepted risk until alerting is added (R-04); the 365-day purge also covers import and notification audit events (R-05, U4 R-04). Write `code-summary.md` and `traceability.json`.

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

Only the database layer applies: the change is one SQL migration, and the repository, business-logic, API and frontend layers are untouched (the application only reads the housekeeping result's existing fields).
