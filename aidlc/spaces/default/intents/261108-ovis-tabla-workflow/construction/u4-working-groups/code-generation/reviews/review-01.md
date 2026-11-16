## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15T18:36:22Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/traceability.json > coverage | The file covers only 10 ids (US2.1-US2.3, AC2.1.1, AC2.3.4, NFR3, NFR4, NFR9, NFR10, NFR11). Stories AC2.1.2 to AC2.1.6, AC2.2.1, AC2.2.2 and AC2.3.1 to AC2.3.3 are absent, and so are BR40 to BR44, NFR1, NFR5 and NFR7, although the plan assigns them to this Unit and tests exist for them. Several targets are coarse: NFR3 points at the races file and NFR4 at a browser spec, while the audit tests sit elsewhere. | Add a row for every assigned AC, BR and NFR id, each pointing at the specific test file that proves it. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/unit-test-instructions.md > Seed tests command | The seed command names scripts/db/seed/seed.test.ts, scripts/db/seed/seed-timing.test.ts and scripts/db/reset.test.ts. None of these exist (checked with ls). The real seed tests are tests/database/seed.test.ts and tests/database/seed-timing.test.ts, run through test:database:seed. A reader following the file gets a file-not-found error. | Correct the command to the real files or to `npm run test:database:seed`. | New |
| R-03 | Minor | supabase/migrations/20261051_working_groups.sql > coordinator_appoint and coordinator_revoke (sections 9) vs the lock order in the header | The header says paths go family, accounts, parents, memberships, grants and never back. Appoint locks the membership row first and then inserts the grant, which takes a key-share lock on the account row. A path that locks accounts first and memberships second (lifecycle_run_core, working_groups_removal_apply) could therefore wait in a cycle with an appoint. Today the race test (appoint against lifecycle, 50 rounds) passes because the lifecycle needs an archived family and grant_admin refuses it. The future U14 removal on an active family is not covered. | Add a U14-facing race test (appoint against removal apply on an active family) or record the ordering exception in the header with the reason it is safe. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/code-summary.md > Timing | The group page read takes about 5 ms, but teacher and super admin page loads take about 835 ms against the 2 s target (NFR9.8). The margin is fine now, but it was measured with 11 members and one run per role. | Record the measured member count for the large data set, or add a larger-group timing run before relying on the margin. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| npx tsc --noEmit | PASS (exit 0, no output) | Strict typing is clean. |
| npm run lint | PASS (eslint, max-warnings=0) | Clean. |
| tests/database/working-groups.test.ts and working-groups-races.test.ts | PASS: 104 tests, 0 fail | Join, leave, appoint, revoke, facts, removal, lifecycle, migration shape and timing all run on the real local stack. The four 50-round races ran with no deadlock. |
| tests/database/community-roles, identity-grants, identity-catalogue | PASS: 168 tests, 0 fail | The closed grant path and the catalogue grants hold. |
| src/data/working-groups.test.ts, src/access/role-policy.test.ts | PASS: 30 tests | Port and access policy are consistent. |
| vitest: working-group-matrix, navigation-access, working-groups, working-group-pages | PASS: 83 tests | The 12 matrix rows, the navigation and the page states agree. |
| Playwright and the full verify:local | Not rerun, as instructed | The code summary records a passing verify:local (28 min, three browsers, coverage 93.46 / 86.29 / 93.06 / 94.66 against thresholds of 80, unchanged). |

### Summary

The implementation holds up: both migrations are forward-only, every redefined function restates its revoke and grant, refusals go through U3R00, the old group-admin grant path is closed and the Settings revoke is routed through coordinator_revoke. The database and unit suites pass here and the test files are registered in both the test:database:directory script and the shuffled run. The one finding to weigh before approval is that traceability.json lists only a subset of the assigned acceptance criteria, business rules and non-functional requirements.
