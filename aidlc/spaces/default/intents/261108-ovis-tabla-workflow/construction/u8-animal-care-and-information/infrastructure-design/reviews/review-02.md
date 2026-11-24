## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-24
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
| R-06 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/monitoring-design.md > Metrics and KPIs, "Timings of the sign-up page..." row; cicd-pipeline.md > Database tests row | Both files say a database timing test file `animal-timing.test.ts` exists, is listed in `test:database:directory` and the shuffled run, and blocks the merge when a median-of-5 ceiling is missed. No such file exists in `tests/database/` and none of the nine new U8 database tests is a timing test (the only timing files are the earlier units' `directory-`, `library-`, `recurring-`, `swaps-`, `notifications-` and `seed-timing`). `package.json` and `DATABASE_TEST_FILES` do not name it either. So the only monitoring this design relies on (the 2, 5 and 10 second targets) is not enforced by anything built. | Either add `animal-timing.test.ts` (large seed, median of 5 after a warm-up) and list it by hand in `test:database:directory` and `DATABASE_TEST_FILES`, or change both files to say the timing targets are not tested in this Unit and record who owns that gap. | New |
| R-07 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/infrastructure-specification.md > Deployment, Storage row ("One new forward-only migration file"), Shared Infrastructure table, and cicd-pipeline.md > Deployment and Rollback | The design describes one migration, `20261068`. Three exist: `20261069_schedule_leaves_out_animal_slots.sql` replaces `schedule_get` (another unit's read, which now hides animal slots from the teacher schedule), and `20261070_u8_review_fixes.sql` replaces `animal_calendar_save` and `info_section_update`. The `schedule_get` change is not in the Shared Infrastructure table at all, and the read-only teacher page `/teacher/allatok` added after owner review is not mentioned anywhere. The Storage row therefore does not match what `npm run db:migrate` applies. | Update the Storage row to list all three files and what each replaces (noting 20261070 is a forward fix that leaves 20261068 unedited), add `schedule_get` to Shared Infrastructure with its owner and a test that shows the change, and add the teacher page to the screens covered by the accessibility and timing rows. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/cicd-pipeline.md > Database tests row | The listed file names (`animal-slots`, `animal-timed-checks`, `animal-races`, `animal-timing`) do not match what was built and registered: `animal-calendar-slots`, `animal-table-rights`, `animal-sign-up-give-up`, `animal-slot-races`, `animal-fair-share`, `animal-checks`, `info-sections`, `info-links-duty-card`, `animal-migration`. The hand-listing rule is met in the code (all nine are in `test:database:directory` and `DATABASE_TEST_FILES`), only the document is wrong. | Replace the name list with the nine real file names. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u8-animal-care-and-information/infrastructure-design/infrastructure-specification.md > Infrastructure Services, Daily-run registry row | The registry rows are correct (both at lock step 4, `daily`, active, `u8-animal-care`, inserted at line 857 of 20261068, and `animal-checks.test.ts` reads them). The row's claim that a test finds them "in the expected place" beside U9's and U11's checks is only partly shown: the test selects only this Unit's two rows, not their position among the other step-4 rows. | Add an assertion on the position among step-4 rows, or soften the sentence. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

### Verification

- Migrations: 20261068, 20261069 and 20261070 are new, untracked files, ordered after 20261067; `git status` shows no edit to any earlier migration. 20261070 restates two functions rather than editing 20261068, so forward-only holds.
- Scheduled checks: `timed_check_registry` insert at 20261068 line 857 has both checks at `lock_step` 4, run kind `daily`, matching U9 and U11 usage; neither is granted to a signed-in role by design.
- Test registration: the nine new database files are in `test:database:directory` and in `DATABASE_TEST_FILES`; `animal-support.ts` is a helper and correctly not listed.
- Nothing deploys: no workflow, secret, service or hosting change in the design or the diff list; the local-only wording matches the team rules.
- Personal data: the design files contain no names, addresses or phone numbers; I did not scan the migrations' seed text beyond the starting-section inserts' structure.
- Tests were not re-run, as instructed.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Directory listing of `tests/database` against the design's file names | 1 named file missing (`animal-timing`), 4 names differ | Basis for the two documentation findings |
| `git status` on `supabase/migrations`, `package.json`, `scripts` | 3 new migration files, only the two registration files modified | No applied migration edited |
| Full test run | Not run (per brief) | Not verified here |

### Summary

The deployment shape is sound: forward-only migrations in order, both daily checks at step 4, all new database tests registered, nothing deployed. Two Major documentation gaps (a timing test the monitoring design relies on does not exist, and the storage description omits two of three migrations and the teacher page) should be fixed or accepted at the gate; neither blocks building.
