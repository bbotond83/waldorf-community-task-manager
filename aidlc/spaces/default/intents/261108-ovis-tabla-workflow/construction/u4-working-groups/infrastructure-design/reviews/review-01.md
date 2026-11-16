## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/infrastructure-specification.md > Infrastructure Services, row "Seed and reset"; cicd-pipeline.md > Stages | The seed change is described as "invented members and one invented coordinator per group". The real seed (`scripts/db/seed/data.ts`) has only two group-admin accounts (the second holds two groups), plus a super admin and a teacher. One coordinator per group means more seeded accounts and grants, and each coordinator needs an active membership of the same group so the "no coordinator rights without a membership" check (NFR7.15) holds on the seeded data. That changes seed counts and account tags that `tests/database/seed.test.ts`, `seed-timing.test.ts`, `reset.test.ts` and the seed unit tests assert (`test:database:seed`), and any browser fixture that signs in as the seeded group admins. The pipeline table lists none of this. | State in the seed row which accounts and memberships are added and that the seed tests, reset test and browser fixtures change in the same pull request. Add a line to the pipeline's database-test row for `test:database:seed`. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/cicd-pipeline.md > Stages (database tests) and Deployment and Rollback | Only `working-groups.test.ts` is named for the two lists. The migration test (apply over a seeded database, compare membership and grant counts, NFR7.17), the group-page and command timing tests (NFR9.8 to NFR9.10), and the four 50-run race tests have no named file. U5's equivalent (`notices-migration.test.ts`) and U3's (`rota-migration.test.ts`) are separate files, and the project rule is that a file listed in neither `test:database:directory` nor `DATABASE_TEST_FILES` never runs. Running the 50-run races in `database-directory` and again in `database-shuffled` also doubles their run time, which is not mentioned. The new migration is `20261051_...`, which is also unnamed. | Name the files that hold the migration test, timing tests and race tests, say each is added to both lists, and note the run-time cost of the 4 x 50 races (or run them once). Name the migration's file number. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/infrastructure-specification.md > Infrastructure Services, row "Postgres", "Function rights" | The pipeline row says new `identity-catalogue.test.ts` entries are part of the pull request, but the Postgres row does not say the new internal functions (C7 facts, removal steps, contact helpers, `working_group` facts function, three-parameter `end_admin`) are listed there. `traceability.json` NFR3.15 points only at the migration text. | Add one sentence that every new internal function is entered in `identity-catalogue.test.ts` as granted to nobody, and point NFR3.15 at it. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/cicd-pipeline.md > Stages, row "Critical browser flow, accessibility" | The browser row names flows but not the spec files. Playwright picks up everything in `tests/browser/` on its own, so nothing is lost, but the three group routes also need timing coverage (NFR9.9), which U5 put in its own `*-timing.spec.ts`. | Name the new browser spec files, including the timing spec, and say the new route entries in the authorization matrix match exact route before wildcard rows. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| package.json scripts | `test:database:directory`, `test:database:shuffled`, `verify:no-deploy`, `verify:local`, `db:seed:large` all exist as named | Pipeline claims about scripts are accurate |
| scripts/db/shuffled-tests.ts | `DATABASE_TEST_FILES` exists and is the shuffled list | NFR6.7 text is accurate |
| verification/authorization-matrix.json | Contains list routes `/szulo/munkacsoportok`, `/teacher/munkacsoportok`, `/admin/munkacsoportok` only; no `[id]` rows | New exact rows are real work, as claimed |
| 20261050 migration registries | `notice_targets`, `notice_kinds` with `added_by`; `notifications_task_shape` allows non-task targets with no task id | A `working_group` target type and two kinds can be added as designed |
| 20261047 `end_admin` and 20261018 `identity_bump_authorization_version` | Old two-argument `end_admin` exists; bump writes `app_authorization_versions` | Drop and recreate is required; the version row is the lock the design now orders |
| `.github/workflows/ci.yml`, `playwright.config.ts` | One workflow; browser specs auto-discovered from `tests/browser` | No pipeline change needed, as claimed |

### Summary

The three infrastructure files fit the NFR design, team.md and U5's format: nothing hosted, one forward-only migration, no new package, setting or secret, and all 16 NFR ids in `traceability.json` resolve. Lock-order check on the open NFR design Major (not an engine-recorded finding for this stage): it holds. `scalability-design.md` adds the authorization-version row as the last lock level, places the lifecycle step after the family lock and before the deactivation loop (accounts, parents, memberships, then grants), and the three lifecycle race tests use coordinators with linked accounts; `reliability-design.md` NFR11.4 matches and calls `end_admin` only for grants it found. No remaining cycle was found. The four findings are Minor gaps in what the pipeline names.
