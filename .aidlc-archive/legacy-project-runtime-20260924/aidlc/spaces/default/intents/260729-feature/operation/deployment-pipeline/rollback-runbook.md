# Rollback Runbook

## Application Rollback

1. Stop further production promotion and record the failing SHA.
2. Use Vercel to promote the last known-good immutable production deployment.
3. Verify authentication, scoped reads, denied mutations, parent/admin core flows, and worker health.
4. Confirm error rate and latency return to baseline before closing the rollback.

## Data and Escalation

Do not automatically reverse a committed database migration. Use its documented forward recovery or reconciliation path, preserving post-deployment user changes. Import rollback follows staged reconciliation; notification jobs remain durable and stale jobs are cancelled. Developer receives initial alerts; production activation additionally requires a named kindergarten owner and backup escalation path. Any P1/P2 rollback requires an incident review.

Sources: `../../construction/ci-pipeline/quality-gates.md`; `../../construction/access-foundation/infrastructure-design/cicd-pipeline.md`; unit `infrastructure-design/deployment-architecture.md` artifacts.
