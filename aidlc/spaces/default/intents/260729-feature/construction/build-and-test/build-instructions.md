# Build Instructions

## Prerequisites and Commands

Use Node.js 24 or newer and npm. Run `npm install`, then `npm run typecheck`. This repository is a typed domain-library implementation rather than a bundled Next.js application, so successful TypeScript compilation is the current build artifact. Production integration additionally requires applying `supabase/migrations/20260806_access_rls.sql` to a provisioned EU-region Supabase project.

## Verification and Troubleshooting

The build passes when `tsc --noEmit` exits zero and all imports resolve. If compilation fails, fix the first reported contract mismatch, rerun the targeted test, then rerun typecheck. Do not bypass errors with relaxed compiler settings. Environment/provider deployment remains outside this local build and is governed by the infrastructure and release acceptance plans.

Sources: `../access-foundation/code-generation/code-generation-plan.md`; `../access-foundation/code-generation/code-summary.md`; all unit code summaries under `construction/*/code-generation/`.
