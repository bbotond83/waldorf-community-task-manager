# Code Structure

## Layout
| Path | Classification | Content |
|---|---|---|
| app/ | Controller/Handler + UI | App-router routes: `/` (home/chooser), `/belepes`, `/meghivas/[token]`, `/hozzaferes-megtagadva`, `/szulo/*`, `/teacher/schedule*`, `/admin/*`, `api/*`, `munkatars/beosztas*` |
| app/admin/_components, _lib | Service/Utility | ResponsiveCollection, AdminFilterBar, AdminPagination, AsyncStatePanel, AdminMutationForm, ImportWorkflow; session (withCoreNavigation), facade, action-state |
| app/szulo/_components, _lib | Service/Utility | NotificationReadForm, ParentStatePanel, ParentMutationForm, ParentAccessState; session, facade |
| app/teacher/_components, _lib, schedule/_components | Service/Utility | TeacherStatePanel, FocusedStateSection, ScheduleCollection, ScheduleFilter; filters, compatibility |
| app/globals.css | Static/Asset | One 1000-line stylesheet, tokens on `:root` |
| src/runtime | Configuration | AppShell, BrandMark, ProfileSelector, composition, config, session cookie, synthetic profiles |
| src/application | Service | Facades, AuthorizationContract matrix, contracts (model types), idempotency, projection, results |
| src/access, admin-core, admin-advanced, admin-experience, coordination, directory, import-migration, notifications, parent-experience, parent-web, privacy-audit, teacher-tracking, teacher-web | Model/Service/Repository | Domain modules with in-memory repositories and colocated tests |
| tests/ | Test | unit, integration, coverage (page-level Vitest), browser (Playwright), database |
| scripts/, verification/ | Utility | Toolchain, runtime config validation, start smoke, local verification pipeline, evidence |
| supabase/migrations | Migration | RLS and current-role SQL |
| proxy.ts, next.config.ts | Middleware/Configuration | CSP nonce, security headers |

## Patterns
- Page = async server component: resolve session, resolve facade, call, render by result state.
- Each area (admin, szulo, teacher) has a `layout.tsx` wrapping children in `AppShell` with an area-specific session profile.
- Colocated `*.test.ts` under `src/`, page-level tests in `tests/coverage`.
- Imports use explicit `.ts`/`.tsx` extensions (ESM, strip-types).

## Intent-relevant files
Navigation: src/runtime/synthetic/profiles.ts, app/admin/_lib/session.ts, src/application/authorization.ts, src/runtime/AppShell.tsx, layouts. Lists: ResponsiveCollection.tsx, ScheduleCollection.tsx, app/szulo/ertesitesek/page.tsx. Landing: app/page.tsx, app/api/synthetic/session/route.ts. CSS: app/globals.css (focus :75, nav :292-310, admin cards :349,407-427, parent cards :614-706, notifications :708,761-770, teacher :787-910, mobile :930-990).
