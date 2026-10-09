# Component Inventory

## AppShell
src/runtime/AppShell.tsx. Header (BrandMark, profile summary, "Tesztprofil váltása" form), renders `AppNav` for `profile.navigation`, `<main id="fo-tartalom" tabIndex=-1>`, live status region. Used by app/page.tsx and the admin, szulo, teacher layouts.

## AppNav
src/runtime/AppNav.tsx. Client `<details class="navigation-panel" open>` with `<nav aria-label="Fő navigáció">`; `currentNavigationId(items, pathname)` (exact href, else longest path-prefix item, `/admin` only exact) sets `aria-current="page"`; test ids `app-shell-navigation-<id>`. Path-only decision, no origin/"from" input. Tests: tests/integration/app-nav.test.tsx.

## BackToHomeLink
src/runtime/BackToHomeLink.tsx. Link to `homePath ?? "/"`; teacher home relabelled "Vissza a beosztáshoz". Used by ParentAccessState, AdminAccessState only.

## BrandMark
src/runtime/BrandMark.tsx. Logo image linking to `/` (`brand-link`).

## ProfileSelector
src/runtime/ProfileSelector.tsx. Cover image plus one POST form per profile (`profile-selector-<id>-button`) to /api/synthetic/session.

## Synthetic profiles
src/runtime/synthetic/profiles.ts. Four profiles with `label`, `scopeSummary`, `homePath`, `navigation` (parent 2 items Feladatok then Értesítések, teacher 0, group admin 5, super admin 9); `getSyntheticProfile`; one menu list per profile.

## Admin session
app/admin/_lib/session.ts. `resolveAdminSession` (profile, scope group vs organization, application session); no navigation rewrite at HEAD.

## AuthorizationContract
src/application/authorization.ts. Matrix rows, per-row navigation items, `navigation()` with `HOME_PATH_BY_ROLE`, `authorize()`.

## ResponsiveCollection
app/admin/_components/ResponsiveCollection.tsx. `ul.admin-collection` of `li.admin-card` (`<testId>-item-<id>`) holding one whole-card `Link` (`<testId>-open-<id>`) with title and `statusLabel(item.state)` badge. Consumers: archivum, jovahagyasok, nyilvantartasok, feladatok pages.

## AdminFilterBar
app/admin/_components/AdminFilterBar.tsx. GET form with search `q` and fixed state select (Minden állapot, Aktív, Archivált, Nyitott, Függőben) used by nyilvantartasok and feladatok (and jovahagyasok); built from `statusLabel`.

## AdminMutationForm
app/admin/_components/AdminMutationForm.tsx. Client `useActionState` wrapper: status/alert region (`<testId>-state-<state>`), focus on failure, submit button `<testId>-submit-button`. Used by all admin forms including the two "uj" pages.

## Admin pages with raw demo-facing text
app/admin/feladatok/[id]/page.tsx ("Verzió", "Kapacitási helyzet" select), app/admin/nyilvantartasok/[id]/page.tsx ("Verzió"), app/admin/emlekeztetok/page.tsx ("Korreláció" row, "OUTSTANDING" provider text), app/admin/adatvedelem/page.tsx ("Forgatókönyv" select).

## Admin dashboard
app/admin/page.tsx. Three whole-card `a.dashboard-link` panels (approvals, records, tasks) with counts.

## ParentDutiesPage
app/szulo/feladatok/page.tsx. Whole-card `a.parent-card-link`, page-local Hungarian `STATE_LABELS`, filter `allapot`; exports `formatBudapestDate`.

## ParentDutyDetailPage
app/szulo/feladatok/[id]/page.tsx. Back link `duty-detail-back-link` ("Vissza a feladatokhoz"), details, signup form, swap/cancel links when `assignmentId` is set (independent of duty state), contribution form.

## ParentRequestPages
app/szulo/feladatok/[id]/csere/page.tsx and lemondas/page.tsx. Back link "Vissza a feladathoz", protected-reason form; `?scenario=` test outcomes.

## ParentNotificationsPage
app/szulo/ertesitesek/page.tsx. Whole-card link (`notification-link-<id>`) to `notification.link`, title, `TIMING_LABEL`, `PROVIDER_LABEL` ("Szimulált szolgáltató…"), "Olvasott"/"Olvasatlan" text, plus `NotificationReadForm` sibling.

## NotificationReadForm
app/szulo/_components/NotificationReadForm.tsx. Client form (`useActionState`), hidden idempotency key `notice:<id>:read`, checkbox `notification-read-checkbox-<id>` auto-submitting on tick, disabled when done, `<noscript>` "Mentés" button, state region `notification-state-<id>-<state>`; focus moves to card link on success, back to checkbox on failure.

## ScheduleCollection
app/teacher/schedule/_components/ScheduleCollection.tsx. Desktop table and mobile card list with links; exports `formatScheduleRange`, `TrackingFields`.

## Status labels
src/application/status-labels.ts. `STATUS_LABELS` (34 Hungarian labels), `statusLabel`, `UNKNOWN_STATUS_LABEL`; tests in status-labels.test.ts.

## Global stylesheet
app/globals.css. Tokens, global `:focus-visible`, nav, card styles for admin, parent, teacher, notifications, responsive block.

## Domain modules
src/access, admin-core, admin-advanced, admin-experience, coordination, directory, import-migration, notifications, parent-experience, parent-web, privacy-audit, teacher-tracking, teacher-web: in-memory synthetic services and repositories with colocated tests. `parent-web/synthetic-parent.ts` holds duty and notification fixtures (including the "– Firefox próba" / "– mobil próba" copies), request state and reset.
