# Code Structure

## Layout
| Path | Classification | Content |
|---|---|---|
| app/ | Controller/Handler + UI | App-router routes: `/` (home/chooser), `/belepes`, `/meghivas/[token]`, `/hozzaferes-megtagadva`, `/szulo/*`, `/teacher/schedule*`, `/admin/*`, `api/*`, `munkatars/beosztas*` |
| app/admin/_components, _lib | Service/Utility | ResponsiveCollection, AdminFilterBar, AdminPagination, AsyncStatePanel, AdminMutationForm, AdminAccessState, ImportWorkflow; session, facade, action-state |
| app/szulo/_components, _lib | Service/Utility | NotificationReadForm, ParentStatePanel, ParentMutationForm, ParentAccessState; session, facade, action-state |
| app/teacher/_components, _lib, schedule/_components | Service/Utility | TeacherStatePanel, FocusedStateSection, ScheduleCollection, ScheduleFilter; filters, compatibility |
| app/globals.css | Static/Asset | One large stylesheet, tokens on `:root` |
| src/runtime | Configuration | AppShell, AppNav, BackToHomeLink, BrandMark, ProfileSelector, composition, config, session cookie, synthetic profiles |
| src/application | Service | Facades, AuthorizationContract matrix, contracts (model types), idempotency, projection, results, status-labels |
| src/access, admin-core, admin-advanced, admin-experience, coordination, directory, import-migration, notifications, parent-experience, parent-web, privacy-audit, teacher-tracking, teacher-web | Model/Service/Repository | Domain modules with in-memory repositories and colocated tests; demo data lives in `parent-web/synthetic-parent.ts`, `admin-core/synthetic-admin.ts`, `admin-advanced/synthetic-advanced.ts` |
| tests/ | Test | unit, integration, coverage (page-level Vitest), browser (Playwright), database |
| scripts/, verification/ | Utility | Toolchain, runtime config validation, start smoke, local verification pipeline, fixtures, evidence |
| supabase/migrations | Migration | RLS and current-role SQL |
| proxy.ts, next.config.ts | Middleware/Configuration | CSP nonce, security headers |

## Patterns
- Page = async server component: resolve session, resolve facade, call, render by result state.
- Each area (admin, szulo, teacher) has a `layout.tsx` wrapping children in `AppShell` with the session's profile.
- Server action = parse form, validate, `resolveBoundary`, facade call, `revalidatePath`, map result to an action state (`ParentActionState`, `AdminActionState`).
- Colocated `*.test.ts` under `src/`, page-level tests in `tests/coverage`.
- Imports use explicit `.ts`/`.tsx` extensions (ESM, strip-types).

## Intent-relevant files
- Parent notifications: app/szulo/ertesitesek/page.tsx, app/szulo/_components/NotificationReadForm.tsx, app/szulo/actions.ts (`markNotificationReadAction`), src/parent-web/synthetic-parent.ts (fixtures, `markNotificationRead`, `createRequest`).
- Menu: src/runtime/synthetic/profiles.ts, src/runtime/AppNav.tsx (`currentNavigationId`), src/runtime/BackToHomeLink.tsx; back link at app/szulo/feladatok/[id]/page.tsx (`duty-detail-back-link`), csere/ and lemondas/ pages.
- Admin: app/admin/{nyilvantartasok,feladatok,archivum,jovahagyasok,emlekeztetok,adatvedelem}/, `.../uj/page.tsx` (two new forms), `.../[id]/page.tsx`, app/admin/actions.ts, app/admin/_components/{ResponsiveCollection,AdminFilterBar,AdminMutationForm}.tsx, src/application/status-labels.ts.
- Fixtures: src/parent-web/synthetic-parent.ts, src/admin-core/synthetic-admin.ts, src/admin-advanced/synthetic-advanced.ts, verification/fixtures.json.
- CSS: app/globals.css (cards, notifications, nav).
