## Review

**Verdict:** NOT-READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
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

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| ID collision check across u1, u2, u3 and u5 nfr-requirements files | FAIL for the groups listed in the Major finding | U5's IDs reach NFR1.7, 3.9, 4.9, 5.7, 6.5, 7.11, 9.7 and 10.4. U4 starts inside those ranges. |
| traceability.json coverage of NFR1 to NFR11 | PASS | All eleven upstream IDs are mapped, and every target ID exists in the six files (but see the collision finding). |
| Code claims (migrations 20261047, 20261049, 20261050; tests) | PASS | `end_admin(uuid, uuid)` exists in 20261047 and is internal-only. The general role-change function supports group_admin. `community-roles.test.ts` has BR3.11 and BR3.12 cases. `identity-grants.test.ts` has the `denied` cases. `db:seed:large` is the 30-family set. |
| Real names or contact details | PASS | None found in the eight files. |

### Summary

The requirements are measurable, consistent with the functional design and project rules, cover NFR1 to NFR11 and the authorization surface completely. The one blocker is mechanical: U4 reuses requirement IDs that U5 already owns, so IDs are ambiguous across units. Renumber them and the stage is ready.
