# API Documentation

> Focused update, 2026-10-01: earlier repository-wide prose is preserved as historical static knowledge; its freshness was UNVERIFIED. Only the deep files listed in reverse-engineering-timestamp.md were analyzed for this update. No tests or runtime/external checks were executed.

## HTTP Route Handlers

Three Next.js handlers were identified:

| Method and path | Location | Behavior and boundary |
|---|---|---|
| GET /api/readiness | app/api/readiness/route.ts | Local application readiness response; does not prove external production targets are available |
| POST /api/synthetic/session | app/api/synthetic/session/route.ts | Selects/operates a synthetic session |
| POST /api/synthetic/reset | app/api/synthetic/reset/route.ts | Resets local synthetic state |

Synthetic mutation routes reject non-synthetic mode and require same-origin requests. Session selection/reset are local harness operations, not public API endpoints.

## Next.js Server Actions

These are framework-bound FormData/action contracts, not a separately versioned REST API.

- **Authentication/invitation:** synthetic login and invitation acceptance.
- **Parent:** signup, swap, cancellation, notification-read, and contribution.
- **Administrator:** records, tasks, assignments, approvals, event notes, import/conflict/recovery, reminders, governance, privacy lifecycle, and settings.

Actions delegate through role facades and shared application contracts. Typed action results express ready, empty, denied, and validation outcomes.

## Internal TypeScript Contracts

Typed ports and facades are the primary internal APIs for application orchestration, authorization/session versioning, directory, coordination, migration, notifications, role experiences, privacy/audit, and runtime composition. There is no OpenAPI, GraphQL, gRPC specification, or standalone package-root export.

## Database and RPC Surface

supabase/migrations/20260806_access_rls.sql declares role/version tables, scoped RLS policies, and:

- authorization_version_for
- has_active_scope
- has_admin_scope

src/access/supabase-route-adapter.ts calls the first two through a narrow injected client port. No Supabase SDK, generated database types, migration runner, or live SQL integration test was found. Production authentication and persistence remain unlinked.

## Security and Error Boundaries

- Expected application failures use explicit result states mapped at the application boundary.
- Synthetic mutation endpoints enforce same-origin and synthetic-mode checks.
- Application and access modules express authorization/scope checks; the migration contains RLS policy scaffolding.
- Runtime enforcement against a linked Supabase target was not verified.

## Verification Limits

No route requests, application sessions, external calls, or database operations were run. The APIs are documented from static source inspection only.

## Fresh Runtime Configuration Contracts

`validateRuntimeConfig(environment)` performs pure schema validation and returns explicit valid/error states. Missing or unsupported runtime mode fails; production mode additionally requires a session secret of at least 32 characters, HTTPS Supabase URL, and key of at least 20 characters. Synthetic fixture version has a constrained default. `formatRuntimeConfigError(error)` exposes only stable code and variable name, never values.

`composeRuntime(environment = process.env)` validates first and dynamically selects mode composition. `createProductionComposition(config)` remains an unlinked slot with no outbound target call in the examined implementation. The standalone validator consumes the same pure contract before framework initialization. There is no new HTTP/API contract in this bugfix; previous endpoint prose above was not freshly analyzed.
