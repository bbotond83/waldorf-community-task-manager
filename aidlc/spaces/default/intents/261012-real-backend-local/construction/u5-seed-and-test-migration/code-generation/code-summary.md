# Code Summary: U5 Seed and test migration (working notes)

Working notes written during Code Generation. Part C (Steps 10 to 14) is recorded below; the final summary (files, decisions, tests written but not executed, deviations) is written in Step 28.

## Step 10: Inventory of synthetic code and the disposition ledger

### A. What imports what (production code, before the change)

Decision words: DELETE (removed with no replacement), REWRITE (kept, synthetic branch removed), MOVE (kept, the file changes place because production code needs it), KEEP.

| Place | Uses | Decision |
|---|---|---|
| `src/runtime/config.ts` | `APP_RUNTIME_MODE`, `APP_SYNTHETIC_FIXTURE_VERSION`, synthetic schema, `mode` union | REWRITE: one production schema, no mode |
| `src/runtime/types.ts` | `mode: "synthetic"` composition, `SyntheticProfile` | REWRITE: one composition |
| `src/runtime/composition.ts` | dynamic import of `synthetic/composition.ts` | REWRITE |
| `src/runtime/synthetic/{access-state,composition,profiles}.ts` | the synthetic actors, composition and profiles | DELETE (the navigation constants in `profiles.ts` are used by `production/access.ts`: MOVE to `src/runtime/navigation.ts`) |
| `src/runtime/session/session.ts` | synthetic session token, in-code secret `SYNTHETIC_SESSION_SECRET`, `SESSION_COOKIE_NAME` | DELETE (nothing real uses it; the real session is `src/identity` and `app/_identity`) |
| `src/runtime/ProfileSelector.tsx` | profile picker | DELETE |
| `src/runtime/shell-profile.ts` | `ShellProfile` type (used by the real access results and `AppShell`) | KEEP (comment only) |
| `src/runtime/AppShell.tsx` | test-profile switcher form posting to `/api/synthetic/session` | REWRITE: `headerAction` is required, no switcher |
| `src/runtime/production/access.ts` | navigation constants from `synthetic/profiles.ts` | REWRITE: import from `navigation.ts` |
| `src/runtime/production/services.ts` | `RoutedAdminPort` (unused since U4, tested only with the interim port) | DELETE (unused) |
| `src/application/contracts.ts` | `RuntimeMode`, `SessionContext.runtimeMode`, `SessionContext.isSynthetic`, `TrackingEntry` from teacher-tracking | REWRITE: fields and type removed; tracking types import from the moved model |
| `src/application/authorization.ts` | `isValidSessionMode` (runtimeMode/isSynthetic check) | REWRITE: check removed |
| `src/application/session-facade.ts` | `selectSynthetic`, `switchSynthetic`, gateway methods, `runtimeMode` constructor argument | REWRITE |
| `src/application/teacher-facade.ts`, `src/data/schedule.ts`, `src/data/teacher-port.ts` | `teacher-tracking/tracking-model.ts` | MOVE the model to `src/application/tracking-model.ts` (production code uses it) |
| `src/data/session.ts` | `runtimeMode: "production"`, `isSynthetic: false` in `toSessionContext` | REWRITE: fields removed |
| `src/parent-web/notification-context.ts` | used by parent pages (production behaviour, not synthetic) | MOVE to `src/application/notification-context.ts` (with its test) |
| `src/parent-web/synthetic-parent.ts` (+ `index.ts`) | `createSyntheticParentFacade`, `createSyntheticParentSessionFacade`, `inspectSyntheticInvitation`, `PARENT_FAMILY_SCOPE`, reset | DELETE |
| `src/admin-core/synthetic-admin.ts` | `getSyntheticAdminPort`, reset | DELETE |
| `src/admin-advanced/*` | `createSyntheticAdvancedAdminFacade`, `isSyntheticAdvancedSubjectRevoked`, interim port, reset | DELETE |
| `src/teacher-web/*` | `createSyntheticTeacherFacade`, `TEACHER_GROUPS`, `TEACHER_FIXTURE_SCENARIOS`, repository | DELETE |
| `src/teacher-tracking/schedule-service.ts` | only `teacher-web` | DELETE |
| `src/teacher-tracking/tracking-model.ts` | see above | MOVE |
| `app/page.tsx` | `ProfileSelector`, `resolveSyntheticSession`, synthetic redirect | REWRITE: production home only |
| `app/belepes/{page,actions,AuthenticationEntry}` | synthetic parent sign-in by test identifier (`parent-local`) | DELETE the route (real sign-in is `/bejelentkezes`); links to `/belepes` point to `/bejelentkezes` |
| `app/meghivas/[token]/{page,actions}` | `inspectSyntheticInvitation`, synthetic accept and resend actions | REWRITE: real invitation only; a token that is not a real invitation shows the real "not valid" page |
| `app/szulo/_lib/{session,facade}.ts` | synthetic session, `createSyntheticParentFacade`, reset cache, `PARENT_FAMILY_SCOPE` | REWRITE |
| `app/szulo/**` pages | `parent-web/notification-context`, `isProductionMode()`, `scenario` search parameter | REWRITE |
| `app/admin/_lib/{session,facade}.ts` | synthetic session, `SYNTHETIC_ORGANIZATION_ID`, synthetic facade | REWRITE |
| `app/admin/**` pages, forms, actions | `isProductionMode()`, `mode="synthetic"`, `fixtureId` select, `scenario` fields | REWRITE |
| `app/teacher/_lib/{session,facade,filters}.ts` | synthetic session, `createSyntheticTeacherFacade`, `TEACHER_GROUPS`, `scenario`/`fixture` | REWRITE |
| `app/teacher/**` | `teacher-tracking/tracking-model` | REWRITE import (moved) |
| `app/_identity/{production-request,shell-action}.ts` | `not-production` state, `isProductionMode()` | REWRITE |
| `app/api/synthetic/session`, `app/api/synthetic/reset` | synthetic routes | DELETE |
| `app/api/readiness/route.ts` | `mode` field | REWRITE: no `mode` field |
| `app/globals.css` | `.synthetic-label` class (also used by two real pages for provider status) | KEEP the class (it styles the simulated-delivery label; the name is renamed only if a test needs it: out of scope) |
| `proxy.ts` | comment mentions the old picker | REWRITE comment |
| `scripts/validate-runtime-config.ts`, `scripts/start-smoke.mjs`, `.env.example` | mode and fixture settings | REWRITE |
| `playwright.config.ts`, `scripts/verification/*`, `.github/workflows/ci.yml` | synthetic settings, `SYNTHETIC_PROFILES` in `core.ts` | Parts D and E (not in this dispatch) |

Every use of the names the plan lists (`runtimeMode`, `isSynthetic`, `selectSynthetic`, `switchSynthetic`, `APP_RUNTIME_MODE`, `scenario`, `SYNTHETIC_TEST_COPIES`) in production source is in the rows above. The tests that use them are on the Part D worklist at the end of this file.

### B. Disposition ledger (NFR2.29): each rule of a deleted module, and where the database proves it

"Proof" names a test that runs against the real local stack (`tests/database/`). "Dropped" gives the reason.

#### `src/parent-web/synthetic-parent.ts` (301 test lines)
| Rule of the deleted module | Where it is proven now |
|---|---|
| Lists only the linked family's duties (invented fixture) | `tests/database/kernel-signup.test.ts` "lists the tasks of the family's groups and its own places ... nothing of other groups"; `tests/database/data-adapters.test.ts` "lists the family's tasks with their states, and no other family's" |
| Swap requests empty state for a family with none | `tests/database/kernel-swaps.test.ts` (swap lists) and `data-adapters.test.ts` swap run |
| Unrelated or unknown duty detail is generically denied | `kernel-signup.test.ts` "answers the detail of a task outside the family's groups like a missing task", "treats a missing, cancelled or foreign task as not found" |
| One assignment for a repeated idempotency key | `kernel-signup.test.ts` "returns the stored success for a repeated key and does not store a refusal"; `data-adapters.test.ts` "signs the family up, repeats a key without a second place" |
| Full, ineligible and stale sign-up keep state unchanged | `kernel-signup.test.ts` "runs the checks in the fixed order and returns the first failure", "refuses an unknown or foreign task and a missing version without changing anything" |
| Swap success, conflict and retryable outcomes mapped exactly | `kernel-swaps.test.ts` (exchange, decline, SWAP_CANNOT_BE_APPLIED, forged requests); outcome classification `tests/database/data-adapters.test.ts` and `src/data/*.test.ts` |
| Cancellation validation and denial, no reason projection | `kernel-swaps.test.ts` "stores a cancellation request ... refuses duplicates, stale versions, foreign places and started tasks" |
| Mark notification read idempotently, unknown notification rejected | `tests/database/notifications-adapters.test.ts` "marks a notice read once and again, and another parent's notice, an unknown one ... read as denied"; `notifications-functions.test.ts` |
| Only the parent's own contribution note updates | `data-adapters.test.ts` "saves the family's contribution note, and not for a task it holds no place on"; `coordination-functions.test.ts` (contribution_save) |
| Invitation tokens classified valid, expired, used, invalid with no account data | `tests/database/identity-invitation.test.ts` and `identity-server.test.ts` (lookup of real invitations; the page copy is `src/identity/copy.ts`) |
| Per-browser copies of the demo data (`SYNTHETIC_TEST_COPIES`) | Dropped: it existed so three browsers could share one in-memory demo state; Part D gives each browser its own schema (Step 18) |
| `notification-context.ts` rules (link context, pending request notice) | Not synthetic: MOVED with its test to `src/application/notification-context.ts`, test kept as is |

#### `src/admin-core/synthetic-admin.ts` (202 test lines)
| Rule | Where proven |
|---|---|
| Only records of the granted group are returned | `tests/database/directory-schema.test.ts` (role matrix), `directory-functions.test.ts`, `identity-session.test.ts` (policy matrix) |
| Crafted identifier outside the scope is generically denied | `identity-session.test.ts` policy matrix; `scope_probe` tests in `identity-probe.test.ts` |
| Filter without matches returns empty | `directory-functions.test.ts`, `schedule.test.ts` "answers the empty state" |
| Stale version rejected without change | `directory-functions.test.ts` (versioned saves), `kernel-family.test.ts` "refuses a stale or repeated archive" |
| Retryable and terminal dependency failures explicit | `src/data/*.test.ts` classification and `data-adapters.test.ts` |
| Assign an eligible task once; ineligible and full capacity distinct conflicts | `kernel-signup.test.ts` "lets an admin of the group give a place to a family of the group, with the same checks and no override" and the fixed-order check test |
| Archived record unchanged on restore conflict | `kernel-family.test.ts` "restores the people but not the removed places, and refuses a stale, active or unreachable restore" |
| Approve and reject outcomes; already-decided, invalidated, denied without retry metadata | `kernel-swaps.test.ts` "lets an admin in reach approve ...", "rejects a request with approval.reject, ... tells a changed request from a decided one" |
| Revocation invalidates the next request | `identity-grants.test.ts`, `identity-session.test.ts`, `kernel-family.test.ts` governance revoke |
| Scope not granted denied before the adapter runs | `src/application/authorization.test.ts` and `facades.test.ts` (they stay; Part D moves them to test doubles) |
| Never projects contact or profile fields | `directory-schema.test.ts` (contact policy), `import-privacy.test.ts`, `schedule.test.ts` "returns no contact details, notes, profiles or people's ids" |

#### `src/admin-advanced/synthetic-advanced.ts` and `interim-port.ts` (291 + 33 test lines)
| Rule | Where proven |
|---|---|
| Group admin denied the import before any state is created | `notifications-adapters.test.ts` "keeps the import to super admins"; `import-functions.test.ts` role checks |
| Validate, resolve, commit and deduplicate one immutable import | `import-functions.test.ts`, `import-commit.test.ts`, `notifications-adapters.test.ts` "runs an import end to end through the adapter" |
| Changed fingerprint and stale preview rejected, no partial commit | `import-functions.test.ts`, `notifications-adapters.test.ts` "answers each commit and resolve refusal with its code" |
| Malformed, oversized, missing-sheet, missing-header workbooks | `src/import-parser/*.test.ts`; `notifications-adapters.test.ts` "refuses a file that is not a usable workbook" |
| Recover an interrupted import with the original run identity | `notifications-adapters.test.ts` "interrupts a commit whose connection fails ... resumes it"; `import-commit.test.ts` |
| Reminder retry only for classified failures, same correlation | `notifications-adapters.test.ts` "retries a retryable job with the codes REMINDER_NOT_RETRYABLE and REMINDER_STALE"; `notifications-functions.test.ts` |
| Governance: role, self-lockout, stale version, revocation | `kernel-family.test.ts` ("refuses a stale version, an admin's own grant and a grant outside the reach"); `identity-grants.test.ts` |
| Lifecycle: blocker and version recheck, one redacted atomic outcome | `lifecycle.test.ts` (ordered checks, atomic rollback, one audit event) |
| Settings allowlist and stale settings rejected | `directory-functions.test.ts` (settings_save), `directory-schema.test.ts` settings matrix |
| Retryable and terminal adapter failures without raw provider text | `src/data/*.test.ts` classification, `notifications-adapters.test.ts` |
| Interim port: empty states and denials for operations that U4 later answered | Dropped: no operation is left without a database answer (`RoutedAdminPort` is deleted with it); `tests/integration/notifications-wiring.test.ts` already asserts the interim port is not used |

#### `src/teacher-web/*` (107 + 91 test lines)
| Rule | Where proven |
|---|---|
| Repository keeps fixture identities, dates, scopes; bounded inclusive start dates; isolates organization and group | `tests/database/schedule.test.ts` (date filter on the UTC day of the task start, group grant, no other tables) |
| One bounded read per request; read capability only | `schedule.test.ts` "lets a teacher read the schedule function only, never the tables behind it" |
| Empty versus denied; retryable versus terminal classification | `schedule.test.ts` "answers the empty state ...", "grants the schedule to teachers ... and to nobody else"; `src/data/*.test.ts` classification |
| Mixed scope rejected without partial data; malformed source rejected | `schedule.test.ts`; `src/application/teacher-facade.test.ts` (stays) |
| Fixture scenarios (`TEACHER_FIXTURE_SCENARIOS`) | Dropped: demo-only switch for empty, denied and failure states; the facade and database tests cover those states directly |

#### `src/teacher-tracking/` (95 + 98 test lines)
| Rule | Where proven |
|---|---|
| `tracking-model.ts` (calendar dates, ranges, source records, projection allowlist) | NOT deleted: production code imports it. MOVED with its test to `src/application/tracking-model.ts` and `.test.ts` |
| `schedule-service.ts` (immutable allowlisted fields, deny before validating, mixed organization denied, fail closed, unavailable repository) | The service is used only by the synthetic teacher; the production path is `TeacherApplicationFacade` + `createTeacherPort` + `schedule_get`. Proven by `schedule.test.ts` and `src/application/teacher-facade.test.ts`; the service-level duplicate is dropped |

Ledger note: the tests of the deleted modules are not ported one to one; each row above names the existing proof, so Part D deletes those test files without adding a replacement unless a row says so. A row marked "stays" is an application-layer test that Part D moves onto the test doubles.

## Part C result (Steps 11 to 14)

What changed in production source (the details are in the dispatch report): one runtime configuration (`src/runtime/config.ts`: `APP_SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`; error code `CONFIG_PRODUCTION_INVALID` kept, no `mode`), one composition, `SessionContext` without `runtimeMode` and `isSynthetic`, `SessionApplicationFacade(gateway, authorization)` without the synthetic methods, no profile switcher in `AppShell`, `app/` on the production path only, the import header "Adminisztráció · Import", the routes `app/belepes`, `app/api/synthetic/*` deleted, `src/runtime/{synthetic,session,ProfileSelector}`, `RoutedAdminPort` and the five module folders deleted. Moved: `tracking-model` and `notification-context` (with their tests) into `src/application/`, the navigation constants to `src/runtime/navigation.ts`.

Also changed outside the plan's file list because the typecheck needed it: `scripts/verification/core.ts` no longer imports `SYNTHETIC_PROFILES`; it checks the fixture profiles against a local role-to-home map (Step 22 still owns the rest of the verification scripts).

Not run in this dispatch: `npm run build` (the production build type-checks the test files, which are on the worklist below, so it fails until Part D) and the start smoke (needs the build).

## Part D worklist

Every test file that no longer compiles or no longer passes after Steps 11 to 14, with what it needs. "Rewrite" means move onto the test doubles of `tests/support/` or onto the production path; "Delete" means delete after the ledger row (section B) has its proof. Counts come from `npm run typecheck` (44 files with type errors, 167 errors, all in test files), `node --test "src/**/*.test.ts"` (8 failing tests in 6 files), `vitest run` (49 failing tests and 59 failing suites in 39 files; the 25 failing tests of `runtime-config-cli` are one file), `node --test "scripts/**/*.test.ts"` (1 failing test) and the browser specs (not run; they all need the profile picker).

### D1. Application layer (`src/application`, `src/data`, `src/runtime`), node test runner: 9 files
| File | Failing | Needs |
|---|---|---|
| `src/application/admin-facade.test.ts` | type error only | drop `runtimeMode`/`isSynthetic` from the session fixture |
| `src/application/authorization.test.ts` | 1 test ("inactive revoked and invalid-mode sessions...") | drop the invalid-mode case; keep inactive and revoked; code is now `INVALID_SESSION` |
| `src/application/contracts.test.ts` | type error only | drop the two fields from the fixture |
| `src/application/facades.test.ts` | 2 tests + 8 type errors | delete "does not expose synthetic session selection in production" and "resolves synthetic sessions, invitation destinations, and navigation" or rewrite them for `new SessionApplicationFacade(gateway, authorization)` (resolve, invitation, navigation); drop the fields |
| `src/application/status-labels.test.ts` | suite does not load (imports `src/admin-core/synthetic-admin.ts`) | rewrite: take the admin item states from `src/data/admin-port.ts` outputs or a local literal list; keep every copy assertion |
| `src/application/swap-facade.test.ts` | type error only | drop the two fields |
| `src/application/teacher-facade.test.ts` | suite does not load (imports `src/teacher-web`) | rewrite on a local port double (the facade rules are application-layer and stay: deny before validate, mixed organization, fail closed); the fixture scenarios go |
| `src/data/session.test.ts` | 1 test + type errors | the production session no longer carries the two fields: assert the roles, scopes, grants and version only |
| `src/runtime/production/access.test.ts` | 2 tests | line 50: drop the `runtimeMode` expectation; line 145 ("the production path holds no fixed family..."): the source scan expects "a production path" in `app/szulo/_lib/session.ts`, `app/admin/_lib/session.ts`, `app/teacher/_lib/session.ts`, which are now production-only: assert no `parent-local`, `org-napsugar`, `SYNTHETIC`, `getSyntheticProfile` strings instead |

### D2. Unit tests (`tests/unit`, vitest): 7 files, all fail to load or compile
| File | Needs |
|---|---|
| `tests/unit/current-role-references.test.ts` | uses `SYNTHETIC_PROFILES`: rewrite against `src/runtime/navigation.ts` and the role policy, or delete if `navigation-access` covers it |
| `tests/unit/current-role-session.test.ts` | uses the synthetic access state and session token: delete the synthetic parts; keep the grant and scope rules with `toSessionContext` on a fixture `AccessContext` |
| `tests/unit/navigation-access.test.ts` | per-profile navigation: rewrite over `PARENT_NAVIGATION`, `TEACHER_NAVIGATION`, `GROUP_ADMIN_NAVIGATION`, `SUPER_ADMIN_NAVIGATION` and the `resolve*Access` profiles |
| `tests/unit/runtime-boundaries.test.ts` | `mode` no longer exists on config or composition; session token tests: delete; keep config validation (FR1.3) and navigation boundaries |
| `tests/unit/teacher-filters.test.ts` | uses `TEACHER_GROUPS`, `scenario`, session fields: rewrite for the production filter (label is always "Engedélyezett csoport"), delete the `fixture` scenario cases |
| `tests/unit/teacher-schedule.test.ts` | uses `src/teacher-web` and `runtimeMode`: rewrite on a local port double |
| `tests/unit/record-payload.test.ts` | compiles and passes (mentions the word only): check wording in Step 15 |

### D3. Coverage tests (`tests/coverage`, vitest): 13 files
Load failures (they mock `src/runtime/session/session.ts`, `synthetic/profiles`, `admin-core`, `admin-advanced`, `parent-web`): `admin-actions` (also `createImportPreviewAction` is gone), `admin-dashboard`, `admin-functional-fixes`, `admin-pages`, `app-entrypoints` (also `app/belepes/page`, `app/api/synthetic/*`), `app-session-boundaries`, `parent-actions` (also `resetParentFacadeCache`), `parent-functional-fixes` (same), `parent-pages`, `teacher-pages`: rewrite onto the production request path (mock `app/_identity/production-request.ts` or `resolve*Session` and the facades with `tests/support` doubles); delete the profile, reset and session-cookie cases.
Assertion failures: `production-inventory.test.ts` (1: the inventory count of application/script files changed from 233 to 221; recount, never loosen the guard), `runtime-cli-instrumentation.test.ts` (4: expects the line `RUNTIME_CONFIG_VALID: synthetic`, now `RUNTIME_CONFIG_VALID`; the schema-failure case uses the old variable set), `smoke-entrypoint.test.ts` (1: the smoke now waits for "Biztonságos bejelentkezés" and supplies the three settings).
`verification-entrypoints.test.ts` and `runtime-cli-instrumentation.test.ts` also mention `scenario`/`APP_RUNTIME_MODE`: check in Step 15.

### D4. Integration tests (`tests/integration`, vitest): 21 files
- Load or compile failures (13): `app-nav` and `copy` and `production-home` (import `synthetic/profiles`), `retained-workflows` (parent-web, admin-core, admin-advanced), `runtime-shell` (ProfileSelector), `synthetic-route` (the deleted routes: delete the file after Step 15 proves the old routes answer not found), `teacher-boundaries`, `teacher-components`, `teacher-routes` (teacher-web, `runtimeMode`, `scenario`), `identity-actions` (the synthetic `resendInvitationAction` is gone), `import-screens` (the `mode`, `createPreview` and scenario/fixture parts), `notifications-wiring` (`mode`), `production-wiring` (`RoutedAdminPort`, `mode`, `runtimeMode`).
- Assertion failures in files that load (9): `admin-extended-actions` ("assigns without a selector like the old form": payload is now `{}`), `admin-forms` ("keeps the one-field create pages in the synthetic mode": delete), `identity-screens` (the synthetic invitation page case: delete or assert the new not-valid page for a non-real token), `import-actions` ("no scenario value": the commit payload lost `scenario`), `parent-components` ("offers login from signed-out state": href is now `/bejelentkezes`), `swap-actions` ("keeps the fixed partner of the demo": delete; the action now needs a `counterpart` choice), `swap-screens` (2 demo-partner cases: delete; `searchParams` prop is gone), `import-screens` (3: demo select, demo sentence, cancel-in-synthetic cases: delete), `production-wiring` (5), `notifications-wiring` (1: "leaves the synthetic mode as it was": delete).
- `runtime-config-cli.test.ts` (25 of 27 fail): rewrite for the three-setting configuration (missing, short secret, bad address each name their variable), remove every `APP_RUNTIME_MODE` and `APP_SYNTHETIC_FIXTURE_VERSION` case.

### D5. Verification scripts (node test runner): 1 test
`scripts/verification/lint-scope.test.ts`: "keeps the legacy list honest" fails because `src/admin-advanced` (and the other four folders) no longer exist: remove the five folders from the legacy allow-list (plan Step 15). `scripts/verification/replaced-modules.test.ts` passes but still needs the five folders added (Step 15). `scripts/verification/ci-config.test.ts` still asserts the synthetic CI settings (Step 22).

### D6. Browser specs (`tests/browser`, Playwright): 16 spec or support files
Type errors (import `synthetic/profiles`): `navigation-polish.spec.ts`, `visual-overhaul.spec.ts`, `profile-login-existing.spec.ts`, `profile-login-performance.spec.ts`, `support/profile-login-measurement.ts`. The profile-login specs, their support files and `playwright.login-*.config.ts` are deleted in Step 18. All other specs (`admin-advanced`, `admin-core`, `functional-fixes`, `list-polish`, `parent-web`, `runtime-foundation`, `teacher-web`, and the picker-based parts of `directory-coordination`, `notifications-import`, `identity`) sign in through the picker and need real sign-in with the seeded accounts (Step 19). `playwright.config.ts` still sets `APP_RUNTIME_MODE` and friends (Step 18).

### Totals
Files on the worklist: 9 (D1) + 6 (D2, `record-payload` is check-only) + 13 (D3) + 21 (D4) + 1 (D5) + 16 (D6: 14 specs and 2 support files) = 66 test or support files (the 44 files with type errors are a subset).

## Part D result (Steps 15 to 17)

### Step 15: deletion proofs
- `tests/unit/removed-synthetic-mode.test.ts` (7 tests) scans the non-test production files (app, src, scripts, proxy, next.config, .env.example, package.json) for the removed names, routes, cookie and settings and fails if any is present. Its allow-list can only shrink; its remaining entries are listed for Step 22.
- `scripts/start-smoke.mjs` now requires POST `/api/synthetic/session`, POST `/api/synthetic/reset` and GET `/belepes` to answer 404 (`SMOKE_REMOVED_ROUTE_PRESENT` otherwise); `tests/coverage/smoke-entrypoint.test.*` covers that check.
- `scripts/verification/replaced-modules.test.ts` lists the five deleted folders; `lint-scope.test.ts` allow-list is now `src/access`, `src/admin-experience` only.
- `.synthetic-label` renamed to `.delivery-note` (app/globals.css, two pages); a test asserts the old class is gone.

### Step 16: files rewritten on test doubles
New support: `tests/support/port-doubles.ts`, `request-world.ts`, `role-profiles.ts`. Deviation: the doubles sit at the application-port level, not at rpc level through `data-fakes`, because page tests need whole-screen fixtures; the real adapters are proven by `src/data` tests and `tests/database`.
Rewritten: every D1 to D5 file (src/application admin-facade, authorization, contracts, facades, status-labels, swap-facade, teacher-facade; src/data/session; src/runtime/production/access; tests/unit x7; tests/coverage x13; tests/integration x21 including production-wiring, notifications-wiring and runtime-config-cli (now checks the single three-setting configuration and that the old mode settings are ignored); scripts/verification replaced-modules and lint-scope).
Deleted, with proof elsewhere: `tests/integration/synthetic-route.test.ts` and `src/runtime/security/origin.ts` + its tests (the only caller was the deleted synthetic session route; proof: smoke 404 check and removed-synthetic-mode test); profile-picker timing harness (`tests/browser/profile-login-*.spec.ts`, `support/profile-login-*.ts`, `playwright.login-*.config.ts`, script `test:login-performance`, next.config dist-dir switch, README section) for Step 18.
Removed tests (small): runtime-boundaries login-measurement, same-origin and synthetic-profile/session tests; runtime-shell profile-selector tests (switcher-absence test added); two synthetic-session tests in facades; parent-actions authenticate/invitation demo tests; identity-actions resend test (replaced by an exports test); import/swap demo-mode tests; production-wiring RoutedAdminPort routing test and synthetic-mode test (replaced by "old mode setting changes nothing").
Browser type fixes only: `tests/browser/navigation-polish.spec.ts` and `visual-overhaul.spec.ts` import role list from `tests/support/role-profiles.ts` (placeholder until Steps 18 to 20 rewrite them).
Behaviour notes: "retryable" admin scenario now maps to state retryable; swap action needs a `counterpart` choice; scenario selects removed from admin pages; one unified invitation page.

### Step 17: results
Vitest 761 tests plus node-test suites, all green. Coverage: statements 97.08%, branches 90.97%, functions 96.28%, lines 98.05% (floor 80%, thresholds unchanged). typecheck, lint, format:check clean; `npm audit --audit-level=high` passes (5 moderate only); `npm run scan:privacy` PASS (1160 files, no allow-list additions).

### Leftovers for Step 22
`executionTarget: "synthetic-local"`, `scenarioId`, `fixtureId` fields; removed-synthetic-mode allow-list entries (start-smoke "synthetic route", verification/core.ts "scenario"/"synthetic session", run-local-verification.ts old settings); ci.yml and playwright.config.ts settings; unused production code `src/admin-experience/admin-service.ts` and `SessionApplicationFacade`.

## Part D result, browser phase (Steps 18 to 20)

### Step 18: harness
- `tests/browser/support/projects.ts` maps `chromium` to `worker_1` and port offset 0, `firefox` to `worker_2` and 1, `mobile-chrome` to `worker_3` and 2. `playwright.config.ts` starts one server per project with that `DATABASE_SCHEMA`; the synthetic settings and `IDENTITY_BROWSER_SCHEMA ?? "worker_4"` are gone.
- `tests/browser/support/seeded-schema.ts`: `bindSeededSchema()` registers a `beforeAll` that resets and seeds the project's schema and returns the world (schema, `account(tag)`, `id(key)`, `reseed()`); `signInAs`, `signOut`, `SERIOUS`. `support/scenarios.ts` (cancellation request, sign-up, a second notification written to the schema, `withOtherPage`) and `support/dates.ts` (days relative to the seed).
- `identity`, `directory-coordination` and `notifications-import` build their own world, so they call `bindSeededSchema({ seed: false })` (reset only) and read the schema lazily (deviation: they cannot use the small seed because they insert fixed ids and exact counts). `directory-coordination` and `notifications-import` still run on chromium only, as before.
- Guard: `tests/unit/browser-harness.test.ts` (29 tests) fails when a spec does not use the helper, when the project map is wrong, or when a fixed schema, picker click, demo route or mode setting is back.
- Deleted earlier (Step 15/16 dispatch): profile-picker timing specs, support and configs.

### Step 19: specs moved to real sign-in on seeded data
Rewritten: runtime-foundation, teacher-web, parent-web, admin-core, admin-advanced, functional-fixes, list-polish, navigation-polish, visual-overhaul. Same Hungarian copy and test ids; ids of records come from `world().id(...)`.
Dropped (reason, proof elsewhere):
- Scenario-driven states (`?scenario=full|conflict|retryable|terminal`, teacher `fixture=retryable|terminal`, interrupted import, reminder retry, lifecycle candidates): the real database has no such switch; proofs are `tests/integration` and `tests/coverage` on doubles, `tests/database/*`, and the interrupted import and reminder checks in `notifications-import.spec.ts`.
- Teacher "no responsible family" rows: the seed gives every task a family; proof `tests/integration/teacher-components`.
- Cover photo size test and chooser-only checks: the picker and its cover photo no longer exist; replaced by sign-in screen checks (overflow at 320 and 375, keyboard sign-in, images failing).
- "Foreign notification id" case: replaced by unknown and malformed ids.
Production fixes the real data exposed (small CSS only, `app/globals.css`): `.brand-mark` keeps its 56 px box and `.brand-link` is top-aligned so a failed logo no longer moves the page; the import fingerprint and a long sign-in address in the settings page wrap (a 38 px sideways scroll at 320 px in Firefox, and a 550 px wide import page on a phone); tick-box labels are excluded from the "label above field" measurement because they sit beside their box by design.
Three consecutive full runs after one build: 427 passed, 38 skipped, 0 failed each (10.7, 10.8, 10.8 minutes). The 38 skips are by design: `directory-coordination` and `notifications-import` on firefox and mobile-chrome (one production server, one browser), the identity keyboard test and the menu focus-ring test on mobile. Accessibility scans stay on the identity screens, the import screens (in `notifications-import`), the parent, teacher and admin lists and forms.

### Step 20: sign-in timing
`tests/browser/sign-in-timing.spec.ts`: each of the four seeded roles signs in through the real screen, must land inside 5000 ms (`SEED_TARGETS_MS.signIn`) and on its own home page; the sign-in screen itself must open inside the budget. Measured (three runs): about 200 to 220 ms on chromium and mobile-chrome, 230 to 245 ms on firefox.

### Verification of this dispatch
`npm run build` with the stack settings, typecheck, lint, format:check clean; `npm test` 58 files, 790 tests; `npm run scan:privacy` PASS (1160 files).

## Part E result (Steps 21 to 24)

### Step 21: workflow
`.github/workflows/ci.yml`: `APP_RUNTIME_MODE` and `APP_SYNTHETIC_FIXTURE_VERSION` removed from both jobs; the Validate job's step "Expose the stack's settings" now also exports `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the anon key masked) from `supabase status`, before `verify:local`, so build, smoke and browser find them; its time limit is 90 minutes; the SBOM job sets `SUPABASE_URL: https://app.example.invalid` and a dummy `SUPABASE_ANON_KEY`, and its metadata drops `runtimeMode` and `fixtureVersion`. Actions stay pinned to the same revisions; no deployment workflow was added.

### Step 22: verification scripts and leftovers
- `core.ts`, `run-local-verification.ts`, `evidence.schema.json`, `scenarios.json`: `runtimeMode` is `database` (or `linked-target`), `fixtureVersion` is dropped from records, report and text; the pipeline no longer sets the synthetic environment values. The `database-seed` key was already in place after `database-notifications-import` and before `database-shuffled`; `ci-config.test.ts` now asserts that order, `browser` last after every database key, 90 minutes, the exported settings, the placeholders and no synthetic setting. `validate-manifests.ts` and `aggregate-evidence.ts` needed no change (they call `core.ts`). Tests updated: `tests/unit/verification-core.test.ts`, `tests/coverage/verification-entrypoints.test.ts`.
- Leftovers removed: `executionTarget` is `database | linked-target` (contracts, evidence, tests); `fixtureId` is gone from the import preview model, the screen, the data adapter and the doubles; `src/admin-experience` (3 files and its test, with the 17-sheet table only it served) and `src/application/session-facade.ts` (`SessionApplicationFacade`, `SessionGateway`) are deleted with their tests; `replaced-modules.test.ts` lists `admin-experience`; `lint-scope.test.ts` allow-list is `src/access` only; production inventory is 216.
- Allow-list of `removed-synthetic-mode.test.ts`, now: `scripts/start-smoke.mjs` ("synthetic route": it asks the removed routes on purpose), and in `core.ts` and `run-local-verification.ts` only the evidence vocabulary: the word "scenario" (rows of `verification/scenarios.json`, not the removed switch) and the field name `runtimeMode` (value now `database`). I did not rename the evidence scenarios; that would touch the manifest, schema and every report.
- Not regenerated: the committed `verification/reports/*` still carry the old manifest hash and fixture line until `npm run verify:local` runs (Step 28).
- `verification/fixtures.json` (the four role contracts, ids such as `parent-local`) is unchanged: it is the role contract the manifests check, not demo-mode code.

### Step 23: bundle and scans
`tests/database/identity-bundle.test.ts` gains a test that the seed code names, the seed namespace and every seed password are absent from the whole `.next` output (browser and server); the service-role key tests were already there. Scans run: privacy (1155 files), secrets, SAST, no-deploy all pass; `npm audit --audit-level=high` passes (5 moderate). The privacy allowlist was not changed.

### Step 24: owner connection and namespace
`scripts/db/seed/index.ts` documents both rules. New `scripts/db/seed/owner-connection.test.ts` (source check: one guarded `connectLocalStack` per command, no data-service call in reset or write, sign-in service used only for users); `ids.test.ts` asserts `seedEmail` equals `workerAccountEmail`; `tests/database/reset.test.ts` gains two stack tests (the connection is the `postgres` owner that may truncate while `authenticated` and `service_role` may not; an account made the `db:worker` way is removed, another schema's is not).

### Verification of this dispatch
typecheck, lint, format:check clean; `npm test` 58 files 788 tests plus node suites 508 and 222; `npm run test:coverage` statements 97.15, branches 91.04, functions 96.32, lines 98.08; `npm run test:database:seed` 53 passed; `npm run test:bundle` 6 passed; verification script tests 42 passed; `npm run verify:manifests` valid. The browser suite and `verify:local` were not re-run in this dispatch (no browser code changed).

## Part F result and final run (Steps 25 to 28)

### Steps 25 to 27: documents
- `README.md` rewritten in English: prerequisites (Docker Desktop and its licence check, Node 24, npm 11), start, migrate, stop, worker, seed, large seed and reset commands, the schema selector, how to run the application against the stack, the test phases and the browser schema map, CI evidence and the deployment boundary. `tests/unit/readme-commands.test.ts` (46 tests) fails when a database, test, verify, smoke, check, build, dev, start, lint, typecheck or format script of `package.json` is not named in it, when it names an `npm run` script that does not exist, or when it names a removed setting.
- `HASZNALATI_UTMUTATO_HU.md` rewritten in Hungarian for a non-developer owner: preparation, start, the accounts (addresses by role; the passwords are only in `scripts/db/seed/data.ts` and are not repeated), sign-in and sign-out, lockout, forgotten password with the local mail catcher, the invitation page, the parent, teacher, group-admin and super-admin walkthroughs on the seeded data, testing with several people at once (separate browsers or private windows), reset and a test-notes table. The same test file checks that it holds no removed demo element and no seed password.
- `verification/reports/u5-workbook-and-known-limits.md`: states that the real workbook is untracked and ignored but still in git history (two commits touch it) until the owner rewrites history, and lists the known limits (reminder recipients not re-planned on group change; staged-data expiry depends on sign-ins; hosted-target checks outstanding; Hungarian notice titles need the owner's check), plus two findings of this unit: no screen or command sends an invitation yet, and the seed passwords are fictitious but tracked. The workbook file was never opened.

### Step 28: final run, honestly
Every command below ran on the real local stack (started by the owner; `DB_ALLOW_ALL_INTERFACES` was never set by me).
- `npm run verify:local` was run once and **stopped at its seventh step, `database-roles`**, after 20 seconds: the disposable role-migration check needs PostgreSQL 18 command line tools (`psql`, `initdb`, `pg_ctl`) and they are not installed on this machine (`POSTGRES_TOOLS_UNAVAILABLE`). I did not install software. Because the pipeline stops there, it wrote no new evidence and `verification/reports/local-acceptance.*` and `outstanding-targets.md` were **not regenerated**; they still carry the previous run's SHA and manifest hash. `npm run test:database:roles` remains unexecuted in this unit. To finish it: `brew install postgresql@18`, then `npm run verify:local` with the stack settings in the environment.
- The other pipeline stages were run one by one, in the pipeline's order, with these results (seconds): check:toolchain pass 0; verify:manifests pass 0 (39 scenarios); format:check pass 2; lint pass 4; typecheck pass 3; `npm test` pass 10 (vitest 59 files, 834 tests; node suites 508 and 222); db:migrate pass 0; test:database:stack pass 9 (114 tests); test:database:identity pass 28 (330); test:database:directory pass 47 (352); test:database:notifications-import pass 28 (258); test:database:seed pass 6 (53); `test:database:shuffled` pass 153 (11 files run in shuffled order, 0 failures); `test:coverage` pass 11 (statements 97.17%, branches 91.00%, functions 96.40%, lines 98.08%); verify:security pass 3 (privacy 1163 files, secrets 2016, SAST 409, no-deploy 409, audit: 5 moderate, none high or critical); build pass; `test:bundle` pass (6 tests); `smoke:start` pass.
- Browser phase, all three browsers, on a fresh build with `caffeinate` to keep the machine awake: run A 425 passed, 2 failed, 38 skipped, 20.9 minutes; run B 427 passed, 0 failed, 10.9 minutes; run C 427 passed, 0 failed, 10.8 minutes; run D 427 passed, 0 failed, 10.7 minutes. Run A was twice as slow as the others and its two failures were timeouts of a sign-out and a sign-in click (`admin-advanced` on chromium, `visual-overhaul` on firefox); an earlier, uncontrolled run of 1.1 hours on this machine also timed out in eight places. I take this as the machine being slow or asleep, not as a product fault, but I cannot prove it; B, C and D are three clean runs in a row. The 38 skips are by design. Sign-in times: chromium about 200 ms, mobile Chrome 203 to 217 ms, firefox 234 to 243 ms (budget 5000 ms).
- `source-manifest.json` (191 written or changed files, 46 deleted) and `traceability.json` (39 ids, all of the unit's NFR ids plus FR1.3, FR1.5, FR11.1, FR11.2 and FR12.1) were written from the working tree; nothing is committed.

### Tests written but not executed
`tests/database/current-role-migration.test.ts` (the roles check) cannot run here for the reason above; it is unchanged by this unit.

### Deviations
- The browser specs `identity`, `directory-coordination` and `notifications-import` reset the schema but do not seed it (they create their own records). `directory-coordination` and `notifications-import` run on chromium only.
- Scenario-driven browser checks of the demo mode were dropped, each with a named proof elsewhere (see the browser section above).
- The verification vocabulary "scenario" and the evidence field `runtimeMode` stay, and so do their entries in the allow-list of `removed-synthetic-mode.test.ts` (owner decision).
- Small CSS fixes in `app/globals.css` found by real data (logo box, sign-in address wrapping, import fingerprint wrapping).

### Step 28 completed: `npm run verify:local` passes to the end
This section replaces the "stopped at database-roles" statement above, which was true when it was written.

- **Coverage-log privacy false positive: cause and fix.** The node coverage run of `npm run test:coverage:domain` listed the test-support files (`tests/support/port-doubles.ts` and others, which the `src` tests import) as if they were production source. The uncovered-line list of `port-doubles.ts` ("... 654 656 660 662 ...") was written to `.verification/logs/coverage.log`, and the privacy scan took the number sequence for a telephone number. The fix is in `package.json`: `test:coverage:domain` now passes `--test-coverage-exclude="tests/**"`, the same boundary the vitest coverage already has (production source only). The scan, its patterns, its allowlist and the thresholds (80/80/80) are unchanged; the report now holds no row for test-support files. The domain coverage run still passes (all files 99.39% statements, 94.30% branches, 97.28% functions for what it measures).
- **Final run** (PostgreSQL 18 tools on `PATH`, stack settings loaded, `caffeinate -i`): `LOCAL_VERIFICATION_PASS`, total 946 seconds, evidence `pass=33 fail=0 outstanding=6`, privacy scan 1217 files pass. One earlier attempt of the same command failed once at `database-notifications-import`: the 2000-row import timing test measured 86.8 s against its ceiling while the machine was loaded; run alone right after, the stage passed in 23 s (258 tests), and the full command then passed. This is a load-sensitive timing test; it is recorded, not changed.
- **Stages (seconds / counts):** toolchain 0; manifests 0 (39 scenarios); format 2; lint 4; typecheck 3; tests 10 (vitest 59 files and 834 tests; node suites 508 and 222); database-roles 5 (9 tests, the PostgreSQL 18 check, first time executed in this unit); database-migrate 0; database-stack 16 (114 tests); database-identity 28 (330); database-directory 41 (352); database-notifications-import 25 (258); database-seed 6 (53); database-shuffled 148 (1107 tests over every database file in shuffled order, 0 failures); coverage 11 (statements 97.17%, branches 91.00%, functions 96.40%, lines 98.08%); security 2 (privacy, secrets, SAST, no-deploy, audit: 5 moderate, no high or critical); build 3; bundle 1 (6 tests); smoke 2; browser 637 (427 passed, 38 skipped by design, 0 failed, 10.6 minutes). Four separate browser runs earlier: 425+2 failed (slow machine), 427, 427, 427.
- **Regenerated reports:** `verification/reports/local-acceptance.json`, `local-acceptance.md` and `outstanding-targets.md` are rewritten for commit `4db6acbf6a98` (the commit the working tree sits on; nothing is committed) and the new manifest hash `0a911aa9...`: 33 PASS, 0 FAIL, 6 OUTSTANDING. The outstanding rows are the two Safari smoke checks, Supabase auth and RLS, Supabase persistence, scheduler and provider, and Vercel preview and staging: all hosted-target evidence, as the known-limits report states.
- The statement "Tests written but not executed" above no longer applies: `tests/database/current-role-migration.test.ts` ran in this final run (9 tests, pass).

## Review repair (after the U5 review: one Major, five Minor)

- **Major, local-only guard.** A loopback database with no JWT-secret setting used to pass the guard, so a hosted database reached through a tunnel could be reset. `scripts/db/local-guard.ts` now also requires a positive marker that only the Supabase CLI's local stack has: the connection password in `DATABASE_URL` must equal the CLI's default, compared by SHA-256 hash only (`LOCAL_STACK_DB_PASSWORD_HASH`, the same convention as the default-key hashes of the privacy allowlist; no new plain value is added anywhere). The check (`assertLocalStackPassword`) runs inside `assertLocalSettings`, before any connection, so a refusal changes nothing and prints no password. The existing checks stay. Tests: `scripts/db/local-guard.test.ts` (the marker is accepted only for the default, refused before connecting, never printed, and an unset JWT secret still needs it) and `scripts/db/seed/commands.test.ts` (seed and reset refuse a loopback database with another password at step `guard`, with zero connections and zero accounts created; the leak checks now look for the whole connection address, because the default password is a common word).
- **Minor 1, `db:reset` on `public`.** `npm run db:reset` now refuses to empty the default `public` schema unless `--yes` is given (step `confirm`, plain message, nothing connected). The worker schemas need no flag, and `resetSchema` for programs (the browser harness and the database tests) is unchanged. Tests are in `commands.test.ts`; `README.md`, `HASZNALATI_UTMUTATO_HU.md` and `tests/unit/readme-commands.test.ts` are updated.
- **Minor 2, two facts about migration `20261044` (merged, not edited).** (a) The purge runs inside `identity_housekeeping()`, so a purge failure rolls the whole housekeeping run back with it: a known limit. Suggested follow-up: run the purge as its own call (its own transaction and result field) so that a problem in the log table cannot block the expiry work. (b) The wording of BR3.4 ("never deleted") is superseded by the 365-day purge of the log (NFR1.68).
- **Minor 3.** `traceability.json` now names single existing files for every target and test; no glob and no command string remains (a script checked that each path exists).
- **Minor 4.** `source-manifest.json` keeps only `stage`, `unit`, `version` and `writes`; deleted files are listed inside `writes`, and the three regenerated reports under `verification/reports/` are added.
- **Minor 5, known load-sensitive test.** The 2000-row import timing test (U4, `tests/database/notifications-timing.test.ts`) measured 86.8 s against its ceiling once, while the machine was loaded; alone the whole stage passes in about 23 s. The ceiling and the test are unchanged: it is a known load-sensitive test, and a failure under heavy machine load should be re-run alone before it is treated as a regression.
