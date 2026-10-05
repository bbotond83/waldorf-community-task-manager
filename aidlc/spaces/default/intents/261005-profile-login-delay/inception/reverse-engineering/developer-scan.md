# Repository scan — profile login delay

## Developer Code Scan Results

Intent: `261005-profile-login-delay`. Repository: unrecorded project-root repository `waldorf-community-task-manager`. Breadth selected: **Full rescan**, replacing previous knowledge; depth: **Minimal**. Source inspection only: no application changes, build, tests, browser requests, or live-target calls were performed.

Scan date: 2026-10-05. Observed HEAD: `85dab6b5c7762265357146a54e1612479e8c4302`. The checkout already contains unrelated record changes and a modified `next-env.d.ts`; those were preserved.

Snapshot supplied before this scan:

- Paths: `./`
- Store generation: `sha256:3be2c3a954288b2d6b0ef1e11a9599f48f1870981304241541e862dcac13481f`
- Source fingerprint: `tree:14d55b9afb592d94bb026f8d757da3d21ea7f485b39620457569592096989fd1`

### Scan Coverage

Every authored production module was located and its owning behavior and dependencies inspected. Deep coverage below means implementation bodies were read and understood; an inventory of an area's remaining files is not a deep claim. All paths remain inside the supplied root snapshot.

**Analyzed deeply** — suitable inputs to the final `analyzed.paths` list:

- `src/access/access-service.ts`
- `src/access/types.ts`
- `src/access/in-memory-adapters.ts`
- `src/access/supabase-route-adapter.ts`
- `src/directory/directory-service.ts`
- `src/directory/types.ts`
- `src/directory/in-memory-directory-repository.ts`
- `src/coordination/coordination-service.ts`
- `src/coordination/types.ts`
- `src/coordination/in-memory-repository.ts`
- `src/notifications/notification-service.ts`
- `src/notifications/durable-jobs.ts`
- `src/notifications/in-memory-notifications.ts`
- `src/parent-experience/parent-experience-service.ts`
- `src/parent-experience/in-memory-parent-repository.ts`
- `src/staff-schedule/schedule-service.ts`
- `src/admin-experience/admin-service.ts`
- `src/import-migration/import-service.ts`
- `src/import-migration/in-memory-import-repository.ts`
- `src/privacy-audit/lifecycle-service.ts`
- `src/application/authorization.ts`
- `src/application/contracts.ts`
- `src/application/facade-pipeline.ts`
- `src/application/idempotency.ts`
- `src/application/results.ts`
- `src/application/projection.ts`
- `src/application/validation.ts`
- `src/application/session-facade.ts`
- `src/application/parent-facade.ts`
- `src/application/staff-facade.ts`
- `src/application/admin-facade.ts`
- `src/application/evidence.ts`
- `src/parent-web/synthetic-parent.ts`
- `src/staff-web/synthetic-staff.ts`
- `src/admin-core/synthetic-admin.ts`
- `src/admin-advanced/synthetic-advanced.ts`
- `src/runtime/config.ts`
- `src/runtime/composition.ts`
- `src/runtime/types.ts`
- `src/runtime/AppShell.tsx`
- `src/runtime/ProfileSelector.tsx`
- `src/runtime/session/session.ts`
- `src/runtime/security/origin.ts`
- `src/runtime/synthetic/`
- `src/runtime/production/`
- `app/api/`
- `app/page.tsx`
- `app/layout.tsx`
- `app/belepes/actions.ts`
- `app/belepes/AuthenticationEntry.tsx`
- `app/meghivas/[token]/actions.ts`
- `app/szulo/_lib/session.ts`
- `app/szulo/_lib/facade.ts`
- `app/szulo/layout.tsx`
- `app/szulo/actions.ts`
- `app/szulo/feladatok/page.tsx`
- `app/munkatars/_lib/session.ts`
- `app/munkatars/_lib/facade.ts`
- `app/munkatars/layout.tsx`
- `app/munkatars/beosztas/page.tsx`
- `app/admin/_lib/session.ts`
- `app/admin/_lib/facade.ts`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/actions.ts`
- `app/admin/advanced-actions.ts`
- `scripts/`
- `supabase/migrations/`
- `.github/workflows/`
- `proxy.ts`
- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `playwright.login-performance.config.ts`
- `eslint.config.mjs`
- `.prettierrc.json`
- `.npmrc`
- `.nvmrc`
- `.env.example`
- `.gitignore`
- `README.md`
- `tests/browser/profile-login-performance.spec.ts`
- `tests/browser/support/profile-login-server.ts`
- `tests/unit/runtime-boundaries.test.ts`
- `tests/integration/synthetic-route.test.ts`
- `tests/integration/runtime-shell.test.tsx`
- `tests/browser/runtime-foundation.spec.ts`
- `tests/browser/parent-web.spec.ts`
- `tests/browser/staff-web.spec.ts`
- `tests/browser/admin-core.spec.ts`

**Skimmed only**:

- `app/` — remaining detail/list pages, form/state components, route loading/error files and CSS; enumerated routes/import relationships.
- `src/` — barrel exports and ordinary colocated tests; tests were located, not executed or exhaustively assessed.
- `tests/` — remaining unit/integration/browser/coverage inventories and static case names, excluding the deeply read regression files above.
- `verification/` — contracts/runbooks and historical report inventory; current executable verification behavior was read in `scripts/`.
- `package-lock.json` — direct package resolutions only, not a transitive vulnerability audit.
- `aidlc/` — current state/rules and prior login summary/measurement documents; no exhaustive historical intent audit.
- `source-materials/`, `HASZNALATI_UTMUTATO_HU.md`, `qa-results/`, `.aidlc-archive/` — documentation/reference/evidence locations only; original workbook data was not extracted.
- `.codex/`, `.agents/` — required methodology/knowledge/rules loaded; framework internals are outside this product investigation.
- Ignored `.next/`, `node_modules/`, `coverage/`, `.verification/`, `test-results/` — generated dependency/build/evidence contents excluded from authored-code analysis.

**Scope consequence**: this scan covers the whole repository at Minimal depth but does not establish deep coverage of every UI/test/reference file. The replacement timestamp must use `kind: partial`, with the exact deep paths above and no `./` entry. Do not convert the full-rescan choice into a false whole-root deep claim.

### Packages Found

One private npm application package, `waldorf-community-task-manager` v0.2.0, with no npm workspace packages. TypeScript Next.js App Router modular monolith; Hungarian UI and English technical identifiers. Production mode is an unlinked configuration boundary; functional local flows use invented in-memory data.

| Module | Responsibility / public surface | Main dependencies |
|---|---|---|
| Access | `AccessService.authorize`, role grant/revoke, authorization-version invalidation; Supabase RPC port | Injected users/grants/audit/clock |
| Directory | Family/parent/child/group relationships, archive/restore, field projection | Access authorizer/grants; directory repository/audit |
| Coordination | Signup, capacity/version checks, swap/cancellation requests and decisions | Directory visibility, task/assignment repository, events/audit |
| Notifications | 7-day/24-hour queue creation; due-job dispatch and cancellation | Injected store, queue, dispatcher/provider ports |
| Parent Experience | Family assignments, requests, contribution eligibility, own notification reads | Directory, repository, optional commands |
| Staff Schedule | Read-only bounded schedule projection | Access authorizer and schedule repository |
| Admin Experience | Queue, school year and generic operations; legacy-sheet archive destinations | Access and import mapping |
| Import Migration | 17-sheet registry, consent/cell checks, immutable preview binding, conflicts, commit/rollback | Import repository transaction port |
| Privacy Audit | Departure grace period, sibling/hold eligibility, delete/anonymize and one-year audit retention | Lifecycle repository and clock |
| Application | Typed result/DTO contracts; session/parent/staff/admin facades; authorization, projection, idempotency, event/evidence ports | Domain/access types; injected adapters |
| Parent Web | Synthetic duties, requests, notifications, contribution and invitation gateway | Application facades; module-local state/cache |
| Staff Web | Synthetic schedule and explicit failure scenarios | Staff facade/authorization; fixed fixtures |
| Admin Core | Synthetic records/tasks/approvals, scope and version checks | Admin facade; process-global store/idempotency |
| Admin Advanced | Import recovery, reminders, governance/revocation, lifecycle/settings | Composite admin port; process-global store |
| Runtime | Mode/config composition, five profiles, signed session, profile selector and shell | Zod, crypto, application authorization |
| App Routes | Public login/invitation and protected parent/staff/admin pages/actions | Async Next cookies/params; role boundary and facade helpers |
| Local Verification | Toolchain/environment checks, smoke, manifests, scans, evidence aggregation | Node APIs, Next environment loader, Playwright |
| Supabase Schema | Six proposed application tables and three authorization RPCs | Supabase/PostgreSQL `auth.uid()` and RLS; unexercised |

### Build System

- **Type**: npm with lockfile, Node 24.x/npm 11.x required; `next dev`, `next build`, `next start`; strict TypeScript `tsc --noEmit`.
- **Config Files**: `package.json`, `package-lock.json`, `.npmrc` (`engine-strict`), `.nvmrc`, `tsconfig.json`, `next.config.ts`, both Playwright configs, Vitest/ESLint/Prettier configs.
- **Build Dependencies**: App routes -> runtime/role boundaries -> application facades -> synthetic adapters. Legacy domain services expose ports but the synthetic web stores also implement application contracts directly. No external backend SDK appears in application dependencies; Supabase adapter accepts an injected RPC client.
- `predev` validates toolchain and loads environment files in development mode; `prebuild`/`prestart` use production defaults. Framework `NODE_ENV` and application `APP_RUNTIME_MODE` are separate axes. Local production builds can remain synthetic.
- `next.config.ts` supports an optional restricted `.next/login-performance-*` output directory for isolated development performance runs; normal development uses `.next`.

### APIs Discovered

**HTTP routes**: three handlers; no public business REST/GraphQL service layer.

| Method/path | Input and response | Boundary |
|---|---|---|
| GET `/api/readiness` | 200 `{status,mode,marker}` or 503 `{status,code}` | Runtime config only; no target health call |
| POST `/api/synthetic/session` | Form `profileId`: one of five IDs or empty sign-out; 303 to `/`; cookie set/delete; 400 malformed body/invalid ID | Synthetic only (404 otherwise), same-origin (403); signed HttpOnly/Lax session; login sets cache-clearing header |
| POST `/api/synthetic/reset` | 200 `{state,code,fixtureVersion}` resets synthetic parent/admin/advanced stores | Synthetic only and same-origin |

**Server Actions**: two parent authentication/invitation acceptance boundaries plus resend; five parent mutations; eight core admin actions; eight advanced admin actions. Actions accept `FormData` and return typed presentation states, validating identifiers/text/version/idempotency and deriving role/scope from the session. Relevant owning files are `app/belepes/actions.ts`, `app/meghivas/[token]/actions.ts`, `app/szulo/actions.ts`, `app/admin/actions.ts`, `app/admin/advanced-actions.ts`.

**Pages**: `/` profile selector/shell, `/belepes`, `/meghivas/[token]`, denied state; parent duties/detail/swap/cancellation/notifications; staff schedule/list/detail; admin dashboard, records/new/detail, tasks/new/detail, approvals/detail, archive/detail, import, reminders, privacy and settings. Protected layouts and pages resolve role sessions independently; successful mutations often call `revalidatePath`.

**Internal contracts**: discriminated `ApplicationResult<T>` includes success, empty, validation, denied, conflict, invalidated, retryable/terminal dependency failure and recovery. `FacadePipeline` authorizes before adapter execution and optional idempotency handling. Scope and sensitive-field projections are explicit. Admin port declares 25 operations; parent port eight operations; staff schedule port one; session gateway six operations.

**External integration proposals**: `SupabaseRouteAdapter` calls `authorization_version_for` and `has_active_scope`; SQL also defines `has_admin_scope`. Notification provider/dispatcher, persistence and deployment ports exist, but no real target was contacted or proven in this scan.

### Frameworks & Libraries

Lockfile resolutions (declarations often use `latest`; reproducibility depends on the lockfile): Next.js/@next/env **16.3.6**, React/React DOM **19.2.8**, Zod **4.4.3**, TypeScript **5.9.3**, ESLint **9.39.5**, eslint-config-next **16.3.0**, Vitest **4.1.11**, Playwright **1.62.1**, axe Playwright **4.13.0**, Prettier **3.9.6**, jsdom **30.0.1**. No version currency or vulnerability claim is made. The Next ESLint plugin has a scoped `fast-glob` -> `tinyglobby@0.2.17` override with compatibility regression coverage.

### Test Coverage

- **Test Directories**: colocated `src/**/*.test.ts`; `tests/unit/`, `tests/integration/`, `tests/coverage/`, `tests/browser/`.
- **Test Frameworks**: Node native test runner for domain tests; Vitest/jsdom/Testing Library for delivery/components; Playwright Chromium/Firefox/mobile Chrome; axe accessibility checks.
- **Coverage Config**: Node runner enforces 80% lines/branches/functions for domain tests; Vitest Istanbul includes all production `app`, `src`, scripts, proxy and Next config at the same floors. A production inventory reporter and Node-test adapter support aggregate coverage.
- Standard browser config runs three independent prebuilt synthetic servers, one worker, CI retries. It **excludes** the login performance suite. `test:login-performance` runs ten Chromium cases (five profiles x development/production), measuring first login and switching per case with zero retries and a 5000 ms assertion.
- Performance measurement starts on browser form submit and ends after correct greeting plus usable navigation links. Readiness and initial `/` are loaded before timing. Development has unique empty output per test; production uses a prebuilt bundle and fresh server. It does not navigate each profile's business landing page within the timed boundary.
- Deeply read regressions establish the intended test surfaces: `runtime-boundaries.test.ts` checks the inclusive duration assertion, isolated output settings, runtime mode/session expiry/tampering and origin guard; `synthetic-route.test.ts` invokes route handlers directly for all five profiles, cookie rotation, redirect/sign-out and denial; `runtime-shell.test.tsx` renders selector/shell components without a running server. Browser foundation checks parent selection and parent-to-staff switching. Parent/staff/admin browser suites reset fixtures before selecting roles; their <2000 ms assertions start at subsequent business-page navigation **after login**. These checks protect behavior but do not identify the observed login delay or measure it on the user's current server.
- No tests were run here; historical counts/percentages are not current evidence.

### Code Quality Indicators

- **Linting**: Next core-web-vitals/TypeScript ESLint flat config; blocking zero-warning script. The command targets app, application/runtime, tests, scripts, configs and proxy; older domain/synthetic modules outside application/runtime are not included in that lint command. Prettier has similarly selective production paths.
- **CI/CD**: `.github/workflows/ci.yml` runs pinned checkout/setup-node actions, locked install/browser install and `verify:local` on main push/PR. Main pushes additionally rebuild, generate SBOM and attest build provenance. No executable deployment workflow or linked deployment target was found.
- **Documentation**: README documents supported toolchain, environment precedence, loopback startup, watcher polling workaround, verification and outstanding targets; Hungarian user guide/source PRD/workbook also exist. Port interfaces and result states are explicit; older service files contain dense one-line implementations.
- Local verification runs toolchain/manifests/format/lint/typecheck/test/coverage/security/build/smoke/standard browser/evidence. It **does not run `test:login-performance`**. Security scans are repository regex checks plus npm high/critical audit, not proof of runtime security.

### Technical Debt Signals

1. **Actual-environment evidence gap**: prior intent explicitly reports the delay was not reproduced and delivered regression coverage without a login-path correction. Isolated test success does not resolve the user's three-minute report.
2. **Shared cache clearing**: `app/api/synthetic/session/route.ts:51` sends `Clear-Site-Data: "cache"` for successful profile selection. Its effect on asset fetching/browser behavior in the affected environment is a hypothesis, not a measured cause. Preserve session isolation when evaluating it.
3. **Development compilation/import exposure**: session handler and home await runtime composition; synthetic composition imports the application barrel. Dev compilation, existing output contention, watcher/resource conditions or browser redirects/assets may explain environment-dependent waiting. No latency attribution was measured. README already documents EMFILE/polling and prior intent documents cache contention during diagnostic setup.
4. **Toolchain discrepancy observed now**: current shell `node --version` returned `v26.10.0`, npm `11.19.1`; app prehooks require Node 24. Select the documented Node 24 toolchain for later reproduction and record the actual running server's version. This mismatch is not established as the delay's cause.
5. **Synthetic persistence boundaries**: parent state/cache is module-local; core/advanced admin state is process-global; modes recreate authorization ports. None are durable across restart/instances. Production config validates but exposes `supabase-unlinked` and no target calls (`src/runtime/production/composition.ts:8`).
6. **Authorization/state divergence**: synthetic home reads static profile navigation directly, while business admin boundaries also check dynamic revocation. Legacy services and direct synthetic ports represent separate implementations; avoid treating one test surface as proof of the other.
7. **CI timing gap**: the five-second regression is an opt-in script excluded from both standard browser flow and canonical `verify:local`; future quality work must explicitly invoke it if it is part of acceptance.
8. **Existing evidence is historical**: committed local acceptance report is bound to SHA `71a3b5f8d74be036b10571690e439d865fb5d664`, not observed HEAD. Safari/mobile Safari, Supabase auth/RLS/persistence, provider/scheduler and Vercel rows remain OUTSTANDING.
9. **Small debt outside this fix**: dense domain service formatting, some incomplete rollback simulations (import repository snapshots only staged/published arrays), and unlinked SQL security-definer/RLS contracts merit later real-target validation. None is established to delay login.

### Shared Login Findings and Measurement Boundary

Source-supported chain for **all five** profiles: `ProfileSelector` native POST form (`src/runtime/ProfileSelector.tsx:18`) -> synthetic route validates runtime/origin/body/profile (`app/api/synthetic/session/route.ts:16`) -> local HMAC session creation -> 303 to `/` (`:45`) -> async cookies/session resolution (`app/page.tsx:25`) -> `AppShell` and role navigation (`:31`). The route redirects to `/`, not `profile.homePath`; role-specific business pages are subsequent navigation. Sign-out uses the same endpoint with an empty ID and deletes the cookie (`route.ts:33`).

Parent, staff and all three administrator variants share that chain. Protected role pages additionally convert the cookie into application role/scopes through `app/*/_lib/session.ts`; admin boundaries check synthetic revocation. No fetch, remote auth, provider call, retry loop or deliberate multi-minute timer occurs in the inspected shared application login chain. Framework/browser/compiler behavior remains outside that statement.

The existing `.env.local` contains only the four synthetic local runtime setting names from the example, with mode `synthetic`; values other than that mode were not recorded. This identifies file configuration, not the effective environment of any already-running server. No live server was probed. Existing generated `next-env.d.ts` changes were preserved.

Prior `261002-slow-profile-login` code summary states no production login code correction was justified; build/test measurement document reports sub-second synthetic first/switch samples from fresh supported processes. Those documents are historical evidence for those isolated runs only. Current intent requires reproduction in the user's actual local environment, identification of the time-consuming segment, correction of its cause, and verified <=5000 ms completion for every profile. That work has not happened in Reverse Engineering.

## Handoff Summary

- **Intent-relevant finding**: shared local profile login is a native form POST, local session/cookie issuance and 303 round trip to the root shell. Evidence: `src/runtime/ProfileSelector.tsx:18`, `app/api/synthetic/session/route.ts:16`, `:45`, `:51`, `app/page.tsx:25`. There is no inspected application-level external-auth dependency or intentional three-minute wait. Cache clearing and development startup/compilation/environment conditions require measured attribution.
- **Risks / follow-up**: reproduce on the existing user environment without substituting a fresh isolated server as proof; capture browser/network and server compilation/request timing; distinguish submission-to-shell from navigation-to-business-page; record effective toolchain/cache/server state. Current shell is Node 26 whereas supported startup requires Node 24. Preserve auth/origin checks, signed HttpOnly cookie, cache/session isolation and dynamic revocation. Keep all five profiles (including three admin variants) in acceptance. No reproduction, fix, current passing test result or speed improvement is claimed.
- **Synthesis coverage**: wholesale replacement is authorized by Full rescan, but this honest Minimal scan has partial verified deep scope. Use explicit deep paths above, retain shallow inventory, and compare coverage before publication. Candidate publication must use the supplied snapshot generation/fingerprint; no shared CodeKB artifacts were written by this link.
