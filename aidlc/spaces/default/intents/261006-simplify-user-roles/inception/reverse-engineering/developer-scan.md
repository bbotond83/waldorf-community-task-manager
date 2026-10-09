# Repository Rescan: Simplify User Roles

## Developer Code Scan Results

Scan date: 2026-10-06. Intent: `261006-simplify-user-roles`. Branch: `feature/simplify-user-roles`. Observed HEAD: `0dce0567f18dc72e46aa88d87e5626708b08bc7d`. Depth: Standard. User-selected breadth: full repository rescan. This handoff describes current source, not implemented changes or executable verification results. No tests, builds, browser sessions, target calls, or migrations were executed.

### Scan Coverage

The scan inventoried the whole tracked repository and examined every application/domain module's source surface and role references. Deep understanding is concentrated in the paths listed below; other files were inventoried, searched, or examined through selected declarations and sections. Full rescan means replacement of the nine CodeKB documents; it does not justify a `kind: full` freshness claim for files only skimmed. Use `kind: partial` and these deep paths when minting the verified scope. Snapshot coverage `./` contains every path below.

- **Analyzed deeply**:
  - `package.json`
  - `README.md`
  - `.github/workflows/ci.yml`
  - `.gitignore`
  - `.npmrc`
  - `.nvmrc`
  - `.prettierignore`
  - `.prettierrc.json`
  - `next.config.ts`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `vitest.config.ts`
  - `playwright.config.ts`
  - `proxy.ts`
  - `src/access/`
  - `src/runtime/`
  - `src/application/authorization.ts`
  - `src/application/contracts.ts`
  - `src/application/facade-pipeline.ts`
  - `src/application/session-facade.ts`
  - `src/application/staff-facade.ts`
  - `src/directory/directory-service.ts`
  - `src/import-migration/import-service.ts`
  - `src/coordination/coordination-service.ts`
  - `src/coordination/types.ts`
  - `src/parent-experience/parent-experience-service.ts`
  - `src/notifications/notification-service.ts`
  - `src/notifications/durable-jobs.ts`
  - `src/privacy-audit/lifecycle-service.ts`
  - `src/admin-experience/admin-service.ts`
  - `src/staff-schedule/schedule-service.ts`
  - `src/staff-web/synthetic-staff.ts`
  - `app/api/`
  - `app/page.tsx`
  - `app/belepes/actions.ts`
  - `app/belepes/page.tsx`
  - `app/admin/_lib/session.ts`
  - `app/admin/layout.tsx`
  - `app/admin/import/layout.tsx`
  - `app/admin/advanced-actions.ts`
  - `app/admin/beallitasok/page.tsx`
  - `app/munkatars/_lib/session.ts`
  - `app/munkatars/layout.tsx`
  - `app/munkatars/beosztas/page.tsx`
  - `app/munkatars/beosztas/[id]/page.tsx`
  - `app/szulo/_lib/session.ts`
  - `supabase/migrations/`
  - `verification/AUTHORIZATION.md`
  - `verification/authorization-matrix.json`
  - `verification/fixtures.json`
  - `scripts/verification/scan-artifacts.ts`
  - `scripts/verification/run-local-verification.ts`
  - `scripts/verification/validate-manifests.ts`
  - `tests/coverage/support/production-inventory.ts`
- **Skimmed only** (includes remaining files beside the deep files above):
  - `src/application/`
  - `src/admin-core/`
  - `src/admin-advanced/`
  - `src/directory/`
  - `src/import-migration/`
  - `src/coordination/`
  - `src/parent-experience/`
  - `src/parent-web/`
  - `src/notifications/`
  - `src/privacy-audit/`
  - `src/admin-experience/`
  - `src/staff-schedule/`
  - `src/staff-web/`
  - `app/`
  - `scripts/`
  - `tests/`
  - `verification/`
  - `package-lock.json` (direct dependency versions and package graph metadata)
  - `playwright.login-existing.config.ts`
  - `playwright.login-performance.config.ts`
  - `HASZNALATI_UTMUTATO_HU.md`
  - `source-materials/` (inventory only; workbook contents not exposed)
  - `qa-results/` (historical evidence inventory)
  - `aidlc/` (workflow and knowledge inventory, current state and applicable steering read)
  - `.aidlc-archive/` (historical record inventory)
  - `.codex/` (framework inventory and required knowledge/stage instructions)
  - `.agents/` (framework inventory)
  - `AGENTS.md`
  - `.env.example` (configuration-name surface only)
  - `next-env.d.ts` (generated declaration inventory; existing local edit preserved)

Snapshot source fingerprint supplied by conductor: `git:eb4862559f80967f13a0cfcb4d9f0e3d571405b6`. Snapshot store generation: `sha256:76d1977d1018157bb1f74b43ea5498ec52c9b258ed20ade7e2b955dcc98cc6f2`. This renewed developer link revalidated the whole repository inventory and existing scan against the fresh snapshot after the conductor changed Git access mode. HEAD remains `0dce0567f18dc72e46aa88d87e5626708b08bc7d`; working-tree status shows no application edits or new application files. The preserved generated declaration edit and workflow records remain local. Role definitions, domain/application/SQL role lists, profile catalog, unlinked production boundary, manifest references and CI were inspected again and retain the findings below. The previous tree-mode fingerprint is superseded and must not be used for publication. The architect must preserve the exact fresh compare-and-swap values and mint a fingerprint over its final deep path list using the same approved outside-sandbox Git access mode as the snapshot; this handoff does not mint or publish the CodeKB.

### Packages Found

One private ESM npm package: `waldorf-community-task-manager`, version `0.2.0`. No application workspace packages or separate deployable services were discovered. The modular monolith has 80 tracked `src` files, 71 `app` files, nine script files, one SQL migration, and one GitHub workflow. Framework tooling and hundreds of historical workflow artifacts also live in the repository; they are distinct from the application package.

| Module | Responsibility | Important dependencies / ownership |
| --- | --- | --- |
| `src/access` | Typed role grants, scoped authorization, revocation, redacted audit; in-memory adapters and Supabase RPC port | Shared `Role`/`Scope`; domain services consume access ports |
| `src/directory` | Families, parents, children, school-year/group relationships, archive/restore, consent-sensitive projection | Access authorizer and role grants, transactional repository, visibility recalculation |
| `src/coordination` | Capacity-sensitive signup, swaps, cancellation approval, contribution/allergen access | Directory visibility, repository transactions, assignment events, optional admin authorizer |
| `src/notifications` | Seven-day/24-hour scheduling, duplicate job avoidance, durable dispatch/retry/cancel | Queue/store/provider ports; synthetic behavior and tests, no linked scheduler |
| `src/privacy-audit` | Family lifecycle deferral, deletion/anonymization, audit retention | Repository transaction port; 30-day grace and 365-day audit purge with holds |
| `src/import-migration` | Required 17-sheet registry, consent validation, conflict resolution, fingerprint-bound commit/rollback | In-memory transactional import repository; archive/process ownership metadata |
| `src/parent-experience` | Own-family projection, notifications, signup/swap/cancel command ports | Directory visibility and parent repository |
| `src/staff-schedule` | Read-only date-filtered schedules with allowlisted projection | Access authorizer and schedule repository; maximum 31-day filter |
| `src/admin-experience` | Scope-filtered queues, school years, administrative operations, legacy archive presentation | Access authorizer, repository/operation ports, import destinations |
| `src/application` | Facade orchestration, authorization matrix, result states, field projection, idempotency, events/evidence | Access types; parent/staff/admin/session domain ports |
| `src/runtime` | Environment validation, synthetic/production composition, profiles, signed local cookie, shell | Zod, Node crypto, application authorization; production is unlinked |
| `src/admin-core` | Stateful synthetic records/tasks/assignments/approval/archive adapter | Admin facade/ports and runtime authorization |
| `src/admin-advanced` | Synthetic import, reminder, governance, lifecycle/settings workflows | Core adapter plus advanced store; scope/version/idempotency boundaries in facade |
| `src/parent-web` | Synthetic parent duties, notifications, invitation/session adapter | Parent/session facades, profile catalog, process-local mutable fixtures |
| `src/staff-web` | Synthetic schedule entries, allowed groups, empty/denied/dependency scenarios | Staff facade, explicitly projected schedule fields |
| `app` | Hungarian App Router pages, layouts, server actions, access states and responsive components | Runtime, session resolvers, facade boundary; UI does not itself define effective permission policy |

### Build System

- npm lockfile with Node **24.x** / npm **11.x**, `.npmrc` engine strictness, `.nvmrc` 24, and toolchain prehooks. `next dev`, `next build`, `next start`; development/start default to loopback.
- Strict TypeScript, ES2024, bundler resolution, no emit, `.ts` import extensions. Next.js uses App Router, promise-based params/searchParams, async cookies and a root `proxy.ts` CSP boundary.
- Config: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `vitest.config.ts`, three Playwright configs.
- Dependency direction: App Router → runtime/session + application facades → authorization/ports → synthetic adapters or domain services → repository/provider interfaces. Access types are shared across domains. Barrel exports concentrate public surfaces. Production composition currently initializes an authorization port returning no current version and makes no backend call (`src/runtime/production/composition.ts:8`).
- No code changes were made; Next.js API documentation must be consulted before future implementation, per `AGENTS.md`.

### APIs Discovered

Three explicit HTTP route handlers:

| Endpoint | Input / protection | Outcome |
| --- | --- | --- |
| `GET /api/readiness` | Runtime config composition; no auth requirement | 200 stable mode/status/marker; 503 stable config error |
| `POST /api/synthetic/session` | Synthetic mode only; Origin and Host equality; form `profileId` | 303 to `/` and rotated signed HttpOnly Lax cookie; empty ID clears cookie; 400 invalid form/profile; 403 origin denied; 404 unavailable in production |
| `POST /api/synthetic/reset` | Synthetic mode only; same origin | Resets process-local parent/admin/advanced fixtures; stable fixture-version success; 403/404 otherwise |

Server-action surfaces: parent login; invitation accept/resend; parent signup, swap, cancellation, notification-read and contribution update; admin record save/archive/restore, task save/assignment, approval decision and event notes; advanced import preview/resolve/commit/recover, reminder retry, grant revoke, lifecycle run and settings save. These are framework action invocations, not a public versioned REST API.

Page surfaces inventoried: `/`, `/belepes`, `/meghivas/[token]`, `/hozzaferes-megtagadva`; `/szulo/feladatok` and detail/swap/cancel, `/szulo/ertesitesek`; `/munkatars/beosztas` and detail; `/admin` plus record/task/approval/archive lists/details/new forms, import, reminders, privacy, settings. Layouts and actions resolve sessions independently of navigation visibility.

Internal APIs: `AccessService.authorize/grantRole/revokeRole`; `AuthorizationContract.authorize/navigation`; `SessionApplicationFacade` resolve/select/switch/invitation/navigation; `ParentApplicationFacade` duty and notification operations; `StaffApplicationFacade.getSchedule/getScheduleEntry`; admin facade core operations and import/reminder/governance/lifecycle/settings subfacades. `SupabaseRouteAdapter` exposes RPC `authorization_version_for` and `has_active_scope`. SQL also defines `has_admin_scope`; no concrete Supabase client/SDK dependency is installed in the application manifest.

### Current Role and Authorization Inventory

| Display concept | Domain ID (`src/access/types.ts:1`) | Synthetic profile ID / role | Current scope and behavior |
| --- | --- | --- | --- |
| Parent | `parent` | `parent-local` / `parent` | Own-family duties/requests/contributions and notifications |
| Group Administrator | `group_admin` | `group-admin-local` / `group-admin` | Granted group core records/tasks/assignments/approvals/archive; application import explicitly denied |
| Kindergarten Administrator | `kindergarten_admin` | `kindergarten-admin-local` / `kindergarten-admin` | Organization operations including import/reminders/privacy/settings; application governance denied |
| Read-only Staff | `read_only_staff` | `staff-local` / `staff` | Granted-group schedule/coordination display names; no mutation/contact/profile/protected reasons |
| Super Administrator | `super_admin` | `super-admin-local` / `super-admin` | Organization administration plus governance |

There is **no existing `kindergarten_teacher` role** or teacher profile. The user named four desired roles, but did not decide whether teacher replaces the read-only staff concept, the kindergarten administrator concept, combines them, or has a different permission matrix. Existing permission behavior must remain factual evidence for that decision.

Cross-cutting dependency map:

1. `src/access/types.ts:1` defines the five-role union; `access-service.ts:52` applies role branches. Domain kindergarten admins can do almost everything except super-admin grant changes; group admins are broadly allowed any scoped resource except role grants. The terminal branch behaves like read-only staff without a runtime explicit role check. Removing a union member alone does not reject unknown persisted role strings at runtime.
2. `src/application/authorization.ts:41` defines eight typed matrix rows, one explicit group import denial, and a role home map at line 135. `contracts.ts:81` fixes row IDs; `GrantModel` at line 247 restricts displayed grants to three admin roles. Domain policy and application policy are distinct; replacing one leaves inconsistent effective behavior elsewhere.
3. `src/runtime/synthetic/profiles.ts:4` validates five profile IDs; catalog starts at line 50 and supplies five Hungarian labels and three navigation sets. `ProfileSelector` renders the catalog dynamically. Session token payload stores profile ID and version; resolving it requires the profile still exists and has matching version (`session/session.ts:81`). A removed profile will invalidate its cookie without a compatibility alias unless explicitly designed otherwise.
4. `app/admin/_lib/session.ts:28` maps profile-role vocabulary to domain roles, gates three admin roles at line 69, and gives group admin group scope versus organization scope for other administrators. `app/munkatars/_lib/session.ts:33` accepts only synthetic role `staff`, emitting `read_only_staff` and every `STAFF_GROUPS` scope. Parent has a separate resolver. These gates need coherent updates alongside the role catalog.
5. `src/application/admin-facade.ts:483` selects kindergarten/super/group rows; advanced commands use this selector except governance's explicit super-only row. `app/admin/import/layout.tsx:8` independently denies group admins. `app/admin/beallitasok/page.tsx` requests settings and governance separately, showing governance only on success. Removing kindergarten admin leaves the super admin as the existing organization-operation role unless requirements change grants.
6. `src/directory/directory-service.ts:102` enumerates all three admin roles for sensitive family fields and mutations; its checks include family scope plus child group scopes. Keep family/group relationship protections when changing roles.
7. `src/staff-web/synthetic-staff.ts:12` defines granted Tölgyfa/Napraforgó groups and an ungranted denial fixture; `StaffApplicationFacade` requests `AUTH-STAFF-SCHEDULE`. These are actual kindergarten group scopes, not obsolete role categories. Admin/parent fixtures use other scope IDs (`org-napsugar`, `group-boroka`), while verification fixtures name still other IDs. Do not remove domain groups based only on the word “groups” in the intent.
8. SQL `20260806_access_rls.sql:34` lists `super_admin`, `kindergarten_admin`, `group_admin` in `has_admin_scope`. `app_role_grants.role` is unconstrained text; migration has no role enum or cleanup/mapping. `has_active_scope` ignores role and checks active scope. Domain tables have select/write RLS policies; group-admin import behavior is broader in SQL than application denial. Migration execution and real rows are unknown.
9. `src/import-migration/import-service.ts:12` contains five archive owners named `kindergarten-admin`, plus workgroup/finance/library/water-test process owners. These are ownership metadata, not additional members of `Role`. Retaining legacy sheet coverage while choosing new responsible owners is an explicit follow-up.
10. `verification/fixtures.json` contains five profiles; authorization JSON has 16 rows and a separate version `waldorf-authz-v1`; scenarios reference profile and row IDs. The TypeScript matrix version is `2026-08-12.1`. Manifest validation checks reference integrity but does not compare the permission semantics against application/domain implementations (`scripts/verification/core.ts:104–183`). Update all affected contracts and links together.

### Frameworks & Libraries

Versions below are read from the lockfile, not inferred from `latest` ranges or newly installed:

| Dependency | Resolved version | Purpose |
| --- | --- | --- |
| Next.js / `@next/env` | 16.3.6 | Web server, App Router, environment loading |
| React / React DOM | 19.2.8 | Components and action state |
| Zod | 4.4.3 | Runtime environment/profile validation |
| TypeScript | 5.9.3 | Strict static contracts |
| Node types | 24.13.3 | Node API typing |
| Vitest / coverage packages | 4.1.11 | Delivery and combined production coverage |
| Playwright | 1.62.1 | Chromium/Firefox/mobile Chrome; opt-in installed Chrome timing |
| Axe Playwright | 4.13.0 | Serious/critical accessibility gate |
| ESLint | 9.39.5 | Blocking lint |
| eslint-config-next | 16.3.0 | Framework lint rules |
| Prettier | 3.9.6 | Formatting |
| jsdom | 30.0.1 | Integration rendering environment |
| source-map-js | 1.2.2 | Transitive source maps; recently patched lockfile |

Most direct runtime/dev dependencies use `latest`; reproducibility relies on `npm ci` and lockfile. No live vulnerability audit was run during this scan.

### Test Coverage

- `src/**/*.test.ts`: colocated Node test-runner tests cover access/domain services, facades, isolation/contracts, synthetic workflows, schedules, import and lifecycle. Static declaration counts are not execution counts because tests use loops and grouped cases; no current pass count is claimed.
- `tests/unit`, `tests/integration`, `tests/coverage`: Vitest/jsdom plus Testing Library, Node-test adapter for coverage, framework entrypoint/action/session/page tests, CLI and verification tests.
- `tests/browser`: runtime foundation, parent, staff, admin core/advanced; profile login timing suites and helpers. Standard Playwright runs Chromium, Firefox, Pixel 7 mobile-Chrome with independent synthetic production servers at ports 3100–3102 and deterministic reset. Timing suites are opt-in and excluded from standard browser inventory.
- `vitest.config.ts` Istanbul coverage includes all production `app`, `src`, scripts, proxy and Next config; excludes tests/declarations; 80% line/branch/function thresholds. `tests/coverage/support/production-inventory.ts` independently inventories runtime/type-only/linkage-only source and refuses omitted runtime coverage. Domain runner also has 80% thresholds.
- Role-sensitive tests include `src/access/access-service.test.ts`, `src/application/authorization.test.ts`, `facades.test.ts`, directory/core/advanced/staff/parent tests; browser runtime/staff/admin tests; `tests/unit/runtime-boundaries.test.ts:200` asserts exactly five roles; `tests/coverage/app-session-boundaries.test.ts` and staff/admin page coverage have explicit old profiles. Login suites iterate profiles but helpers branch on `staff` and require appropriate main content/control IDs (`tests/browser/support/profile-login-measurement.ts:21`).
- Verification manifest has **39 scenarios: 33 local and six linked-target/outstanding**. Outstanding IDs: `SAFARI-DESKTOP-SMOKE`, `SAFARI-MOBILE-SMOKE`, `TARGET-SUPABASE-AUTH-RLS`, `TARGET-SUPABASE-PERSISTENCE`, `TARGET-SCHEDULER-PROVIDER`, `TARGET-VERCEL-PREVIEW-STAGING`. This is inventory, not new evidence of pass/fail.

### Code Quality Indicators

- Lint and format are blocking scripts; their path scope covers App Router, application/runtime, tests/scripts and config. Older domain modules are often compressed onto very long lines and are outside the explicit lint/format command paths. Naming and explicit ports are generally clear; exception handling and state unions exist at facade boundaries.
- CI `.github/workflows/ci.yml`: PRs/main pushes, immutable action revisions, read-only contents permissions, concurrency cancellation. Validate installs locked dependencies and browsers then runs `verify:local`: toolchain, manifests, format, lint, types, tests, coverage, security, build, smoke, full browser suite and evidence aggregation.
- A dependent build-evidence job rebuilds synthetic output, creates CycloneDX SBOM, archives `.next` without cache, writes unsigned commit/run metadata and SHA256SUMS, uploads private artifact for 14 days. It does not use GitHub attestation API. Current team/project steering still requests an artifact attestation, whereas this intentional private-repository implementation is unsigned; practices discovery should reconcile descriptive evidence honestly through its authorized process.
- Security: nonce CSP, production eval blocked, same-origin mutation endpoints, signed HttpOnly Lax local cookie, non-enumerating denial contracts, scope/version checks, field allowlists. The synthetic signing constant and nonsecure local cookie are synthetic behavior, not a production auth implementation.
- `scan-artifacts.ts` implements privacy/secret regex scans, limited app/src dangerous-code SAST patterns, and no-deploy command scans; these are bounded scanners, not complete security analysis. `npm audit --audit-level=high` blocks high/critical dependency findings when verification runs.
- `README.md`, Hungarian usage guide and verification runbook document local startup, five current roles and linked-target limitations. Historical aidlc/qa reports are prior evidence and may contain old role names or outdated counts; preserve their historical meaning.

### Technical Debt Signals

1. Role vocabularies are duplicated across five domain IDs, five hyphenated profile roles, profile IDs, UI resolvers, matrices, grants and SQL. Centralization or exhaustive type checks may help implementation, but changing identifiers requires all consumers and runtime rejection checks.
2. Domain `AccessService` grant semantics, application matrix semantics and SQL policies differ (group import, kindergarten role governance and sensitive fields). The verification JSON additionally allows sensitive administrator fields absent from the current application display-name allowlist. Treat this as a policy-alignment risk, not permission to silently broaden access.
3. `AccessService` unknown-role fallback grants staff-like read behavior for matching scope. SQL role text has no constraint. Removing roles from TypeScript is insufficient to prevent legacy/unknown runtime grants from retaining access.
4. Process-local synthetic stores simulate transactions, durable jobs, import recovery and grant revocation; their success cannot prove persistence or production restart behavior. Production adapter is a validated, unlinked slot.
5. Archive ownership strings use the obsolete kindergarten administrator label. Workgroup/process owners are distinct from application authorization roles, and kindergarten groups are business entities used for scope enforcement. Cleanup requires a precise interpretation of “unnecessary groups.”
6. Large files include application admin facade (~500 lines), synthetic advanced (~500), synthetic core (~430), parent synthetic (~415); older domains often use one-line methods. No circular-dependency proof or unused-code compiler analysis was performed. No TODO/FIXME/HACK or suppression matches were found in the bounded app/src/scripts/tests/.github search, which does not prove absence of broader debt.
7. Manifest/reference validation does not establish semantic parity across the three executable authorization layers. Historical reports and static scope dictionaries are not current runtime evidence.

## Handoff Summary

- **Intent-relevant finding**: Current five-role definitions (`src/access/types.ts:1`, `src/runtime/synthetic/profiles.ts:4`) contain kindergarten administrator and read-only staff, but no kindergarten teacher. Desired four-role behavior requires an approved teacher permission/scope decision and explicit disposition of old administrator grants; source spans UI, runtime, facades/domain authorization, SQL/RLS, import ownership metadata, fixtures/manifests, tests and documentation.
- **Risks / follow-up**: Resolve teacher permissions/home/scope, old-role/profile migration or rejection, administrator advanced-operation ownership, and whether “groups” means role categories or actual kindergarten/workgroup entities. Preserve Parent/Group admin/Super administrator scope, privacy, denial, immediate revocation and last-admin protection unless the requirements explicitly change them. Reject unknown/removed role strings at runtime. Do not claim real Supabase/RLS migration, persistence/provider/Vercel/Safari evidence from the synthetic implementation.
- **Scope handoff**: Full repository breadth, partial deep coverage exactly as listed; nine CodeKB artifacts must be replaced from this scan and carry an honest partial scope block. Shared CodeKB, workflow state, audit, and application code remain outside this agent's write ownership.
