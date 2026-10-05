# Component Inventory

> Focused merge, 2026-10-02 (`261002-slow-profile-login`): the earlier sections are preserved historical prose from an UNVERIFIED store, including the prior startup diagnosis and pending loader choices. They are not current defect claims. Fresh conclusions are in the profile-login update below; exact newly analyzed files appear in reverse-engineering-timestamp.md. No tests, latency measurements, browser sessions, or backend calls were performed.


> Focused update, 2026-10-01: earlier repository-wide prose is preserved as historical static knowledge; its freshness was UNVERIFIED. Only the deep files listed in reverse-engineering-timestamp.md were analyzed for this update. No tests or runtime/external checks were executed.

One Next.js package contains these in-process responsibility areas. They are not independently deployed services. Component headings are the canonical names used in the timestamp scope block.

## App Router delivery

**Location:** app/  
**Responsibility:** Hungarian parent (/szulo), staff (/munkatars), and administrator (/admin) experiences; login, synthetic invitation, access denied, shared role components/layouts, server actions, and three route handlers.  
**Depends on:** runtime composition, role facades, application contracts.  
**Assessment:** Active synthetic delivery layer; production data path is not established.

## Runtime and mode composition

**Location:** src/runtime/  
**Responsibility:** Zod configuration validation, synthetic/production selection, profile shell, origin boundary, and synthetic session handling.  
**Depends on:** application/access contracts and selected adapters.  
**Assessment:** Synthetic mode is linked; production slot validates configuration but makes no target call.

## Application contract pipeline

**Location:** src/application/  
**Responsibility:** Shared result/contract types, authorization matrix and session-version invalidation, facade pipeline, validation, projection, idempotency, and evidence abstractions.  
**Depends on:** domain services and injected ports.  
**Assessment:** Central typed seam between delivery, domain, and adapters.

## Access authorization

**Location:** src/access/  
**Responsibility:** Role grants, scope authorization, audit/repository ports, in-memory adapters, and minimal Supabase RPC port adapter.  
**Depends on:** application/runtime contracts and injected RPC client.  
**Assessment:** Authorization logic is present; production auth and linked Supabase target are outstanding.

## Directory domain

**Location:** src/directory/  
**Responsibility:** Family/parent/child data, group and school-year relationships, visibility, archive/restore.  
**Depends on:** application contracts and injected repositories.  
**Assessment:** Domain logic exists; production persistence is unlinked.

## Coordination domain

**Location:** src/coordination/  
**Responsibility:** Capacity-limited sign-up, optimistic versions, assignments, swaps, cancellation, contributions, allergen access checks, audit/event ports.  
**Depends on:** application contracts and injected ports.  
**Assessment:** Rich domain behavior exists; durable production storage/provider behavior is not established.

## Import and migration domain

**Location:** src/import-migration/  
**Responsibility:** Workbook sheet registry, row validation, preview/fingerprint, conflict resolution, commit, rollback, recovery.  
**Depends on:** application contracts and migration adapters.  
**Assessment:** Contracts cover migration lifecycle; no production execution was verified.

## Notifications and jobs

**Location:** src/notifications/  
**Responsibility:** 7-day/24-hour schedules and durable dispatch/retry/cancellation jobs via provider/store/queue ports.  
**Depends on:** application contracts and injected scheduler/provider/store ports.  
**Assessment:** Domain/job contracts exist; providers and scheduler are unlinked.

## Parent experience

**Location:** src/parent-experience/ and src/parent-web/  
**Responsibility:** Parent services for duties, requests, notifications, contributions, with synthetic fixtures/adapters.  
**Depends on:** application, directory, coordination, and notification contracts.  
**Assessment:** Local synthetic interface exists; real user and persistence integration is outstanding.

## Administrator experience

**Location:** src/admin-experience/, src/admin-core/, src/admin-advanced/  
**Responsibility:** Records, tasks, assignments, approvals, import, reminders, governance, privacy, and settings with synthetic local adapters.  
**Depends on:** application contracts and access/directory/coordination/migration/privacy services.  
**Assessment:** Broad synthetic surface; production authorization and persistence are not established.

## Staff schedule

**Location:** src/staff-schedule/ and src/staff-web/  
**Responsibility:** Schedule query contracts and synthetic staff experience.  
**Depends on:** application contracts and synthetic profile state.  
**Assessment:** Local role surface exists; live scheduling integration is unlinked.

## Synthetic in-memory adapters

**Location:** src/parent-web/, src/admin-core/, src/admin-advanced/, src/staff-web/, and synthetic runtime profile wiring.  
**Responsibility:** Deterministic in-memory profiles, fixtures, and local feature facades.  
**Depends on:** role facades and application contracts.  
**Assessment:** Supports local UI/tests, not production durability.

## Privacy and audit

**Location:** src/privacy-audit/  
**Responsibility:** Family personal-data lifecycle, grace/hold deferral, anonymization, and audit retention behind repository ports.  
**Depends on:** application/access contracts and injected repositories.  
**Assessment:** Policies are represented; live durable execution remains unverified.

## Supabase RPC and SQL scaffold

**Location:** src/access/supabase-route-adapter.ts and supabase/migrations/20260806_access_rls.sql  
**Responsibility:** Narrow auth RPC calls and role/version/RLS SQL definitions.  
**Depends on:** Supabase/PostgreSQL target and runtime client injection.  
**Assessment:** Partial authorization scaffold only; no linked target or complete domain store.

## Verification and CI

**Location:** tests/, scripts/, .github/workflows/ci.yml  
**Responsibility:** Domain/runtime/integration/browser/accessibility checks, verification evidence, privacy/secret/SAST/no-deploy scans, CI, SBOM, attestations.  
**Depends on:** Node/npm toolchain and GitHub Actions.  
**Assessment:** Extensive configured suite; no checks were run for this scan. CI has no deployment job.

## AI-DLC governance

**Location:** aidlc/, .codex/, .agents/  
**Responsibility:** Project scopes/rules, lifecycle records, agent/stage/hook/sensor/tool runtime and archived process artifacts.  
**Depends on:** installed AIDLC 2.10.0 Codex distribution.  
**Assessment:** Governance is versioned; historical claims must be reconciled against current app source.

## Local startup lifecycle

**Location:** package.json, scripts/validate-runtime-config.ts, scripts/validate-toolchain.mjs, README.md, .nvmrc, .npmrc, .env.example, next.config.ts.  
**Responsibility:** Contributor setup, strict toolchain validation, runtime configuration validation before dev/build/start.  
**Depends on:** npm lifecycle, pure runtime schema, Node and Next CLI.  
**Assessment:** At risk: every prehook runs before framework env loading; README assumes nvm. Host/port shell expansion is an inherited-process boundary.

## Runtime configuration validation

**Location:** src/runtime/config.ts, src/runtime/composition.ts, src/runtime/production/composition.ts.  
**Responsibility:** Pure schema validation, safe error formatting, and mode selection; this component names only the freshly analyzed subset of the broader historical runtime component.  
**Depends on:** Zod and selected composition modules.  
**Assessment:** Typed result boundary and invalid-config checks must be preserved; production composition is unlinked.

## Local startup smoke harness

**Location:** scripts/start-smoke.mjs.  
**Responsibility:** Run loopback production output and request documented readiness route.  
**Depends on:** npm start and loopback HTTP readiness.  
**Assessment:** Explicit synthetic-mode injection bypasses the env-file startup symptom. Handler body and test assertions were not scanned.

## Synthetic profile login boundary

**Location:** `src/runtime/ProfileSelector.tsx`, `app/api/synthetic/session/route.ts`, `src/runtime/session/session.ts`, origin/profile/runtime wiring.  
**Responsibility:** Submit fixed profile selection, validate mode/origin/profile, own the local signed-session token lifecycle and root redirect.  
**Depends on:** Next response/cookie APIs, local crypto and Zod, runtime composition.  
**Assessment:** At risk for an unmeasured latency regression; broad browser cache clearing is observed, with no proven causal effect.

## Profile landing and role navigation

**Location:** `app/page.tsx`, `src/runtime/AppShell.tsx`, `proxy.ts`, and freshly read parent/staff/admin layout/session/facade/landing files.  
**Responsibility:** Resolve the selected profile, render greeting/navigation and separately load role projections; does not own session mutation.  
**Depends on:** runtime composition and local role facades.  
**Assessment:** Dynamic profile isolation is explicit; repeated resolution/composition exists, elapsed cost unknown. Coverage applies only to listed deep files.

## Parent authentication entry

**Location:** `app/belepes/page.tsx`, `actions.ts`, `AuthenticationEntry.tsx`, `src/application/session-facade.ts`.  
**Responsibility:** Synthetic identifier validation and safe parent-destination continuation; delegates token ownership to the session boundary.  
**Depends on:** local parent/session facade and cookie helper.  
**Assessment:** Separate flow with pending state and manual continuation; signed-out action timing is uncovered.

## Local synthetic session adapters

**Location:** freshly read parent/staff/admin synthetic adapters and runtime composition.  
**Responsibility:** Own local fixtures/projections and wire profile role experiences; advanced-admin internals remain shallow.  
**Depends on:** application barrel, authorization/session contracts and domain seams.  
**Assessment:** In-process Maps/global containers and fixed staff schedule; no durable or external auth integration on the inspected path.

## Login regression surface

**Location:** the focused runtime unit/integration/browser files listed in the timestamp.  
**Responsibility:** Specify functional session/profile isolation and role navigation, with role-page performance coverage after selection.  
**Depends on:** Node/Vitest/Playwright tooling and synthetic fixture reset.  
**Assessment:** At risk: click-to-profile-ready timing and first-use conditions are absent. No suite ran.
