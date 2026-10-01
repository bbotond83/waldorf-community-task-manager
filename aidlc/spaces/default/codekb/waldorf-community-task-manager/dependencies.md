# Dependencies

## Package Graph

One private npm ESM package, version 0.2.0, with package-lock.json version 3. There is no npm workspace or separate deployable service. npm ci resolves the committed lock; several direct manifest dependencies use latest, so lock regeneration can advance packages.

## External Runtime Dependencies and Status

| Dependency | Purpose | Status |
|---|---|---|
| Next.js 16.3.6 | App Router and server runtime | Active |
| React / React DOM 19.2.8 locked | UI | Active; manifest uses latest |
| Zod 4.4.3 locked | Validation/configuration | Active; manifest uses latest |
| PostgreSQL / Supabase | SQL/RLS and authorization RPC design | Partial scaffold; production connection and persistence unlinked |
| Scheduler / notification providers | Dispatch jobs | Domain ports exist; providers/scheduler not linked |
| Vercel | Historical/intended hosting target | Not linked; no deploy workflow/client |

No Supabase JavaScript SDK or generated database types were found.

## Internal Dependency Direction

1. App Router routes and actions call runtime/session composition and role facades.
2. Role facades use src/application contracts, authorization, validation, projections, idempotency, and result mapping.
3. Application contracts coordinate domain services for access, directory, coordination, import/migration, notifications, and privacy/audit.
4. Domain services depend on typed/injected repository, authorization, audit, clock, queue, provider, and event ports.
5. Synthetic composition wires deterministic in-memory profiles/adapters for the current local experience.

This is an in-process dependency graph; these modules are not separate processes or services.

## Database and Integration Dependencies

supabase/migrations/20260806_access_rls.sql defines role/version tables, scoped placeholders, RPC functions authorization_version_for, has_active_scope, and has_admin_scope, plus RLS policies. The narrow Supabase adapter invokes the first two through an injected client port. No complete domain store, migration runner, or live integration test was found.

## Quality and CI Dependencies

- Node 24.x and npm 11.x are declared toolchain requirements.
- TypeScript, ESLint, Prettier, Node tests, Vitest, Playwright, Axe, jsdom, and Testing Library support local validation.
- scripts/verification/run-local-verification.ts coordinates sequential local checks.
- .github/workflows/ci.yml runs verify:local for PRs targeting main and pushes to main. Feature-branch pushes alone do not trigger it.
- Main push workflow also creates a CycloneDX SBOM and build/SBOM attestations; Actions are pinned to immutable SHAs.

No CI deployment dependency or deploy job exists.
