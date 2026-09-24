# Deployment Pipeline Configuration

## Current State

**Status: DISABLED.** This intent delivers local runnability and validation only. No Vercel project or deployment environment is linked, and the approved CI workflow contains no deployment job, Vercel CLI invocation, deployment secret, publish step, or target call. Do not provision or deploy an environment from this configuration.

The CI workflow in `.github/workflows/ci.yml` validates pull requests and `main` pushes, then creates build/SBOM attestations on trusted `main` pushes. These attestations establish provenance; they do not publish or deploy the application.

## Activation Preconditions

A future deployment change may define an executable pipeline only after all of the following are confirmed:

1. A deployable application artifact and all local acceptance gates are complete, including current dependency audit and full browser matrix evidence.
2. A Vercel project and intended environments are linked, with project/environment identifiers and secrets managed through protected settings rather than committed files.
3. Supabase/provider integrations required for the selected environment are configured and validated against their real targets.
4. The pipeline has an immutable tested commit/artifact provenance contract and an operator-approved smoke and rollback procedure.

Until then, there is no staging or production deployment and no target configuration is inferred.

## Future Promotion Policy

When separately authorized and linked, the intended path is: validate the exact tested commit; promote an immutable artifact to staging after required CI gates; run environment-specific smoke/health checks; retain the prior deployment as the rollback target; and require protected manual approval before production promotion. Rollback restores the previously attested immutable deployment and then reruns readiness and critical smoke checks.

This design-only recovery artifact was assembled from the approved CI configuration, unit deployment architectures, and affirmed project/team deployment rules because the deployment-pipeline stage was skipped for this local-only intent. It records the missing input without enabling a deployment workflow.
