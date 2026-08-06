# CD Configuration

## Promotion Contract

The tested git SHA from GitHub Actions is the promotion identity. A future Vercel project deploys passing `main` commits automatically to the development environment. Production promotion is a manual protected-environment action referencing the same SHA, after the development checklist and all production governance gates pass.

## Activation State

CD is designed but intentionally not activated because the repository has no Next.js application or linked Vercel project. No placeholder deployment workflow is added. Activation requires Vercel project IDs, separate development/production environment secrets, an EU Supabase project, and the approved email-provider configuration.

Sources: `../../construction/ci-pipeline/ci-config.md`; `../../construction/ci-pipeline/quality-gates.md`; `../../construction/access-foundation/infrastructure-design/shared-infrastructure.md`; unit `infrastructure-design/cicd-pipeline.md` artifacts.
