## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24T04:37:47Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/infrastructure-specification.md > Infrastructure Services: Daily-run registry (U5) row | The two registry rows are described as "run kind daily, active" only. The existing registry requires a lock step from 1 to 4 on every row (`timed_check_registry.lock_step not null`, checked 1..4), and the daily run calls checks in ascending lock step. U9's row uses 4. The fair-share check reads family standing and sends notices, and the team's fixed lock order (family rows, then task rows, then assignment rows) depends on this value. A developer would have to guess it. | State the lock step for `animal_empty_slots` and `animal_fair_share` (with the reason, tied to the rows each check locks) and the `added_by` value. Add a database test that the two rows run in the intended order relative to the other registered checks. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/cicd-pipeline.md > Pipeline: Database tests row | The new test files are named as `animal-slots`, `animal-fair-share`, `animal-timed-checks`, `animal-races` and `info-sections`. The migration test over a seeded database with and without the named groups (NFR7.6) has no file of its own, although every earlier unit has a `*-migration.test.ts` that must be listed by hand in `test:database:directory` and in `DATABASE_TEST_FILES` (`scripts/db/shuffled-tests.ts`). A test file left out of both lists never runs. | Name the migration test file (for example `animal-migration.test.ts`) in the list of files to register by hand, and say which `test:database:*` script holds it. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/infrastructure-specification.md > Shared Infrastructure: Duty card read `rota_duty_card` row | The function is defined in `20261048_first_rota_slice.sql` and replaced in `20261053_full_rotas_and_weekend_picks.sql`. The spec says U8 replaces it "to add `info_links` only", but does not say to copy the latest definition. A copy of the older one would silently drop later changes, and the unchanged duty card tests may not catch every field. | Say that the replacement starts from the latest applied definition (the 20261053 one) and that a test compares the card's output before and after, apart from `info_links`. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/cicd-pipeline.md > Pipeline intro | The text says the `Validate` job runs on every pull request "that touches app or database files". The real workflow runs on every pull request except those that touch only `aidlc/**`, and it skips drafts. The wording invites a wrong assumption about when the gate fires. | Reword to match `.github/workflows/ci.yml`. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/monitoring-design.md > Metrics and KPIs: Timings row | The timing targets (under 2, 5 and 10 seconds, median of 5 runs) are said to be checked "on each pull request". They run on a shared GitHub runner in three browsers, where timings vary, and the design gives no margin or rerun rule. | State whether a timing miss on CI blocks merge or is only reported, and keep the median-of-5 rule written down so it is not weakened ad hoc. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| traceability.json by hand | The 60 IDs in its `upstream_ids` match this Unit's NFR design `upstream_ids` exactly, and every ID has one coverage row. Two rows are N/A (NFR1.4, NFR8.1), each with a reason. Every OK row points to a named section that exists in the three documents, except that the migration test behind NFR7.6 has no file named (see the Minor finding). | Coverage is complete. |
| Repository spot-checks | The migration number 20261068 follows the latest file (20261067). `db:seed:large`, `timed:run`, `verify:no-deploy` and `DATABASE_TEST_FILES` exist as described. The registry row shape differs from the spec (lock step). | One gap, the Major finding. |
| Sensors (required-sections, upstream-coverage, linter, type-check) | Not run; they ran as stage sensors. The documents have the sections the stage asks for (deployment, services, shared infrastructure, secrets, metrics, alerts, SLOs, logs, pipeline, rollback). | No finding. |

### Summary

The design stays inside the existing local stack and adds no service. It maps every NFR to a migration object, a test or a pipeline gate, and it follows the forward-only migration and no-deploy rules. The one gap a developer would trip on is the missing lock step for the two daily-run registry rows; the rest are small precision fixes.
