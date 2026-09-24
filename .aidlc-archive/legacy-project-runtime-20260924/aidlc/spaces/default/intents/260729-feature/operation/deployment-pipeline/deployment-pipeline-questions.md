# Deployment Pipeline Questions

## Confirmed Decisions

1. Deployment strategy: Vercel immutable/atomic deployment with instant rollback to a prior deployment.
[Answer]: Confirmed from Infrastructure Design.

2. Environments: separate development and production; no staging environment for MVP.
[Answer]: Confirmed by user.

3. Production approval: manual approval after CI and a development verification checklist.
[Answer]: Confirmed by user.

4. Feature flags: none for the MVP domain-library delivery; add only when a deployable application introduces a justified progressive-release need.
[Answer]: No feature flags for MVP.

## Validation

The design preserves the prior manual production safeguard despite the team’s general continuous-deployment preference. Production cannot activate until a deployable Next.js/Vercel project and the governance/provider release evidence exist.

Sources: `../../construction/ci-pipeline/ci-config.md`; `../../construction/ci-pipeline/quality-gates.md`; unit `infrastructure-design/deployment-architecture.md` and `cicd-pipeline.md` artifacts.
