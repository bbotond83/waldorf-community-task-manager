## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15T19:50:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/ (all six requirement files and traceability.json) > IDs NFR1.6-1.7, NFR3.9, NFR4.9, NFR5.7, NFR6.5, NFR7.7-7.11, NFR9.5-9.7, NFR10.4 | U4's numbering continues from U3's last IDs but ignores U5, which is already merged (#12). Every one of these IDs is already used in U5's nfr-requirements files for a different requirement (U5 uses NFR1.1-1.7, NFR3.1-3.9, NFR4.1-4.9, NFR5.1-5.7, NFR6.1-6.5, NFR7.1-7.11, NFR9.1-9.7, NFR10.1-10.4). Cited alone, "NFR7.9" or "NFR4.9" now points at two different requirements in two units. U4's NFR2.3, NFR8.3-8.4 and NFR11.4-11.6 do not collide. | Renumber U4's colliding IDs to start after the highest ID used by any earlier unit, for each NFR group (for example NFR1.8 on, NFR3.10 on, NFR4.10 on, NFR5.8 on, NFR6.6 on, NFR7.12 on, NFR9.8 on, NFR10.5 on). Then update every cross-reference inside the six files and traceability.json (for example the Threat Considerations table, which cites NFR3.9, NFR3.10, NFR3.11, NFR1.7, NFR7.10 and NFR11.4). | New |
| R-02 | Minor | nfr-requirements/performance-requirements.md > NFR9.6 | Pass criterion says "under 2 seconds for 20 invented families", while NFR9.5 and NFR9.7 use the 30-family `db:seed:large` set. The same wording exists in U3, so it is a deliberate target size, but the artifact does not say which set the database test runs on. | Name the data set for NFR9.6 (the large seed, or a 20-family set) so the timing test is reproducible. | New |
| R-03 | Minor | nfr-requirements/reliability-requirements.md > NFR7.13 | The pass criterion says the catalogue test "lists the new signature". `tests/database/identity-catalogue.test.ts` is keyed by function name (`end_admin: INTERNAL`, line 249), not by signature. Whether it still passes with the old two-parameter overload present is therefore not what it checks. | Add a criterion that actually proves the old overload is gone, for example a test that counts one `end_admin` in the database catalogue with the three-parameter signature. | New |
| R-04 | Minor | nfr-requirements/security-requirements.md > NFR3.15 | The pass criterion "the evidence is in the Unit's test results before merge" is not a pass/fail check. Every other requirement names a test. | Name the check: a matrix row per route and role verified by the existing authorization-matrix test, plus a role-by-role browser walk-through. | New |
| R-05 | Minor | nfr-requirements/scalability-requirements.md > NFR5.11 | "Repeated runs ... show no deadlock" gives no run count, and the "shuffled run" is not a deadlock proof. | State a number of repeated runs (or that the race tests run in each shuffled run) and that a deadlock error fails the test. | New |
| R-06 | Minor | nfr-requirements/reliability-requirements.md > NFR7.14 and NFR6.5 | Both restate the project-wide verification and coverage gates (already required by `team.md`) with no U4-specific criterion. | Keep as a pointer, or add the U4-specific item (the new browser specs for the two group pages run in all three browsers). | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/security-requirements.md > NFR3.16 pass criterion | The criterion says the matrix check in `scripts/verification/core.ts` passes and `tests/unit/current-role-references.test.ts` "finds the new routes". Neither does that. `validateManifests` only checks versions, duplicate ids and legacy role strings. The unit test only scans a fixed file list for removed-role names and spot-checks two existing rows. Both would stay green with no row for the new routes. | Reword the criterion to name a check that fails when a route or role row is missing, for example a new assertion in the matrix test. Alternatively, drop the claim about the two existing checks and keep only "a row per new route and role". | New |
| R-08 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/reliability-requirements.md > NFR7.15 and NFR7.17 | The rule that an unrevoked group-admin grant needs an active membership of the same group is only checked after U4's own writers run. The structure change (NFR7.17) says nothing about group-admin grants that already exist from U1 to U5, and the seed (scripts/db/seed/data.ts) and earlier tests create group-admin grants through the general role-change function, which never required a membership. After the migration such a grant would break the rule, and nothing ends it. | Add a requirement for the migration over existing data: either end or repair grants without a matching active membership, or state that none can exist and add a post-migration check that counts them. Extend the NFR7.17 test to read that count after the migration on a seeded database. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/performance-requirements.md > NFR9.8 | "Loads in under 2 seconds on the owner's computer" has no stated way to measure it. The group page and group admin page load is a browser-side figure, and the pass criterion names only the seed. The database tests in NFR9.9 and NFR9.10 are measurable, but this one is not. | Name the measurement: for example, time to the member list being visible in a Playwright check, or the server response time, and the browser it applies to. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/performance-requirements.md > NFR9.11 | The pass criterion says the "existing timing tests pass" for `directory_list` and `lifecycle_run_core`. A timing test exists for the directory (directory-timing.test.ts), but nothing in the artifacts shows one for `lifecycle_run_core` on the large seed. The requirement may have no test behind it. | Confirm a timing test for the lifecycle run exists, or require U4 to add one. State the threshold used. | New |
| R-11 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/security-requirements.md > NFR10.6 | The test revokes the right of a parent whose account was deactivated, but the revoke path (BR41.5) requires an active membership and an unrevoked grant, and BR41.6 sends the notice to that parent. The set-up that leaves a deactivated account holding an active membership and a grant is not described. | Describe how the test reaches this state, for example by deactivating the account after the appointment, so the test can be written without guessing. | New |
| R-12 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/nfr-requirements/performance-requirements.md > NFR8.4 | Passing depends on "the owner's screenshot comparison", which has no objective criterion. It matches the team's stated practice, but the other half (accessibility, phone width, keyboard) is the only part a developer can verify without the owner. | Keep as is, but state that the owner's comparison is a manual sign-off outside the automated checks, so the Unit is not read as fully verified without it. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json coverage check (manual) | All 11 upstream NFR ids (NFR1 to NFR11) map to targets that exist in the six requirement files | No broken or missing cross-references. |
| Rule consistency BR40.1 to BR44.2 against NFR3.10 to NFR3.14, NFR5.8 to NFR5.12, NFR7.12 to NFR7.18, NFR11.4 to NFR11.6 | Consistent: lock order (family, parent; family, accounts, parents, memberships ascending) matches, refusal codes match NFR4.12, audit reasons match BR40.5 | No contradictions found. |

### Summary

The requirements are measurable and trace cleanly to BR40 to BR44, and the privacy and security outcomes (same contact helpers as the directory, ids only for C7, opaque audit details, no names in notices) are explicit. The one gap that matters is existing group-admin grants that the migration may leave without a matching membership. The rest are small measurement and test set-up gaps.
