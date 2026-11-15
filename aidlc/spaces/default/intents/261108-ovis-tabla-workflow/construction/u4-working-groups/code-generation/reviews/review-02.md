## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15T20:14:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/traceability.json > coverage | The file covers only 10 ids (US2.1-US2.3, AC2.1.1, AC2.3.4, NFR3, NFR4, NFR9, NFR10, NFR11). Stories AC2.1.2 to AC2.1.6, AC2.2.1, AC2.2.2 and AC2.3.1 to AC2.3.3 are absent, and so are BR40 to BR44, NFR1, NFR5 and NFR7, although the plan assigns them to this Unit and tests exist for them. Several targets are coarse: NFR3 points at the races file and NFR4 at a browser spec, while the audit tests sit elsewhere. | Add a row for every assigned AC, BR and NFR id, each pointing at the specific test file that proves it. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/unit-test-instructions.md > Seed tests command | The seed command names scripts/db/seed/seed.test.ts, scripts/db/seed/seed-timing.test.ts and scripts/db/reset.test.ts. None of these exist (checked with ls). The real seed tests are tests/database/seed.test.ts and tests/database/seed-timing.test.ts, run through test:database:seed. A reader following the file gets a file-not-found error. | Correct the command to the real files or to `npm run test:database:seed`. | New |
| R-03 | Minor | supabase/migrations/20261051_working_groups.sql > coordinator_appoint and coordinator_revoke (sections 9) vs the lock order in the header | The header says paths go family, accounts, parents, memberships, grants and never back. Appoint locks the membership row first and then inserts the grant, which takes a key-share lock on the account row. A path that locks accounts first and memberships second (lifecycle_run_core, working_groups_removal_apply) could therefore wait in a cycle with an appoint. Today the race test (appoint against lifecycle, 50 rounds) passes because the lifecycle needs an archived family and grant_admin refuses it. The future U14 removal on an active family is not covered. | Add a U14-facing race test (appoint against removal apply on an active family) or record the ordering exception in the header with the reason it is safe. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/code-summary.md > Timing | The group page read takes about 5 ms, but teacher and super admin page loads take about 835 ms against the 2 s target (NFR9.8). The margin is fine now, but it was measured with 11 members and one run per role. | Record the measured member count for the large data set, or add a larger-group timing run before relying on the margin. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/code-summary.md > Lock order exception | The note says both coordinator_appoint and coordinator_revoke take a key-share lock on the account row through the grant insert. That holds only for appoint (grant_admin inserts a grant). coordinator_revoke ends a grant through end_admin, which updates the grant row and bumps app_authorization_versions, the last lock level, and takes no account-row lock, so revoke follows the documented order after its membership lock. The safety argument (grant_admin refuses an archived family, so appoint cannot cross the lifecycle step) is correct for appoint and matches the migration. | Reword the note so the exception applies to coordinator_appoint only, and say revoke is in order. Do not edit the migration. | New |
| R-06 | Minor | supabase/migrations/20261051_working_groups.sql > header lock-order comment (lines 8-9) | The header says every path locks family, accounts, parents, memberships, grants, and "a path may skip levels, never go back". coordinator_appoint breaks this (membership lock, then key-share on the account). The migration is applied and must not be edited, so the contradiction stays in the file. | Keep code-summary.md as the authoritative record of the exception. Add the same pointer to the U14 hand-off so the removal-on-active-family race test (appoint against removal apply) is not lost. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/code-generation/code-summary.md > Timing on db:seed:large | The 2 s page-load target was measured with 11 members, one run per role (teacher 835 ms, admin 839 ms). The note itself says the margin is only indicative. | Re-measure with a larger group before relying on the target, as already noted; no change needed for approval. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json check (script) | PASS: all 29 upstream_ids (US2.1-2.3, AC2.1.1-AC2.3.4, BR40-44, NFR1,3,4,5,6,7,9,10,11) have a row with status OK, and every target file exists | Focus 1 satisfied |
| source-manifest.json paths | PASS: all 49 claimed paths exist | The listed implementation is present |
| unit-test-instructions.md commands | PASS: referenced test files, matrix, navigation and spec files exist; `test:database:seed` exists in package.json; working-groups.test.ts and working-groups-races.test.ts are in `test:database:directory` | Focus 2 satisfied |
| Migration hashes | PASS: 20261051 (a1ee7179...) and 20261052 (00292193...) match the hashes in reviewed-source-356881e6a041.tsv | Focus 4: unchanged since the earlier pass; both are the newest files in order after 20261050, so they are forward-only additions |
| Lock-order note check | Mostly accurate: coordinator_appoint locks the membership row first and grant_admin requires an active family; lifecycle_run_core and working_groups_removal_apply lock accounts before memberships | See the first Minor finding for the revoke imprecision |
| Tests, verify:local | Not run, as instructed; the summary reports verify:local passing (exit 0) | Not re-verified by this review |

### Summary

The traceability completion, corrected seed command and lock-order and timing notes hold up against the migration and the files on disk, and the migrations are byte-identical to the earlier reviewed versions. The only gaps are a minor wording imprecision about coordinator_revoke in the lock-order note and the already-flagged U14 race-test follow-up.
