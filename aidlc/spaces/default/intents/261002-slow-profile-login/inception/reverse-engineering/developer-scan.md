## Developer Code Scan Results

Focused static scan for `261002-slow-profile-login`, Minimal depth, performed 2026-10-02. Requested outcome: “Login to a profile shouldn't take longer than 5 seconds.” No application changes, tests, benchmarks, backend calls, or live browser measurements were performed. Findings below distinguish source evidence from hypotheses.

### Scan Coverage

The initial snapshot excluded `app/`; its preliminary findings were discarded and source reads repeated after the conductor captured the expanded snapshot. Final snapshot bounds: `app,proxy.ts,src,scripts,tests,package.json,package-lock.json,next.config.ts`. Source fingerprint: `tree:06b37f8e2f42c8f1b06d49afec5055c6ba36a4f109637193699e2387981bfccf`. Store generation: `sha256:967310007ca84822a5f9c2dfddee0ccdfde459ce474f10457023412100a8d744`.

**Analyzed deeply** (exact repo-relative files; this is partial coverage):

- `package.json`
- `next.config.ts`
- `proxy.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/api/synthetic/session/route.ts`
- `app/api/synthetic/reset/route.ts`
- `app/belepes/page.tsx`
- `app/belepes/actions.ts`
- `app/belepes/AuthenticationEntry.tsx`
- `app/szulo/layout.tsx`
- `app/szulo/feladatok/page.tsx`
- `app/szulo/_lib/session.ts`
- `app/szulo/_lib/facade.ts`
- `app/munkatars/layout.tsx`
- `app/munkatars/beosztas/page.tsx`
- `app/munkatars/_lib/session.ts`
- `app/munkatars/_lib/facade.ts`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/_lib/session.ts`
- `app/admin/_lib/facade.ts`
- `src/runtime/ProfileSelector.tsx`
- `src/runtime/AppShell.tsx`
- `src/runtime/composition.ts`
- `src/runtime/config.ts`
- `src/runtime/types.ts`
- `src/runtime/security/origin.ts`
- `src/runtime/session/session.ts`
- `src/runtime/synthetic/composition.ts`
- `src/runtime/synthetic/profiles.ts`
- `src/runtime/production/composition.ts`
- `src/application/index.ts`
- `src/application/session-facade.ts`
- `src/application/authorization.ts`
- `src/parent-web/index.ts`
- `src/parent-web/synthetic-parent.ts`
- `src/staff-web/index.ts`
- `src/staff-web/synthetic-staff.ts`
- `src/admin-core/synthetic-admin.ts`
- `src/admin-advanced/index.ts`
- `scripts/validate-runtime-config.ts`
- `scripts/validate-toolchain.mjs`
- `scripts/start-smoke.mjs`
- `tests/unit/runtime-boundaries.test.ts`
- `tests/integration/synthetic-route.test.ts`
- `tests/integration/runtime-shell.test.tsx`
- `tests/browser/runtime-foundation.spec.ts`
- `tests/browser/parent-web.spec.ts`
- `tests/browser/staff-web.spec.ts`
- `tests/browser/admin-core.spec.ts`

**Skimmed only**:

- `package-lock.json`: parsed lockfile format and selected dependency version entries; no transitive dependency audit.
- `src/admin-advanced/synthetic-advanced.ts`: imports, state fields, revocation lookup, container/facade construction at lines 420–490; remaining advanced workflows not deeply read.
- `app/`: remaining routes/components enumerated or searched only.
- `src/`: remaining domain modules and tests enumerated or searched only.
- `scripts/verification/`: paths and timing/search matches only.
- `tests/`: remaining integration/unit/browser files enumerated or searched only.

Framework knowledge and memory rules were loaded separately as instructions; they do not expand verified application coverage. CI workflows, root test configuration, secrets/environment files, linked services, existing CodeKB prose, and local Next documentation were not analyzed by this developer link. The architect owns reading prior CodeKB before merging; Next documentation is required before subsequent code edits.

### Packages Found

One private ESM npm application, `waldorf-community-task-manager` version `0.2.0`, using TypeScript and Next App Router. Focused boundaries: runtime configuration/composition, synthetic session/profile selector, parent authentication entry, application authorization/session facade, parent/staff/admin synthetic adapters, and role landing pages. Other visible domain modules include access, directory, coordination, notifications, import migration, privacy audit and experience services; their internals are outside this scan.

### Build System

- npm; required toolchain Node 24.x and npm 11.x. `scripts/validate-toolchain.mjs` enforces major versions; it was read, not executed.
- `package.json` runs runtime configuration validation before development, build and production start. `dev` starts `next dev`; `build` runs `next build`; `start` runs `next start` on loopback by default.
- `next.config.ts` configures security headers and React strict mode. No explicit login prewarming or compiler optimization is configured there.
- Runtime composition dynamically imports the selected synthetic or production factory (`src/runtime/composition.ts:16–22`). Synthetic composition imports runtime values through the broad `src/application/index.ts` barrel, which reexports multiple facade/helper modules. Its influence on compiled module graphs and first-use latency is unmeasured.

### APIs Discovered

| Surface | Contract and dependencies |
| --- | --- |
| `POST /api/synthetic/session` | Native selector form sends `profileId`. Synthetic runtime and origin/host match required. Valid selection sets a rotated HTTP-only, SameSite=Lax cookie, requests browser cache clearing, and returns 303 to `/`. Empty ID deletes the cookie and returns 303 to `/`. Invalid body/profile returns 400, denied origin 403, unavailable synthetic mode/configuration 404. |
| `POST /api/synthetic/reset` | Synthetic-only same-origin fixture reset; resets admin core, advanced admin and parent state; returns success code and fixture version. Not invoked by normal selector form; used by tests. |
| Parent authentication server action | `authenticateParentAction` accepts identifier and safe parent destination. In synthetic mode, only `parent-local` succeeds; sets the same session cookie and returns a success state with destination. The client renders a continuation link; there is no automatic redirect in this component. |
| `SessionApplicationFacade` | Async gateway interface for resolving/selecting/switching synthetic sessions and invitation flows. Parent implementation resolves against local fixtures, not remote auth. |

No network API, database read, provider timeout, retry loop or seed import occurs in the scanned selector POST/root request path. Session signing and verification use local HMAC, random nonce, JSON and Zod; profile lookup checks five fixed entries. Production composition explicitly exposes `supabase-unlinked` and makes no target call. Manifest has neither an InsForge nor Supabase SDK dependency. The scan provides no basis to blame InsForge, external auth, database indexes, or a remote session bootstrap for this profile login delay.

### Login and Landing Dependencies

1. Root GET: proxy supplies a CSP nonce; dynamic `HomePage` composes runtime and resolves cookie. Signed out renders `ProfileSelector`; signed in renders `AppShell` and a focused greeting.
2. Profile click: `src/runtime/ProfileSelector.tsx:19–24` submits a native HTML form to the session API. API composes runtime, validates origin/body/profile, signs cookie, responds with 303. Browser requests `/` again. Root displays greeting and role navigation. `homePath` is present in profile definitions but the selector POST always targets `/`; it does not bootstrap the role dashboard.
3. Role navigation is a subsequent native anchor navigation. Layout and page separately resolve sessions; facade resolution composes runtime again. Admin dashboard then uses `Promise.all` for dashboard, records, tasks and approvals. Parent duties and staff schedule call local adapters. These costs are relevant if “login” includes reaching the role work page, but are not directly on the selector-to-greeting path.
4. Parent `/belepes` is a distinct entry: runtime/session lookup, server action, success message and explicit continuation link to a safe `/szulo` destination. Requirements should identify whether its action response and later manual navigation are included in the five-second target.

### Frameworks & Libraries

Selected resolved lockfile entries: Next and @next/env pinned in manifest at 16.3.6; React/React DOM 19.2.8; Zod 4.4.3; TypeScript 5.9.3; Vitest 4.1.11; Playwright test 1.62.1; ESLint 9.39.5; Prettier 3.9.6. These are local recorded versions, not claims about current public releases. Manifest uses `latest` for several packages while the lockfile records concrete versions.

### Persistence, Caching and Timeouts

- Each `composeRuntime` call validates environment and creates a new small authorization version map for five profiles. There is no composition result memoization; dynamic imports may benefit from module caching, which was not measured.
- Parent fixtures initialize small in-process Maps at module load; the parent facade is cached in `app/szulo/_lib/facade.ts` after runtime composition. Admin core uses lazy `globalThis` storage for fixtures/idempotency; the skimmed advanced admin container also uses lazy global storage. Staff adapter has a fixed three-entry schedule.
- Session cookie lasts eight hours; this is expiry, not a login wait. Proxy adds request nonce/CSP and excludes API/static assets/prefetch requests by matcher. Root and role layouts explicitly use `force-dynamic`; session-specific output must stay isolated across profiles.
- `app/api/synthetic/session/route.ts:51` sets `Clear-Site-Data: "cache"` for each successful profile selection. This is a broad browser cache-clear request. Whether a given browser honors it and how much time it adds were not observed.
- Start smoke has a 30-second readiness budget and 250ms polling (`scripts/start-smoke.mjs`); it fetches readiness/root and never selects a profile. Startup checks are subprocess preflight, not per-login calls.
- No intentional delay, retry backoff or five-second budget is implemented on the scanned login path.

### Test Coverage

- Node built-in runner for colocated domain `*.test.ts`; Vitest for delivery unit/integration tests; Playwright and axe for browser/a11y flows, as declared in `package.json`.
- Domain coverage scripts require 80% lines/branches/functions. Delivery coverage points to root `vitest.config.ts`, whose contents were outside snapshot and not read; current achieved coverage and pass counts are unknown.
- `tests/integration/synthetic-route.test.ts` checks parent cookie/303, origin rejection, unknown profile and synthetic controls disabled in production. It has no latency or cache-header assertion, and does not prove all five selector profiles or empty-ID clearing.
- `tests/unit/runtime-boundaries.test.ts` covers configuration, mode composition, five profiles, token rotation/tamper/expiry and origin checks. `tests/integration/runtime-shell.test.tsx` covers selector controls and role navigation.
- `tests/browser/runtime-foundation.spec.ts:11–31` covers parent selection and parent-to-staff switching, greeting/focus and absence of prior navigation. It contains no explicit elapsed-time assertion. Fixture reset in setup invokes composition before the measured user journey would begin, so this setup would not establish first-use session-route timing.
- Role browser suites contain explicit sub-two-second checks for parent duties, staff schedule and admin dashboard **after profile selection**. They therefore do not cover the requested click-to-login five-second threshold. Parent browser authentication case visits `/belepes` already signed in and checks upcoming duty/destination rather than submitting a signed-out login form.
- All test statements are static coverage observations; no tests ran in this stage.

### Code Quality Indicators

Observed conventions: strict TypeScript intention, typed result states, explicit application ports, stable test IDs, Hungarian UI copy, origin guards and role projections. ESLint/Prettier and typechecking are exposed through npm scripts; security scripts include privacy/secret/SAST scans and high-severity npm audit. Actual lint configuration and CI execution were not read or verified in this focused snapshot. In-code production composition comments accurately describe an unlinked placeholder. Naming and failure states are generally clear; scan scope is insufficient for repository-wide quality ratings.

### Technical Debt Signals and Latency Hypotheses

| Finding | Evidence | Status and follow-up |
| --- | --- | --- |
| Broad browser cache clearing during login | Session route line 51; native form then root 303 | Strong code-level candidate, unmeasured causal effect. Observe actual response/header handling and asset requests; compare with targeted cache behavior while preserving profile isolation. |
| First-use route/module work in development | `package.json` dev command; session API is separate from root; runtime dynamic import and application barrel | Plausible compilation/module-loading hypothesis, not established root cause. Compare first click and repeat click under dev and built start; capture server timings. |
| Repeated runtime composition | Root, API, role session resolvers/facades independently call composition | Verified duplication with small local work; no evidence it takes seconds. Any caching change must preserve runtime/config and authorization semantics. |
| Full navigation and no pending selector state | Selector native form; AppShell native anchors; `/belepes` alone has pending state | Verified UX/transport shape. Perceived delay and reload cost unmeasured. Pending feedback cannot substitute for satisfying five seconds. |
| Performance regression gap | Root browser login tests lack elapsed assertion; role timings start after selection | Verified coverage gap. Add later regression for click to profile-ready content for all five profiles and switching, with explicit first-use conditions. |

### Impact Analysis for Subsequent Implementation

Primary change surface is session transport/header behavior, `ProfileSelector`, runtime composition and focused browser/integration tests. Root greeting and role navigation determine readiness. A change to shared session/composition code also affects readiness, reset, parent login/invitation actions and parent/staff/admin resolvers; preserve mode isolation, origin validation, token rotation, expiry, authorization version checks and absence of the previous profile's protected projection. Avoid global caching of session-specific output. Dashboard/bootstrap optimization should be justified by measurements if the accepted login endpoint remains the root greeting.

## Handoff Summary

- **Intent-relevant finding**: Native profile selection requests origin-wide browser cache clearing on every success (`app/api/synthetic/session/route.ts:51`) before a 303 root navigation. Runtime is local synthetic auth and root greeting; no external auth/database bootstrap was found on this path. Cache clearing, first-use development compilation/module loading, and full reload cost are candidates rather than measured causes.
- **Risks / follow-up**: No elapsed baseline exists; five seconds cannot yet be claimed. Clarify the readiness endpoint and dev versus built-start/first-use expectations. Preserve profile/session privacy and synthetic/production separation; broad cache clearing may have been intended for isolation, which must remain covered if adjusted. Existing browser role timings exclude profile login. Root framework configs and CI require separate coverage if needed, and code editing requires reading local Next 16.3.6 documentation first.
- **Next step**: Conductor records developer link, obtains the configured summary confirmation, and dispatches architect synthesis to merge prior CodeKB prose with this partial scan. Requirements/construction should establish a reproducible click-to-ready timing baseline and targeted regression before deciding the smallest fix. No CodeKB publication or receipt was attempted by this link.
