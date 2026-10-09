# Component Inventory

## AppShell
src/runtime/AppShell.tsx. Header (BrandMark, profile summary, "Tesztprofil váltása" form), `<details class="navigation-panel" open>` with `<nav aria-label="Fő navigáció">` rendering `profile.navigation` as plain links (`app-shell-navigation-<id>`), `<main id="fo-tartalom" tabIndex=-1>`, live status region. No current-page state, no single-item hiding. Depends on BrandMark, SyntheticProfile. Used by app/page.tsx and the admin, szulo, teacher layouts.

## BrandMark
src/runtime/BrandMark.tsx. Logo image linking to `/` (`brand-link`). Used by AppShell, ProfileSelector (unlinked) and public pages.

## ProfileSelector
src/runtime/ProfileSelector.tsx. Cover image plus one POST form per profile (`profile-selector-<id>-button`) to /api/synthetic/session; uses `withSyllableBreaks` from src/runtime/hyphenation.ts.

## Synthetic profiles
src/runtime/synthetic/profiles.ts. Four profiles, each with `label`, `scopeSummary`, `homePath`, `navigation`; `getSyntheticProfile`. Source of the 2/1/3/8 nav lists.

## Admin session
app/admin/_lib/session.ts. `resolveAdminSession` plus `withCoreNavigation` (:76-88) producing the 5/9 item admin menu and scope (group vs organization).

## AuthorizationContract
src/application/authorization.ts. Matrix rows, per-row navigation items, `navigation()` with `HOME_PATH_BY_ROLE`, `authorize()`.

## ResponsiveCollection
app/admin/_components/ResponsiveCollection.tsx. `ul.admin-collection` of `li.admin-card` (`<testId>-item-<id>`): title, raw `item.state` badge, "Részletek" link (`<testId>-open-<id>`). Consumers: archivum, jovahagyasok, nyilvantartasok, feladatok pages. Tests: tests/integration/admin-components.test.tsx:80-110.

## AdminFilterBar
app/admin/_components/AdminFilterBar.tsx. Search and Hungarian state select (values active, archived, open, pending; labels Aktív, Archivált, Nyitott, Függőben) — the only admin Hungarian state label source.

## Admin dashboard
app/admin/page.tsx. Three `a.dashboard-link` whole-card panels (approvals, records, tasks) with counts; h1 autoFocus.

## ParentDutiesPage
app/szulo/feladatok/page.tsx. Whole-card pattern (`a.parent-card-link` in `li.parent-card`), Hungarian `STATE_LABELS`, filter by `allapot`.

## ParentNotificationsPage
app/szulo/ertesitesek/page.tsx. Cards with title, `TIMING_LABEL`, `PROVIDER_LABEL`, read/unread text, "Megnyitás" link (`notification-link-<id>`) and `NotificationReadForm` for unread items.

## NotificationReadForm
app/szulo/_components/NotificationReadForm.tsx. Client form (`useActionState`) with hidden id and idempotency key `notice:<id>:read`, submit button "Olvasottnak jelölöm" (`notification-read-button-<id>`), result region (`notification-state-<id>-<state>`) and "Kapcsolódó feladat" link.

## ScheduleCollection
app/teacher/schedule/_components/ScheduleCollection.tsx. Desktop table and mobile card list, both with "Részletek" links (`teacher-schedule-open-<id>`, `teacher-schedule-card-open-<id>`); exports `formatScheduleRange`, `TrackingFields`.

## Global stylesheet
app/globals.css (1000 lines). Tokens (:14 `--color-focus`), global `:focus-visible` (:75), `nav` styles (:292-310), card styles for admin, parent, teacher, notifications, responsive block (:930-990).

## Domain modules
src/access, admin-core, admin-advanced, admin-experience, coordination, directory, import-migration, notifications, parent-experience, parent-web, privacy-audit, teacher-tracking, teacher-web: in-memory synthetic services and repositories with colocated tests; `admin-core/synthetic-admin.ts` defines the raw admin item states.
