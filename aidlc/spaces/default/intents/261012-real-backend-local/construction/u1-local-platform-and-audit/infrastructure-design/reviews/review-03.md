## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T14:26:23Z
**Iteration:** 2

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Stage to Gate Mapping, row "Start the stack" (and stage 4) | The gate says merge is blocked when a published port is not loopback-only. The Supabase CLI cannot bind loopback only. The workflow in .github/workflows/ci.yml and scripts/db/start.ts therefore acknowledge all-interface publishing in CI (`DB_ALLOW_ALL_INTERFACES: "1"`), so on a runner that gate can never fire. The design does not record this, and the specification's "fails with a message, firewall fallback" wording does not cover it. | Record the CI exception in the design: the isolated-VM reasoning, the acknowledgement flag, and why the loopback gate applies only to local runs. Reword the gate row so it matches what CI enforces. | New |
| R-02 | Major | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/infrastructure-specification.md > Keys table and cicd-pipeline.md > Secrets Management in CI | The design says the service-role key goes only to an ignored file read by the tooling and never by the app (BR1.4). The workflow adds a step that exports the key into `GITHUB_ENV` for the whole job, so every later step and the test and app processes can read it. The design says nothing about this. | Either document the job-wide exposure as an accepted exception with its rationale and the scope of which processes read it, or restrict the variable to the tooling steps that need it. Update the Keys table and the CI secrets section to match. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Stages, item 5 (Postgres version) | The design promises a check that the stack's Postgres major version matches the one the role-migration test uses. `supabase/config.toml` sets `major_version = 17`, while CI installs PostgreSQL 18 tools. No note about the difference exists. | Record the 17 vs 18 difference, or align the versions. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/infrastructure-specification.md > Worker Schemas ("answer Q5") and the BR1.5 row ("answer Q3") | These answers are cited as sources, but infrastructure-design-questions.md has only Q1 to Q4, and its Q3 is about network exposure. The references appear to point to the NFR questions. | Name the source file for each cited answer. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/infrastructure-design/cicd-pipeline.md > Files That Change (ci.yml row) | The design describes ci.yml as it was before the change ("today installs ... runs verify:local"). The file already has the new steps, and the key-export step is not listed. | Refresh the row to reflect the current workflow, including the key-export step. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| No validation tool is listed for this stage | Not run | The review checked claims against `.github/workflows/ci.yml`, `supabase/config.toml`, `scripts/db/start.ts` and `package.json` directly. |

### Summary

The design is implementable: the stack, worker schemas, indexes, gates and monitoring are coherent and trace to the NFRs. Two Major gaps remain. The CI loopback gate and the service-role key handling diverge from the current workflow without being recorded. That is within the READY limit (two or fewer Major findings), but both should be reconciled before the gate.
