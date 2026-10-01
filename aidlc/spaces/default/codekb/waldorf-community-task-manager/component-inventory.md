# Component Inventory

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
