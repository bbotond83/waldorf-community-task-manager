# Code Structure

## Package and Module Organization

One private package, `waldorf-community-task-manager` v0.2.0; no npm workspace packages.

| Location | Classification and purpose |
|---|---|
| `app/` | Next.js pages, layouts, Route Handlers, Server Actions, forms, loading/error states and CSS |
| `src/access/`, `directory/`, `coordination/`, `notifications/` | Authorization, relationships, task coordination and notification domain services/ports |
| `src/parent-experience/`, `staff-schedule/`, `admin-experience/` | Role-specific domain services |
| `src/import-migration/`, `privacy-audit/` | Migration preview/transaction and privacy lifecycle contracts |
| `src/application/` | DTOs, typed results, validation, authorization/projection/idempotency and session/role facades |
| `src/parent-web/`, `staff-web/`, `admin-core/`, `admin-advanced/` | Synthetic application adapters, presentation support and stores |
| `src/runtime/` | Runtime config/composition, profile selector, shell, origin guard and signed session; synthetic/production modes |
| `scripts/`, `verification/` | Executable local checks plus verification contracts/runbooks and evidence |
| `tests/`, colocated `*.test.ts` | Unit, integration, browser and coverage infrastructure |
| `supabase/migrations/` | Proposed SQL/RLS/RPC schema, not exercised against a target |
| `.github/workflows/` | CI build/check/security/provenance pipeline |
| `aidlc/`, `source-materials/`, user guide and `qa-results/` | Lifecycle records, original references and historical evidence |

## Code Patterns and Boundaries

Strict TypeScript; explicit port interfaces and constructor injection; discriminated application failures; role/scope context derived at server boundaries; optimistic versions and idempotency keys for applicable mutations. Synthetic adapters are direct application-port implementations and need not traverse the older domain service implementations. Older services have some dense one-line formatting.

## Build and Configuration

npm lockfile; `next dev`, `next build`, `next start` and `tsc --noEmit`. Node 24/npm 11 are required by toolchain checks. `predev` uses development environment loading; build/start use production defaults. `APP_RUNTIME_MODE` is distinct from `NODE_ENV`, so a production build may still be synthetic. The optional restricted `.next/login-performance-*` output isolates development measurements; ordinary development uses `.next`.

## Coverage Qualification

The scan inventoried the whole repository but did not deeply assess every UI detail, barrel, test or reference file. The exact scope is [reverse-engineering-timestamp.md](reverse-engineering-timestamp.md); public surfaces and component ownership are in their dedicated documents.
