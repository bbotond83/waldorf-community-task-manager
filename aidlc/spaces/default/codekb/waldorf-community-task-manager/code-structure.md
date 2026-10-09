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

## Shell, menu and parent request screens (deep scan 2026-10-09)
- Shell: src/runtime/AppShell.tsx, AppNav.tsx (`currentNavigationId`), BackToHomeLink.tsx, BrandMark.tsx, synthetic/profiles.ts (menus), session/session.ts, synthetic/access-state.ts; area layouts app/{admin,szulo,teacher}/layout.tsx; session resolvers app/{admin,szulo,teacher}/_lib/session.ts.
- Parent: app/szulo/ertesitesek/page.tsx, feladatok/page.tsx, feladatok/[id]/page.tsx (+ csere/, lemondas/), _components/{NotificationReadForm,MarkNotificationRead,ParentMutationForm,PendingRequestNotice,ParentStatePanel,ParentAccessState}.tsx, actions.ts, src/parent-web/notification-context.ts.
- Admin forms and demo text: app/admin/_components/{AdminMutationForm,DeveloperDetails,ImportWorkflow}.tsx and pages emlekeztetok, beallitasok, adatvedelem, import, feladatok/[id], nyilvantartasok/[id].

## Intent-relevant files (admin list polish)
- Teacher filter: app/teacher/schedule/page.tsx, schedule/_components/ScheduleFilter.tsx (clear link line 48), app/teacher/_lib/filters.ts (`DEFAULT_TEACHER_FILTERS`, `parseTeacherFilters`, `teacherFilterQuery`), app/teacher/_components/TeacherStatePanel.tsx (second clear link).
- Admin lists: app/admin/{nyilvantartasok,feladatok,jovahagyasok,archivum}/page.tsx, app/admin/_components/{AdminFilterBar,AdminPagination,AdminBackLink,ResponsiveCollection}.tsx, `.../uj/page.tsx` (record and task create forms).
- Status words: src/application/status-labels.ts, rendered in ResponsiveCollection, admin detail pages, emlekeztetok, adatvedelem, app/szulo/feladatok (list and detail), teacher ScheduleCollection (`currentStatusLabel`, unmapped).
- CSS: app/globals.css (tokens 3-20, `button` ~64, `.secondary-button` ~284, `.admin-filter` ~435, `.admin-form` ~493, `.admin-page-actions` ~515, `.parent-filter` ~740, `.teacher-filter` ~979-1030, responsive ~1166-1215).
- User-facing "rekord" copy: nyilvantartasok list/uj/[id], archivum list/[id], admin/actions.ts, admin/_lib/action-state.ts, ImportWorkflow.tsx, src/admin-advanced/synthetic-advanced.ts, HASZNALATI_UTMUTATO_HU.md.

## Intent-relevant files (previous intent, functional-test fixes)
- Parent notifications: app/szulo/ertesitesek/page.tsx, app/szulo/_components/NotificationReadForm.tsx, app/szulo/actions.ts (`markNotificationReadAction`), src/parent-web/synthetic-parent.ts (fixtures, `markNotificationRead`, `createRequest`).
- Menu: src/runtime/synthetic/profiles.ts, src/runtime/AppNav.tsx (`currentNavigationId`), src/runtime/BackToHomeLink.tsx; back link at app/szulo/feladatok/[id]/page.tsx (`duty-detail-back-link`), csere/ and lemondas/ pages.
- Admin: app/admin/{nyilvantartasok,feladatok,archivum,jovahagyasok,emlekeztetok,adatvedelem}/, `.../uj/page.tsx` (two new forms), `.../[id]/page.tsx`, app/admin/actions.ts, app/admin/_components/{ResponsiveCollection,AdminFilterBar,AdminMutationForm}.tsx, src/application/status-labels.ts.
- Fixtures: src/parent-web/synthetic-parent.ts, src/admin-core/synthetic-admin.ts, src/admin-advanced/synthetic-advanced.ts, verification/fixtures.json.
- CSS: app/globals.css (cards, notifications, nav).
