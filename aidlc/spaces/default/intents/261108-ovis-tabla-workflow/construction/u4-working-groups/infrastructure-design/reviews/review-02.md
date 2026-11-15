## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15T20:06:00Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/infrastructure-specification.md > Infrastructure Services, row "Seed and reset"; cicd-pipeline.md > Stages | The seed change is described as "invented members and one invented coordinator per group". The real seed (`scripts/db/seed/data.ts`) has only two group-admin accounts (the second holds two groups), plus a super admin and a teacher. One coordinator per group means more seeded accounts and grants, and each coordinator needs an active membership of the same group so the "no coordinator rights without a membership" check (NFR7.15) holds on the seeded data. That changes seed counts and account tags that `tests/database/seed.test.ts`, `seed-timing.test.ts`, `reset.test.ts` and the seed unit tests assert (`test:database:seed`), and any browser fixture that signs in as the seeded group admins. The pipeline table lists none of this. | State in the seed row which accounts and memberships are added and that the seed tests, reset test and browser fixtures change in the same pull request. Add a line to the pipeline's database-test row for `test:database:seed`. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/cicd-pipeline.md > Stages (database tests) and Deployment and Rollback | Only `working-groups.test.ts` is named for the two lists. The migration test (apply over a seeded database, compare membership and grant counts, NFR7.17), the group-page and command timing tests (NFR9.8 to NFR9.10), and the four 50-run race tests have no named file. U5's equivalent (`notices-migration.test.ts`) and U3's (`rota-migration.test.ts`) are separate files, and the project rule is that a file listed in neither `test:database:directory` nor `DATABASE_TEST_FILES` never runs. Running the 50-run races in `database-directory` and again in `database-shuffled` also doubles their run time, which is not mentioned. The new migration is `20261051_...`, which is also unnamed. | Name the files that hold the migration test, timing tests and race tests, say each is added to both lists, and note the run-time cost of the 4 x 50 races (or run them once). Name the migration's file number. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/infrastructure-specification.md > Infrastructure Services, row "Postgres", "Function rights" | The pipeline row says new `identity-catalogue.test.ts` entries are part of the pull request, but the Postgres row does not say the new internal functions (C7 facts, removal steps, contact helpers, `working_group` facts function, three-parameter `end_admin`) are listed there. `traceability.json` NFR3.15 points only at the migration text. | Add one sentence that every new internal function is entered in `identity-catalogue.test.ts` as granted to nobody, and point NFR3.15 at it. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/cicd-pipeline.md > Stages, row "Critical browser flow, accessibility" | The browser row names flows but not the spec files. Playwright picks up everything in `tests/browser/` on its own, so nothing is lost, but the three group routes also need timing coverage (NFR9.9), which U5 put in its own `*-timing.spec.ts`. | Name the new browser spec files, including the timing spec, and say the new route entries in the authorization matrix match exact route before wildcard rows. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/infrastructure-specification.md > Infrastructure Services > Postgres | The plan says "one migration file" holding every change, and lists four changed functions (`end_admin`, the general role-change function, `directory_list`, `lifecycle_run_core`). The repository now also has `supabase/migrations/20261052_governance_revoke_coordinator.sql`, which redefines a fifth function, `governance_revoke`, and restates its grants. The first migration file, `20261051_working_groups.sql`, is the one the plan describes. The second file is not mentioned in any of the three documents or in the traceability file. It follows the forward-only rule and the revoke-then-grant pattern, so this is a documentation gap rather than a rule breach. | Update the Postgres row and the rollback paragraph in `cicd-pipeline.md` to say there are two migration files, name both, and add `governance_revoke` to the changed functions. Alternatively, record the second file as a later follow-up fix with its own coverage line. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u4-working-groups/infrastructure-design/infrastructure-specification.md > Infrastructure Services > Postgres | The plan never gives the migration file name or says how it is picked up. The file name is a risk because `db:migrate` applies files in file-name order. The existing files use an eight-digit numeric prefix (`20261050_...`, `20261051_...`), and a new name must sort after the last applied file. No registration step is needed, but the plan does not say so. | State the file name and the sort-order requirement, and note that `db:migrate` picks files up by name with no separate registration. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual check of posture rules | PASS | No cloud resource, hosted environment, deployment workflow, secret, or new package is added. The plan keeps the local stack on loopback only, keeps `verify:no-deploy`, and treats the tested git SHA as the artifact record. These match the team and project rules. |
| Migration check | PASS | The migration directory holds `20261051_working_groups.sql` and `20261052_governance_revoke_coordinator.sql`, both new and both forward-only. The second file restates `revoke all` and `grant execute`. |
| Test registration | PASS | `tests/database/working-groups.test.ts` is named for both `test:database:directory` and `DATABASE_TEST_FILES`, as the team rule requires. |

### Summary

The infrastructure plan fits the no-hosted-site, forward-only, local-stack-only posture and enables nothing that the team rules forbid. The only gaps are that the plan describes one migration file while two now exist, and that it never gives the migration file name.
