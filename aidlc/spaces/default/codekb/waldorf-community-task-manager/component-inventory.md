# Component Inventory

## UI Components and Pages (deep)

### RootLayout
`app/layout.tsx` - `<html lang="hu">`, metadata, imports `globals.css`. Depends on: GlobalStyles.

### GlobalStyles
`app/globals.css` (857 lines) - tokens, base elements, `.selector-page`, `.profile-grid`, `.profile-card`, `.site-header`, `.navigation-panel`, `.admin-*`, `.parent-*`, `.teacher-*`, `.advanced-*`; breakpoint `44rem`; reduced-motion rule. Hyphenation: `overflow-wrap: anywhere` on `h1, h2, p`, no `hyphens`.

### ProfileSelector
`src/runtime/ProfileSelector.tsx` - heading, one `article.profile-card` per profile with `<h2>{label}</h2>`, `scopeSummary`, and a POST form to `/api/synthetic/session` with hidden `profileId` and submit button "Profil használata". Test IDs `profile-selector[-<id>-form|-input|-button]`. Used by HomePage. Tests: `tests/integration/runtime-shell.test.tsx`, all Playwright specs.

### AppShell
`src/runtime/AppShell.tsx` - skip link, `.site-header` (eyebrow, profile label and scope summary, "Tesztprofil váltása" form), `details.navigation-panel` with profile navigation, `main#fo-tartalom`, live status "<label> profil aktív.". Used by `app/{szulo,admin,teacher}/layout.tsx` and HomePage. Natural place for logo and header branding.

### SyntheticProfiles
`src/runtime/synthetic/profiles.ts` - four profiles (id, role, label, scopeSummary, homePath, navigation). Source of role labels.

### RuntimeConfigurationError
`src/runtime/RuntimeConfigurationError.tsx` - redacted configuration failure page.

### HomePage
`app/page.tsx` - composes runtime; renders production boundary panel, ProfileSelector (signed out) or AppShell greeting "Üdvözlünk, <label>!" (`.home-panel`).

### LoginPage
`app/belepes/page.tsx` + `AuthenticationEntry.tsx` - parent login form (`.centered-panel`, `.parent-form`).

### ParentDutiesPage
`app/szulo/feladatok/page.tsx` - filter form, `ul.parent-collection` of `li.parent-card` (`duty-card-<id>`) containing title, formatted date, state badge and `a` "Részletek" (`duty-open-<id>`) preserving `?allapot=`. Exports `formatBudapestDate`.

### ParentDutyDetailPage
`app/szulo/feladatok/[id]/page.tsx` - back link, details, signup/contribution forms, swap/cancel links. Also `csere/` and `lemondas/` pages, `ertesitesek/page.tsx`.

### ParentSupportComponents
`app/szulo/_components/` (ParentStatePanel, ParentMutationForm, ParentAccessState, NotificationReadForm), `_lib/{facade,session,action-state}.ts`, `actions.ts`.

### AdminDashboardPage
`app/admin/page.tsx` - four `DashboardPanel` sections (`.admin-dashboard-panel`; test IDs `admin-dashboard-approvals|records|tasks|queue`) with counts inside `AsyncStatePanel`; no links. Counts: pending/open approvals, records, tasks and events, pending requests.

### AdminListPages
`app/admin/{feladatok,jovahagyasok,nyilvantartasok,archivum}/page.tsx` - filter bar, `ResponsiveCollection`, pagination; read `?q=` and `?state=`.

### AdminSupportComponents
`app/admin/_components/` (AdminFilterBar, AdminPagination, AsyncStatePanel, ResponsiveCollection with its own "Részletek" link, AdminMutationForm, ImportWorkflow, AdminAccessState), `_lib/`, actions.

### TeacherArea
`app/teacher/` - layout, schedule list (table plus mobile cards), detail, state panels, filters.

### SessionRoutes
`app/api/synthetic/session/route.ts`, `app/api/synthetic/reset/route.ts`, `app/api/readiness/route.ts`, legacy redirects `app/munkatars/beosztas/`.

### CspProxy
`proxy.ts` - per-request nonce CSP.

## Domain Modules (skimmed)

### ApplicationFacades
`src/application/` - facades, contracts, results, authorization, idempotency, projection, validation.

### DomainServices
`src/access`, `src/admin-advanced`, `src/admin-core`, `src/admin-experience`, `src/coordination`, `src/directory`, `src/import-migration`, `src/notifications`, `src/parent-experience`, `src/parent-web`, `src/privacy-audit`, `src/teacher-tracking`, `src/teacher-web` - services, types, in-memory repositories, colocated tests.

### RuntimeComposition
`src/runtime/{composition,config,types}.ts`, `session/`, `synthetic/`, `production/`, `security/`.

## Dependencies Between Components

HomePage -> ProfileSelector | AppShell; role layouts -> AppShell; pages -> facades -> DomainServices; every page -> GlobalStyles via RootLayout.
