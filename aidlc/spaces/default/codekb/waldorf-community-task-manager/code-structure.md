# Code Structure

> Focused update, 2026-10-01: earlier repository-wide prose is preserved as historical static knowledge; its freshness was UNVERIFIED. Only the deep files listed in reverse-engineering-timestamp.md were analyzed for this update. No tests or runtime/external checks were executed.

## Repository Shape

One private npm ESM package, version 0.2.0, with no workspace or separately deployable service packages. The application is split between the Next.js delivery layer in app/ and TypeScript modules in src/. There are 15 top-level src modules.

## Major Areas

| Path | Responsibility |
|---|---|
| app/ | Hungarian Parent, Staff, Administrator, login, invitation, and access-denied UI; layouts, server actions, and route handlers |
| src/application/ | Shared result/contract types, authorization matrix/session-version invalidation, facade pipeline, validation, projections, idempotency, evidence |
| src/runtime/ | Zod configuration validation, synthetic/production composition, profile shell, origin boundary, synthetic sessions |
| src/access/ | Role grants, scope authorization, audit/repository ports, in-memory adapters, narrow Supabase RPC adapter |
| src/directory/ | Family/parent/child contracts, groups, school-year links, visibility, archive/restore |
| src/coordination/ | Sign-up/capacity, optimistic versions, assignments, swaps, cancellations, contributions, allergen checks, audit/event ports |
| src/import-migration/ | Workbook registry, validation, preview/fingerprint, conflict resolution, commit, rollback, recovery |
| src/notifications/ | 7-day/24-hour schedule and dispatch/retry/cancellation jobs through ports |
| src/parent-experience/, src/admin-experience/, src/staff-schedule/ | Role application services and explicit ready/empty/denied/validation results |
| src/parent-web/, src/admin-core/, src/admin-advanced/, src/staff-web/ | Synthetic fixtures and feature facades for local experiences |
| src/privacy-audit/ | Family-data lifecycle, deferral/hold, anonymization, retention behavior |
| supabase/migrations/ | One authorization/RLS SQL scaffold; not a production persistence integration |
| tests/ and colocated tests | Domain, runtime, integration, browser, and accessibility checks |
| scripts/ | Toolchain validation, smoke startup, manifests/evidence, privacy/secret/SAST/no-deploy checks, verification orchestration |
| .github/workflows/ | GitHub Actions CI |
| aidlc/, .codex/, .agents/ | Project governance, AI-DLC records and runtime; distinct from application source |
| source-materials/, qa-results/, verification/ | PRD/workbook inputs and historical/synthetic/linked-target evidence |

## Structural Patterns

- Delivery enters through App Router pages/actions and delegates to role facades.
- Shared contracts, authorization, validation, result mapping, and projection live under src/application/.
- Domain services depend on typed/injected ports for repositories, authorization, audit, clock, queues, providers, and events.
- Synthetic adapters are selected by runtime composition for the currently linked local UI.
- Production composition remains an unlinked configuration-checking slot.

## Build and Configuration

The package is Node/npm with Next.js App Router, React, and TypeScript. Configuration includes package.json and package-lock.json, .nvmrc, .npmrc, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts, .env.example, and .github/workflows/ci.yml. The local verification entry is scripts/verification/run-local-verification.ts.

## File Classification

- **Delivery:** app/ and role-specific web adapters.
- **Application/runtime:** src/application/, src/runtime/, and role experience services.
- **Domain:** access, directory, coordination, import-migration, notifications, privacy-audit.
- **Adapters/integration seams:** synthetic web/core modules and minimal Supabase RPC adapter.
- **Persistence scaffold:** supabase/migrations/.
- **Quality/CI:** tests/, scripts/, .github/workflows/ci.yml.
- **Governance:** aidlc/, .codex/, .agents/.

See component-inventory.md for ownership and dependency summaries.

## Focused Startup File Classification

| File | Startup responsibility |
|---|---|
| README.md | Supported runtime selection and fresh-checkout procedure |
| package.json | Node/npm engines, lifecycle hooks, build/start/check commands |
| package-lock.json | Root metadata and exact framework/tool versions; unrelated entries not assessed |
| .nvmrc / .npmrc | Node 24 selection hint and strict engine enforcement |
| .env.example | Documented synthetic defaults and commented production variable names |
| next.config.ts | Framework configuration |
| scripts/validate-toolchain.mjs | Enforce Node/npm majors with stable errors |
| scripts/validate-runtime-config.ts | Standalone prehook CLI; reads inherited env without file initialization |
| scripts/start-smoke.mjs | Loopback readiness check; explicitly injects synthetic mode |
| src/runtime/config.ts | Pure Zod schema, explicit result states, safe error formatting |
| src/runtime/composition.ts | Validate then select synthetic or production composition |
| src/runtime/production/composition.ts | Unlinked production adapter slot |

This table is the fresh startup surface. Whole `scripts/` and `src/` directories were inventoried only beyond these files. Supporting installed Next documentation was read by the developer but is not repository-source coverage.
