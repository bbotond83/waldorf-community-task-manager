## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T14:28:08Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Stage to Gate Mapping, row "Start the stack" (and stage 4) | The gate says merge is blocked when a published port is not loopback-only. The Supabase CLI cannot bind loopback only. The workflow in .github/workflows/ci.yml and scripts/db/start.ts therefore acknowledge all-interface publishing in CI (`DB_ALLOW_ALL_INTERFACES: "1"`), so on a runner that gate can never fire. The design does not record this, and the specification's "fails with a message, firewall fallback" wording does not cover it. | Record the CI exception in the design: the isolated-VM reasoning, the acknowledgement flag, and why the loopback gate applies only to local runs. Reword the gate row so it matches what CI enforces. | Unresolved |
| R-02 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/infrastructure-specification.md > Keys table and cicd-pipeline.md > Secrets Management in CI | The design says the service-role key goes only to an ignored file read by the tooling and never by the app (BR1.4). The workflow adds a step that exports the key into `GITHUB_ENV` for the whole job, so every later step and the test and app processes can read it. The design says nothing about this. | Either document the job-wide exposure as an accepted exception with its rationale and the scope of which processes read it, or restrict the variable to the tooling steps that need it. Update the Keys table and the CI secrets section to match. | Unresolved |
| R-03 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Stages, item 5 (Postgres version) | The design promises a check that the stack's Postgres major version matches the one the role-migration test uses. `supabase/config.toml` sets `major_version = 17`, while CI installs PostgreSQL 18 tools. No note about the difference exists. | Record the 17 vs 18 difference, or align the versions. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/infrastructure-specification.md > Worker Schemas ("answer Q5") and the BR1.5 row ("answer Q3") | These answers are cited as sources, but infrastructure-design-questions.md has only Q1 to Q4, and its Q3 is about network exposure. The references appear to point to the NFR questions. | Name the source file for each cited answer. | Unresolved |
| R-05 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Files That Change (ci.yml row) | The design describes ci.yml as it was before the change ("today installs ... runs verify:local"). The file already has the new steps, and the key-export step is not listed. | Refresh the row to reflect the current workflow, including the key-export step. | Unresolved |
| R-06 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Secrets Management in CI | The section says nothing is printed that contains the service-role key, but it does not say how the key-export step in ci.yml is masked or whether it is. | State the masking approach for the exported key, or restrict the export to tooling steps as R-02 requires. | New |

> R-01 Reviewer note: cicd-pipeline.md still lists "a published port is not loopback-only" as a merge blocker. ci.yml line 67 sets DB_ALLOW_ALL_INTERFACES "1" for the start step, so that gate cannot fire in CI. The exception is not recorded anywhere.

> R-02 Reviewer note: The specification says the service-role key goes only to an ignored tooling file. ci.yml lines 73-76 write SUPABASE_SERVICE_ROLE_KEY to GITHUB_ENV, which exposes it to every later step in the job, including build, start smoke and browser steps. Neither document records this.

> R-03 Reviewer note: cicd-pipeline.md stage 5 promises a Postgres major-version check with a note. supabase/config.toml has major_version 17 and CI installs PostgreSQL 18 tools. No note exists.

> R-04 Reviewer note: infrastructure-specification.md still cites "answer Q3" (Worker Schemas, search path row) and "answer Q5" (More than four workers). This stage's questions file has only Q1 to Q4, and Q3 there is about network binding. The source file is not named.

> R-05 Reviewer note: The ci.yml row under Files That Change describes the pre-change file and does not list the key-export step, the DB_ALLOW_ALL_INTERFACES setting or the `db:start` step.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Manual check of ci.yml and supabase/config.toml | Confirms R-01, R-02, R-03 | The design and the workflow disagree on the loopback gate, key scope and Postgres version. |

### Summary

None of the five prior findings has been addressed in the artifacts. R-01 and R-02 are Major: the stated loopback and key-scope controls do not match what CI actually does. There are no Critical findings and only two Major, which is within the READY threshold. The verdict is READY, but both Majors should be fixed before approval: record the CI exceptions or change the workflow.
