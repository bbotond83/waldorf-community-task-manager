# Deployment Strategy

## Environment Promotion

Use two isolated environments: development and production. Vercel creates immutable deployments; development receives the passing `main` SHA, then production requires manual approval after smoke verification. Database migrations are forward-compatible and applied before application promotion only when the target code can safely run against both old and new schemas.

## Success and Abort Criteria

Production succeeds only when the deployed SHA matches CI provenance, health/smoke checks pass, error rate remains normal, and protected access checks succeed. Abort on migration failure, authorization/RLS mismatch, notification-worker failure, elevated errors, or missing governance evidence. No traffic canary or feature flag is required for the MVP; Vercel’s atomic deployment and instant rollback provide the release boundary.

Sources: `../../construction/ci-pipeline/ci-config.md`; `../../construction/ci-pipeline/quality-gates.md`; unit `infrastructure-design/deployment-architecture.md` and `cicd-pipeline.md` artifacts.
