# Dependencies

> Focused merge, 2026-10-02 (`261002-slow-profile-login`): the earlier sections are preserved historical prose from an UNVERIFIED store, including the prior startup diagnosis and pending loader choices. They are not current defect claims. Fresh conclusions are in the profile-login update below; exact newly analyzed files appear in reverse-engineering-timestamp.md. No tests, latency measurements, browser sessions, or backend calls were performed.


> Focused update, 2026-10-01: earlier repository-wide prose is preserved as historical static knowledge; its freshness was UNVERIFIED. Only the deep files listed in reverse-engineering-timestamp.md were analyzed for this update. No tests or runtime/external checks were executed.

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

## Startup Dependency Boundary

All lifecycle prehooks call toolchain validation, then the configuration CLI; the CLI imports the pure runtime schema and Zod. Next initialization follows only after those checks. Next 16.3.6 depends transitively on `@next/env` 16.3.6. Selecting that loader for the fix would require a direct application dependency and corresponding lockfile update rather than assuming a transitive package remains available.

Loader choice is pending; retain the dependency direction from environment initialization at the CLI boundary into pure schema validation. No new domain or external-service dependency is required by the diagnosis.

## Focused Login Dependencies — 2026-10-02

The selector couples a native browser form to the synthetic session handler, local runtime/session signing and a root GET. Root and role resolvers compose runtime independently; role facade creation can compose it again. Synthetic composition imports runtime values through the broad `src/application/index.ts` re-export barrel. Its compiled-module and first-use latency effects have not been measured.

Parent fixtures use in-process Maps with a cached parent facade; admin core and the skimmed advanced adapter use lazy global containers; staff schedule is fixed local data. Session signing uses local HMAC, JSON, random nonce and Zod. No network authentication, database query, remote timeout or seed import appears on the scanned selector/root path. No InsForge or Supabase SDK is declared in the manifest; production composition exposes `supabase-unlinked` and makes no target call. Unrelated SQL/RPC prose above remains historical.

The earlier pending-loader statements describe the previous startup investigation; this focused login scan does not establish a current loader defect. Prehooks run at process startup, not per login. See technology-stack.md for locally recorded versions.
