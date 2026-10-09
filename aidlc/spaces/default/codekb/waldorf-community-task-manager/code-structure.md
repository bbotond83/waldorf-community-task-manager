# Code Structure

Static synthesis of the revalidated 2026-10-06 developer scan for `261006-simplify-user-roles`, Standard depth, branch `feature/simplify-user-roles`, observed HEAD `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Full repository breadth with partial deep coverage. No application changes, tests, builds, browser sessions, migrations or target calls were performed.

## Package and Module Organization

One private ESM package `waldorf-community-task-manager` version `0.2.0`; no workspace packages or separate deployable services. Breadth inventory: 80 tracked `src` files, 71 `app` files, nine scripts, one SQL migration and one GitHub workflow. These are source counts, not execution counts.

| Path | Purpose |
| --- | --- |
| `app/` | Hungarian pages/layouts, actions, HTTP routes and UI components |
| `src/application/` | Facades, authorization contracts, results, projection, idempotency and evidence |
| `src/runtime/` | Config, profiles/signed sessions, shell and production composition |
| `src/access/`, `src/directory/`, `src/coordination/` | Grants/authorization, family/group directory and duty coordination |
| `src/notifications/`, `src/privacy-audit/`, `src/import-migration/` | Jobs/provider ports, retention, import/archive registry |
| `src/parent-experience/`, `src/staff-schedule/`, `src/admin-experience/` | Persona-oriented domains |
| `src/parent-web/`, `src/staff-web/`, `src/admin-core/`, `src/admin-advanced/` | Process-local adapters and fixtures |
| `scripts/`, `tests/`, `verification/` | Toolchain/delivery runners, suites, manifests and fixtures |
| `supabase/migrations/`, `.github/workflows/ci.yml` | Intended RLS/database surface and locked CI/private evidence |
| `source-materials/`, `qa-results/` | Workbook inventory and historical evidence |
| `aidlc/`, `.aidlc-archive/`, `.codex/`, `.agents/` | Workflow knowledge/history and framework tooling |

## File Classification

TS/TSX production source, colocated domain `*.test.ts`, JSON manifests/fixtures/lockfile, SQL migration and Markdown usage/history. Existing generated `next-env.d.ts` local edit remains unchanged.

## Code Patterns

App Router → runtime/session and facades → authorization/ports → synthetic adapters or domain services → repository/provider interfaces. Explicit ports, barrel exports, result states and field projection concentrate public boundaries. Older domains often compress methods into long lines and lie outside explicit app/application/runtime lint/format command paths. Navigation cannot replace layout/action authorization.

## Build and Configuration

- npm lockfile with Node **24.x** / npm **11.x**, `.npmrc` engine strictness, `.nvmrc` 24, and toolchain prehooks. `next dev`, `next build`, `next start`; development/start default to loopback.
- Strict TypeScript, ES2024, bundler resolution, no emit, `.ts` import extensions. Next.js uses App Router, promise-based params/searchParams, async cookies and a root `proxy.ts` CSP boundary.
- Config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, three Playwright configs.
- Dependency direction: App Router → runtime/session + application facades → authorization/ports → synthetic adapters or domain services → repository/provider interfaces. Access types are shared across domains. Barrel exports concentrate public surfaces. Production composition currently initializes an authorization port returning no current version and makes no backend call (`src/runtime/production/composition.ts:8`).
- No code changes were made; Next.js API documentation must be consulted before future implementation, per `AGENTS.md`.

## Role Change Surface

[Dependencies](dependencies.md) maps role types, profiles, session gates, contracts, RLS and verification. Historical records retain the meaning of old roles. Before future Next.js implementation read the installed guides required by `AGENTS.md`.
