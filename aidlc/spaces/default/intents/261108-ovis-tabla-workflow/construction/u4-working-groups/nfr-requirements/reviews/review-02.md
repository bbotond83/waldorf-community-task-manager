## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 2
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

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| ID collision scan (NFRx.y in nfr-requirements of u1, u2, u3, u5 against u4) | PASS | U4 uses NFR1.8-1.11, 2.3, 3.10-3.16, 4.10-4.17, 5.8-5.12, 6.6-6.8, 7.12-7.18, 8.3-8.4, 9.8-9.11, 10.5-10.6, 11.4-11.6. The highest IDs elsewhere are U5's 1.7, 3.9, 4.9, 5.7, 6.5, 7.11, 9.7 and 10.4, U3's 2.2 and 8.2, and U2's 11.2. No U4 ID is reused. |
| traceability.json against files | PASS | NFR1 to NFR11 are all covered. Every target ID exists in a U4 file, and every U4 ID in the files appears in a target (spot-checked per group). |
| Cross-references in the U4 files (NFR7.15, NFR11.4, NFR1.9, NFR3.14, NFR3.15, NFR3.10-3.12 in the threat table) | PASS | Each resolves to a U4 row with the expected meaning. |
| `db:seed:large` | PASS | `scripts/db/seed/data.ts` defines `large` as 30 families, matching NFR9.8 and NFR9.9. |
| `identity-catalogue.test.ts` | PASS | `end_admin` is already listed as INTERNAL. NFR7.18 asks for a new signature check, which the existing test does not cover; it is stated as new work. |
| Real names and contact details | PASS | None found in the U4 NFR files. |

### Summary

Iteration-1 findings are resolved:
- **Major (ID collision with U5):** resolved. U4's numbering sits strictly above every other unit's.
- **NFR9.6 family count:** resolved. It now says 30 families, which matches the seed.
- **`end_admin` signature check:** resolved by NFR7.18 (exactly one `(uuid, uuid, text)` function, granted to nobody).
- **Non-testable matrix criterion:** partly fixed. It is now concrete, but it overclaims what the existing checks do (the new Minor above).
- **Deadlock run count:** resolved. NFR5.12 now requires 50 consecutive runs.
- **Restated project-wide gates:** resolved. The reliability file now defers to `team.md`.

There is no Critical or Major finding, so the NFR requirements for U4 are ready.
