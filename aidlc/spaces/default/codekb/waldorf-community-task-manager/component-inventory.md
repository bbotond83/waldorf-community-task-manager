# Component Inventory

Full rescan 2026-10-12 (HEAD `80bd4f4`), focused update 2026-10-27 (HEAD `5d2b484`, intent `denied-audit-ratelimit`), focused update 2026-11-02 (HEAD `3456409`, intent `empty-nav-after-login`). Revision 2 on 2026-11-02 (same intent, owner asked to also scan the audit area) re-read the audit migrations 20261012, 20261013, 20261015, 20261019, 20261044 and 20261045, `supabase/config.toml` and the database test support, `audit`, `audit-purge` and `migrations` tests; sections marked "(2026-11-02, audit re-verified)" come from it. Focused update 2026-11-02 (HEAD `1070fd6`, intent `no-access-signout`): the "Nincs jogosultság" components and the sign-out reuse path (new section "Denied-state and sign-out components (2026-11-02, after 1070fd6)"); `app`, `src/runtime`, `src/identity` copy, `proxy.ts` and `tests/browser` were re-read for it. Focused update 2026-11-06 (HEAD `1672d98`, intent `signout-no-access`, revision of the same scope): the no-access screens re-read at their current lines; new section "Sign-out per no-access screen (2026-11-06, after 1672d98)"; `app/_identity`, `app/page.tsx`, the three role layouts and access states, `src/runtime/production/access.ts`, `src/identity/copy.ts`, `src/identity/session.ts`, `proxy.ts` and `tests/coverage` (three files) were read for it. Focused update 2026-11-04 (HEAD `251c4b3`, intent `stitch-design-update`): `app`, `proxy.ts` and `tests/browser` re-read for the visual restyle; new section "Styled components and style hooks (2026-11-04, after 251c4b3)"; the denied-state rows and the `app`, `proxy.ts` and `tests/browser` details are updated in place. The 2026-10-27 update rewrote `supabase/migrations` and added `tests/database`; the 2026-11-02 update (`3456409`) rewrote `app`, `src/runtime`, `proxy.ts` and added `src/identity`, `tests/integration` and `tests/browser/support`. Every other entry is kept from 2026-10-12 (Wiring column: Wired = called by `app/` then; Unwired = referenced only by itself and tests) and does not list modules added since (`src/data`, `src/identity`, `scripts/db`).

## Summary table

| Component | Wiring | Responsibility | Depends on |
|---|---|---|---|
| app | Wired | Pages, layouts, server actions, session and home resolvers (`app/_identity`), role shells, access-state (denied) components (2026-11-02), the global stylesheet `globals.css` and the root layout (2026-11-04) | src/runtime, src/identity, src/application, src/data |
| proxy.ts | Wired (2026-11-02) | CSP nonce (including `font-src 'self'`) and session cookie renewal or clearing | src/identity |
| src/identity | Wired (2026-11-02) | Sign-in, session, cookies, refresh, invitations, reset, accounts, Hungarian copy | src/runtime/database, Supabase sign-in service |
| tests/integration | Verification (2026-11-02) | Vitest tests of actions, screens, wiring and shell | app, src |
| tests/browser | Verification (2026-11-02) | Playwright specs, axe checks and seeded-schema helpers (`support/`); 13 specs, about 120 declared tests, three browsers (2026-11-04) | scripts/db |
| src/application | Wired | Authorization, pipeline, idempotency, result model, facades | src/access (types, role-policy, session-grants), src/teacher-tracking |
| src/runtime | Wired | Config, production-only composition, role access resolvers, menus, UI shell (2026-11-02) | src/application, src/data |
| src/parent-web | Wired | In-memory parent port | src/application |
| src/admin-core | Wired | In-memory admin port | src/application |
| src/admin-advanced | Wired | In-memory import/reminder/governance/lifecycle/settings | src/application, src/runtime |
| src/teacher-web | Wired | Teacher schedule adapter | src/application, src/teacher-tracking |
| src/teacher-tracking | Partly wired | Tracking model plus unwired service | none |
| src/access | Mostly unwired | Access service, grants, RPC adapter | none |
| src/coordination | Unwired | Sign-up/swap domain service | none |
| src/directory | Unwired | Families/children/parents | none |
| src/import-migration | Unwired | Import service, 17-sheet registry | none |
| src/notifications | Unwired | Reminder thresholds, durable jobs | none |
| src/parent-experience | Unwired | Parent read model | none |
| src/privacy-audit | Unwired | Retention lifecycle | none |
| src/admin-experience | Unwired | Admin authorization shell | src/import-migration |
| supabase/migrations | Applied by `npm run db:migrate` (2026-10-27; audit files re-verified 2026-11-02) | 40 forward-only SQL files: schema, RLS, named audited functions, audit log | PostgreSQL 17, Supabase `auth` schema, `scripts/db/runner.ts` |
| tests/database | Verification (2026-10-27) | Real-stack database tests and their helpers | supabase/migrations, scripts/db, local Supabase stack |
| tests | Verification | Unit, integration, coverage, browser layers | all |
| scripts | Tooling | Config validation, toolchain, smoke, local verification, database tooling | node, Supabase CLI stack |
| verification | Tooling data | Manifests and runbooks | scripts |

## Styled components and style hooks (2026-11-04, after 251c4b3)

What a visual restyle changes, by flow named in the intent. "Hooks" are the class names the stylesheet defines (all in `app/globals.css`) and the stable test ids and roles the browser specs use. Components marked (src) live in `src/runtime` and were skimmed, not deeply analyzed.

| Flow in the intent | Components and files | Hooks that carry the look | Hooks the tests rely on |
|---|---|---|---|
| Shared look, fonts | `app/layout.tsx` (root), `app/globals.css` (`:root` tokens, base elements) | 18 custom properties, system font stack on `:root`, `h1` `clamp(2rem, 5vw, 4rem)`, `button` pill, `:focus-visible` ring | outline `none` on `[tabindex="-1"]` focus, ring width >= 3 px, `button` and `.button-link` same look, no overflow at 320 px |
| Shell (every role) | `AppShell` (src), `AppNav` (src), `BrandMark` (src), `SignOutButton`, `shell-action.tsx` | `.app-shell`, `.skip-link`, `.site-header`, `.site-header-brand`, `.eyebrow`, `.profile-summary`, `.navigation-panel`, `.nav-button`, `.secondary-button`, `.brand-link`, `.brand-mark` | `app-shell`, `app-shell-skip-link`, `app-shell-main`, `app-shell-navigation`, `app-shell-navigation-<id>` with `aria-current`, `brand-link`, `sign-out-button`; menu links >= 44 px |
| Sign-in (the "profile selector") | `app/bejelentkezes/page.tsx`, `SignInForm.tsx`; same pattern in the reset and invitation pages; `app/page.tsx` for signed-out visitors | `.centered-panel`, `.parent-public-page`, `.parent-form`, `.identity-form`, `.button-link`, `.skip-link` | `sign-in-page`, `sign-in-form`, `sign-in-email`, `sign-in-password`, `sign-in-submit`, `sign-in-error`, `sign-in-forgot-link`; no overflow or clipped child at 320 and 375 px; heading Y stable when images fail |
| Parent task list, filter, empty state | `feladatok/page.tsx`, `ParentStatePanel`, `StatusBadge` (src) | `.parent-page`, `.parent-filter`, `.filter-field`, `.filter-actions`, `.parent-collection`, `.parent-card`, `.parent-card-link`, `.parent-state-badge`, `.status-badge*`, `.parent-state` | `parent-duties-page`, `duty-filter-form`, `duty-filter-select`, `duty-list`, `duty-card-<id>`, `duty-open-<id>`, `duties-empty`, `duties-filter-empty`; whole-card click; label above control |
| Task details and sign-up confirmation | `feladatok/[id]/page.tsx`, `ParentMutationForm`, `PendingRequestNotice` | `.parent-detail-grid`, `.parent-notice`, `.parent-page-actions`, `.parent-note-panel`, `.parent-form`, `.parent-action-state-<state>`, `.form-hint` | `duty-detail-page`, `duty-detail-back-link`, `signup-form`, `signup-form-submit-button`, `signup-form-state-success`, `duty-full-state`, `swap-request-link`, `cancellation-request-link`, `permitted-allergen-note` |
| Cancel and confirmation | `lemondas/page.tsx`, `ParentMutationForm`, `PendingRequestPanel` | `.parent-form`, `.form-hint`, `.parent-action-state-*`, `.parent-notice`, `.parent-pending-notice` | `cancellation-request-page`, `cancellation-reason-input`, `cancellation-request-form-submit-button`, `cancellation-request-form-state-success`, `cancellation-pending-panel`, `pending-cancellation-notice` |
| Swap request and swap board (near "own commitments") | `csere/page.tsx`, `cserek/page.tsx`, `SwapRequestsBoard` | `.swap-partner-list`, `.swap-request-*`, `.parent-card`, `.secondary-button` | `swap-request-form`, `swap-candidate-<id>`, `swap-reason-input`, `swap-requests-page` |
| "Saját vállalásaim" | no component exists | n/a | n/a (the nearest are the duty list and the swap board) |
| Notifications (parent home) | `ertesitesek/page.tsx`, `NotificationReadForm`, `MarkNotificationRead` | `.notification-card`, `.notification-card-read`, `.notification-read-*`, `.delivery-note`, `.visually-hidden` | `notification-card-<id>`, `notification-link-<id>`, `notification-read-checkbox-<id>`; read card background differs from unread; label box >= 44 x 44 px |
| Teacher schedule | `teacher/schedule/page.tsx`, `ScheduleFilter`, `ScheduleCollection`, `schedule/[id]/page.tsx` | `.teacher-page`, `.teacher-filter`, `.teacher-table*`, `.teacher-card*`, `.teacher-row-link`, `.teacher-card-link`, `.teacher-detail-grid`, `.teacher-state*` | `teacher-schedule-page`, `teacher-schedule-filter-form`, `teacher-schedule-open-<id>`, `teacher-schedule-card-open-<id>` (link >= 44 px), table hidden under 44rem and card list shown |
| Admin approvals | `jovahagyasok/page.tsx`, `[id]/page.tsx`, `AdminFilterBar`, `ResponsiveCollection`, `AdminMutationForm`, `AsyncStatePanel`, `AdminPagination`, `AdminBackLink` | `.admin-page`, `.admin-filter`, `.admin-collection`, `.admin-card`, `.admin-card-link`, `.admin-state-badge`, `.status-badge`, `.admin-detail-grid`, `.admin-form`, `.admin-action-state-*`, `.admin-safe-reason` | `admin-approvals-page`, `admin-approvals-list`, `admin-approvals-list-item-<id>`, `admin-filter-form`, `admin-approval-detail-page`, `admin-approval-decision-form`, `admin-approval-approve-radio`; `.admin-collection li a`, `.status-badge svg[aria-hidden='true']`; link name "Title – State" |
| Admin overview | `admin/page.tsx` (`DashboardPanel`) | `.admin-dashboard-grid`, `.admin-dashboard-panel`, `.dashboard-link` | `admin-dashboard-approvals`, `admin-dashboard-summary`; count equals the pending list length |
| Denied states | `ParentAccessState`, `AdminAccessState`, `TeacherAccessState`, `AccessStateExit`, static page | `.centered-panel`, `.admin-state`, `.teacher-state`, `.secondary-button` | `parent-access-denied`, `admin-denied`, `teacher-denied`, `access-guidance`, `sign-out-button`; heading "Nincs jogosultság" |

## Denied-state and sign-out components (2026-11-02, after 1070fd6)

| Component | File | Kind | Notes |
|---|---|---|---|
| `SignOutButton` | `app/_identity/SignOutButton.tsx` | Client component (`"use client"`), no props | `<form action={signOutAction} data-testid="sign-out-form">` plus submit button `secondary-button`, `data-testid="sign-out-button"`; label "Kijelentkezés", pending text "Kijelentkezés folyamatban…" from `COPY.signOut` (`src/identity/copy.ts`). Import as `import { SignOutButton } from "../../_identity/SignOutButton.tsx";` (relative depth depends on the file). |
| `signOutAction` | `app/_identity/actions.ts` | Server action (`"use server"`) | Ends the session (scope local) via `endSession`, emits `sign_out`, clears cookies with `clearTokenPair`, always `redirect("/bejelentkezes")`; tolerates missing configuration or network errors. No new action is needed. |
| `shellHeaderAction()` | `app/_identity/shell-action.tsx` | Service | Supplies `SignOutButton` as the `AppShell` `headerAction` for the three role layouts. |
| `AccessStateExit` | `app/_identity/AccessStateExit.tsx` | Component (2026-11-04, added by `78a0ab5`) | `explain` prop: shows `p[data-testid="access-guidance"]` with `COPY.noAccess.guidance`, then `SignOutButton`. Used by the parent, admin and teacher access states. |
| `ParentAccessState` | `app/szulo/_components/ParentAccessState.tsx` | Component | Kinds `denied`, `configuration-error`, `signed-out`. Denied markup: `section#hozzaferes-megtagadva` (`tabIndex={-1}`, `data-testid="parent-access-denied"`, class `centered-panel`), single `<h1>Nincs jogosultság</h1>`, paragraph "A kért tartalom nem érhető el ezzel a profillal.", `BackToHomeLink` (`parent-access-home-link`, "Vissza a biztonságos kezdőoldalra"), and (2026-11-04) `AccessStateExit`; the link is omitted when `homePath` starts with `/szulo`. At `1070fd6`: no sign-out. Rendered by `app/szulo/layout.tsx` outside `AppShell`. |
| `AdminAccessState` | `app/admin/_components/AdminAccessState.tsx` | Component | Testids `admin-denied`, `admin-access-state-home-link`; rendered by `app/admin/layout.tsx`; (2026-11-04) renders `AccessStateExit`, link omitted inside `/admin`. |
| `TeacherAccessState` | `app/teacher/_components/TeacherAccessState.tsx` | Component | Testids `teacher-denied`, `teacher-access-home-link`; link goes to `/`; rendered by `app/teacher/layout.tsx`; (2026-11-04) renders `AccessStateExit`. |
| Static denied page | `app/hozzaferes-megtagadva/page.tsx` | Page | `access-denied-state`, `access-denied-home-link`; no inbound redirect found in `app/` or `src/`; only rendered by `tests/coverage/app-entrypoints.test.tsx`. Possibly legacy. |
| `BackToHomeLink` | `src/runtime/BackToHomeLink.tsx` | Component | Link used by the access states; target comes from the denied result's `homePath`, which can equal the current page. |
| `AppShell` | `src/runtime/AppShell.tsx` | Component | Needs a `ShellProfile`; not usable for a denied person. |
| `app/page.tsx` no-role branch | `app/page.tsx` | Page branch | `role="status"` paragraph (`production-no-role`) plus `<SignOutButton />`: the existing "explanation plus sign-out" pattern and nearest copy precedent ("Ehhez a fiókhoz még nem tartozik szerepkör. Kérje az adminisztrátort, hogy hívja meg."). |

## Sign-out per no-access screen (2026-11-06, after 1672d98)

Checked by reading the code at HEAD `1672d98`; nothing executed. "Sign-out" means the `sign-out-button` rendered by `AccessStateExit` or `SignOutButton`.

| Screen (layout or page) | Heading shown | Sign-out button | Guidance (`access-guidance`) | Where |
|---|---|---|---|---|
| Parent area, state `denied` (role without linked parent record, or grant not matching the family) | Nincs jogosultság | yes | yes | `app/szulo/_components/ParentAccessState.tsx` lines 22-44; `AccessStateExit explain={kind === "denied"}` at line 42 |
| Parent area, state `configuration-error` | Nincs jogosultság | yes | no | same file, line 42 |
| Parent area, state `signed-out` | Bejelentkezés szükséges | no (sign-in link `parent-login-link`) | no | same file, lines 11-21 |
| Admin area, state `denied` | Nincs jogosultság | yes | yes | `app/admin/_components/AdminAccessState.tsx` line 39, `explain={isDenied}` |
| Admin area, state `configuration-error` | Az adminisztráció nem érhető el | yes | no | same file, line 39 |
| Teacher area, state `denied` | Nincs jogosultság | yes | yes | `app/teacher/_components/TeacherAccessState.tsx` line 24 |
| Teacher area, state `configuration-error` | Nincs jogosultság | yes | no | same file, line 24 |
| Teacher area, state `signed-out` | Bejelentkezés szükséges | no | no | the layout redirects to `/` first (`app/teacher/layout.tsx` line 12) and the admin layout does the same (`app/admin/layout.tsx` line 12) |
| Static page `/hozzaferes-megtagadva` | Nincs jogosultság | no | no | `app/hozzaferes-megtagadva/page.tsx` lines 4-15; no inbound redirect found |
| Home `/`, account with no role | Biztonságos bejelentkezés (the "Nincs jogosultság" heading is not used here) | yes | yes, text "Ehhez a fiókhoz még nem tartozik szerepkör. Kérje az adminisztrátort, hogy hívja meg." | `app/page.tsx` lines 31-38 |

Facts behind the table:
- The guidance sentence is `COPY.noAccess.guidance` (`src/identity/copy.ts` lines 25-28). The button label is `COPY.signOut` (lines 21-24). `AccessStateExit` (`app/_identity/AccessStateExit.tsx` lines 8-15) is the single source for the denied-state exit.
- A signed-in account with a role but no linked parent record: `resolveParentAccess` returns `denied` (`src/runtime/production/access.ts` line 111). Its home is the parent home (`homeOf`, lines 59-64), so `/` redirects there (`app/page.tsx` line 17) and the parent area shows the denied screen with sign-out. The home link is hidden because its target is inside `/szulo` (`ParentAccessState.tsx` line 35).
- A signed-in account with no grant at all: the parent, admin and teacher areas show their denied screen with sign-out and a home link to `/` (no `homePath`). `/` then shows the no-role panel with sign-out. No loop.
- Expired access token on a page render: `currentSession` reads with `canPersist: false` (`src/identity/session.ts` line 49), so the request counts as signed out and the area shows the signed-out state, without sign-out, until an action refreshes the cookies.
- Sign-out itself is `signOutAction` (`app/_identity/actions.ts` lines 14-28); it always ends at `/bejelentkezes`, also when the sign-in service cannot be reached.

Ownership: the three access-state components are owned by their role areas (`app/szulo/`, `app/admin/`, `app/teacher/`); `SignOutButton`, `AccessStateExit` and `signOutAction` are owned by `app/_identity/`. Session handling is outside both (`src/identity`, `proxy.ts`).

## Component details

### app
Analyzed 2026-11-04 for the restyle: `app/globals.css` (all), `app/layout.tsx`, the pages and components of the parent area (list, detail, swap, cancellation, notifications, swap board, state panels, mutation form), the sign-in page and form, `app/page.tsx`, `app/_identity` UI files, the teacher schedule files, the admin dashboard, approvals list and detail, `ResponsiveCollection` and the head of `AdminMutationForm`; other admin pages and the reset and invitation pages by class-name grep only. Earlier: analyzed 2026-11-02 for the sign-in area (`bejelentkezes`, `page.tsx`, `_identity`) and re-read for the denied pages (layouts and access-state components of `szulo`, `teacher`, `admin`, `hozzaferes-megtagadva`; see the section above). Next.js route tree (see `code-structure.md`, "app/ file map for the restyle" and "Sign-in and shell files"). `app/_identity` holds the session and home resolvers, sign-out action and button, the denied-state exit (`AccessStateExit`) and shell header control. Layouts gate admin and teacher by `redirect("/")`, parent by an access panel; all three render their access state outside `AppShell`. `/bejelentkezes` sits outside every role layout and therefore has no shell. After `1070fd6` `signInAction` redirects to `/`; at `251c4b3` the sign-in page redirects a signed-in visitor to `/`.
- Styling (2026-11-04): one stylesheet, no CSS modules or font loader. The root layout is `<html lang="hu"><body>` with no font class. 99 tracked files, 29 pages, 5 layouts, about 8,400 lines in total of which `globals.css` is 1,418.

### src/application
Facades (`parent`, `teacher`, `admin`, `session`), `FacadePipeline`, `AuthorizationContract`, in-memory versions, idempotency store and journal; ports listed in `code-structure.md` (2026-10-12). Not re-read in this run; the handoff notes that `src/application/results.ts` and `facade-pipeline.ts` carry `focusTarget: "#hozzaferes-megtagadva"`.

### src/runtime
Analyzed 2026-11-02 and re-read for role access resolution. `validateRuntimeConfig`, `composeRuntime` (always production), `production/composition.ts` (cached database client per URL, schema and key), `production/services.ts` (`forRequest(accessToken)` facades), `production/access.ts` (parent, admin, teacher access resolvers, `HOME`, `HOME_ORDER`, `deniedFor`; returns the `denied` result with the strongest role's `homePath`; `resolveParentAccess` is `denied` for a parent role without a linked `parents` record or with a grant scope not matching the record's family), `navigation.ts` (four menu lists), `shell-profile.ts`, `AppShell.tsx` (menu only when the list is non-empty), `AppNav.tsx` (client; marks the current item by path, keeps "Értesítések" current for a task opened from a notification), `BrandMark`, `BackToHomeLink`, `StatusBadge`, `FilterClearLink`, `RuntimeConfigurationError`, hyphenation. The synthetic composition, profiles and cookie of 2026-10-12 are gone.
- Role shells: parent (menu of 3), teacher (menu of none by design; page `/teacher/schedule`), group admin (5), super admin (9).
- Skimmed 2026-11-04 for style hooks (not in the verified set): `AppShell` (`.app-shell`, `.skip-link`, `.site-header`, `.eyebrow`, `.profile-summary`), `AppNav` (`.navigation-panel`, a `<details open>` with a "Navigáció" summary shown under 44rem; `.nav-button`, `aria-current="page"`), `BrandMark` (`next/image` of `/brand/logo.png`, `.brand-mark`, `.brand-link`, brand name "Cinkotai Waldorf Óvoda"), `StatusBadge` (decorative inline SVG with tones positive, negative, pending, neutral; `.status-badge`, `.status-badge-icon-<tone>`).

### proxy.ts
Analyzed 2026-11-04 (all 77 lines re-read) and 2026-11-02. Request proxy: CSP with per-request nonce and `form-action 'self'`; when a `wb_refresh` cookie exists it calls `decideRefresh` and renews or clears the token cookies on both the request (so the page sees the new tokens) and the response. Signed-out requests take the synchronous path. No role routing. The CSP directives that matter for fonts and styles: `font-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: data:`; the matcher excludes `_next/static`, `_next/image`, `api`, `favicon.ico`, `sitemap.xml`, `robots.txt` and prefetch requests.

### src/identity
Analyzed 2026-11-02 (sign-in head, cookies and copy read; the rest listed). Modules: `sign-in.ts` (generic failure, lockout, hourly housekeeping), `session.ts` (`resolveSession`, `endSession`), `cookies.ts` (`clearTokenPair`, `writeTokenPair`), `refresh.ts`, `service.ts` and `admin-client.ts` (sign-in service and admin access), `accounts.ts`, `invitations.ts`, `reset.ts`, `password.ts`, `crypto.ts`, `events.ts`, `mail.ts`, `form-state.ts`, `copy.ts` (Hungarian texts, including `signIn.signedInHeading`, `COPY.signOut` and, since `78a0ab5`, `COPY.noAccess.guidance`), `runtime.ts` (`getIdentityRuntime`), each with a colocated test. Copy for identity features lives in `COPY`; role pages mostly keep their Hungarian strings inline.

### tests/integration
Analyzed 2026-11-02 (28 files listed; sign-in related parts read). Tests that pin the sign-in landing: `identity-actions.test.ts`, `identity-screens.test.tsx` (including `describe("SignOutButton (BR2.8)")`), `production-home.test.tsx` (home resolution, `/` redirect, no-role with sign-out), `identity-proxy.test.ts`, `runtime-shell.test.tsx`, `app-nav.test.tsx`. For the denied pages: `parent-components.test.tsx` (`ParentAccessState` block) and `admin-components.test.tsx` (`AdminAccessState` block) (handoff, 2026-11-02, after 1070fd6). Note: after `1070fd6` the sign-in redirect expectation in `identity-actions.test.ts` is expected to read `/`; not re-read in this run. (2026-11-04: by grep, `app-nav.test.tsx`, `admin-components.test.tsx`, `status-badge.test.tsx`, `filter-clear-link.test.tsx` and `tests/coverage/admin-functional-fixes.test.tsx` use class or `className` assertions, so a class rename also reaches the Vitest layer; not opened.)

### tests/coverage and tests/support
Mentioned from the handoff (2026-11-02): `tests/coverage/app-entrypoints.test.tsx` renders the static denied page; `tests/coverage/parent-pages.test.tsx` ("renders role layout, denial and configuration error") renders `app/szulo/layout.tsx` with `requestWorld.signIn("teacher")`; `tests/support/request-world.ts` offers `requestWorld.signIn(role)`, `requestWorld.access.parent.grants = []` and `requestWorld.access.parent.parent` (set `undefined` to model "role but no linked record"). The request is mocked with `vi.mock("../../app/_identity/production-request.ts", async () => (await import("../support/request-world.ts")).requestWorldModule())`. Not re-read in this store beyond the handoff.

### tests/browser
Analyzed 2026-11-04 (support modules in full; `visual-overhaul`, `parent-web`, `navigation-polish`, `list-polish` (200-440) and `functional-fixes` (60-160) read; every other spec read by grep for style, size, axe and class assertions) and 2026-11-02 (support, grep for denied-page and axe lines). Playwright with three projects (`playwright.config.ts`: chromium on port 3100, firefox on 3101, mobile-chrome Pixel 7 on 3102, one worker, retries 2 in CI, trace and screenshot on failure); each project starts `npm run start` against its own database schema. Specs: `admin-advanced`, `admin-core`, `directory-coordination`, `functional-fixes`, `identity`, `list-polish`, `navigation-polish`, `notifications-import`, `parent-web`, `runtime-foundation`, `sign-in-timing`, `teacher-web`, `visual-overhaul` (about 120 declared tests, more through loops over roles and widths). `support/seeded-schema.ts`: `bindSeededSchema` (empties and seeds the schema of the browser project in `beforeAll`), `signInAs` (opens `/bejelentkezes`, signs out an existing session, fills the form, clicks `sign-in-submit`, waits for the cookie `wb_access` and a visible `sign-out-button`), `signOut` (sign-out button, waits for `sign-in-form`), `signInAndOpen`, `expectSignedIn`, `SERIOUS` (axe impact filter). `support/scenarios.ts`: `requestCancellation`, `signUpForDecorating`, `addCleaningNotice`, `withOtherPage`. `projects.ts`: chromium `worker_1`, firefox `worker_2`, mobile-chrome `worker_3`, one port offset each; `VERIFY_BROWSER_PROJECTS` narrows a run.
- Appearance-sensitive checks (all assert on computed style or geometry): outline style `none` on a focused heading; outline width >= 3 px on the focused menu item and cards; create links `.button-link` equal to the "Szűrés" button in background, text colour and radius; read notification background differs from unread; 44 px height for menu links, teacher card links and import submit; 44 x 44 px for the notification checkbox label; notification title >= 12 px from the card edge; label above its control and sharing its left edge on 8 forms at 320 and 1280 px; filter controls share one bottom line at 1280 px and stack at 320 px; no horizontal overflow at 320 and 375 px and at zoom 2; the sign-in heading keeps its Y position when `_next/image` requests fail.
- Class hooks used by selectors: `.admin-collection`, `.admin-collection li a`, `.status-badge`, `.status-badge svg[aria-hidden='true']`, `.parent-state-badge`, `.filter-field`, `.filter-actions`, `.teacher-table` (style injected), and `toHaveClass` of `notification-card-read` and `button-link`.
- Axe: `AxeBuilder.analyze()` filtered to serious and critical in about 40 places, so colour contrast is part of the gate; `directory-coordination` and `notifications-import` add the WCAG 2.2 AA tags. Existing specs reach the denied page by `getByRole("heading", { name: "Nincs jogosultság", exact: true })` (`runtime-foundation.spec.ts`, `navigation-polish.spec.ts`, `teacher-web.spec.ts`, `identity.spec.ts`), and after `78a0ab5` `identity.spec.ts` asserts `access-guidance` and signs out from the denied page.

### src/parent-web
`SyntheticParentPort` on `globalThis`, `createSyntheticParentFacade`, `notification-context.ts` (2026-10-12).

### src/admin-core
`SyntheticAdminPort` with fixture records, tasks and approvals (2026-10-12).

### src/admin-advanced
`AdvancedWorkflowStore`, `CompositeAdminPort` (13 routed operations), reset helpers (2026-10-12).

### src/teacher-web
`SyntheticTeacherScheduleAdapter`, `SYNTHETIC_SCHEDULE` (2026-10-12).

### src/teacher-tracking
Tracking model (live) and `TeacherScheduleService` (unwired) (2026-10-12).

### src/access
`AccessService`, `convertLegacyRoles`, in-memory adapters, `SupabaseRouteAdapter`; live pieces `types.ts`, `role-policy.ts`, `session-grants.ts` (2026-10-12).

### src/coordination, src/directory, src/import-migration, src/notifications, src/parent-experience, src/privacy-audit, src/admin-experience
Family B domain services with synchronous ports and in-memory adapters (2026-10-12).

### supabase/migrations
Analyzed 2026-10-27 for the audit area and re-read in full on 2026-11-02 (20261012, 20261013, 20261015, 20261019, 20261044, 20261045); the other 34 files by name. 20261046 (denied-event limit) is known from its header only. Unit map and naming in `code-structure.md`. Not re-read in the `no-access-signout` run.
- **Audit log (U1, 20261012)**: table `audit_events`, append-only trigger `audit_events_refuse_change`, the single writer `platform_audit_write`, actor helpers `platform_system_account`, `platform_caller_is_system`, `platform_actor_account`, `platform_actor_role`.
- **Audited-operation wrapper (U1, 20261013)**: `platform_result`, `platform_idempotency_check`, `platform_idempotency_store`, `platform_finish_operation` (writes the audit event for `success`/`denied`), `platform_cleanup_expired`, the hold functions.
- **Identity changes to the audit area (U2)**: action list widened (20261014:88-95, not re-read), active-session check in `platform_actor_account`, `current_session_is_active`, `identity_*` helpers, `identity_deny` wrapper and audit read policy (20261015), privilege sweep and service-role grant list (20261019). Responsibilities and rights: `architecture.md` "Privilege model".
- **Purge (U5, B1)**: `audit_purge` (365 days, at most 5000 rows per call) and `identity_housekeeping` (20261044, 20261045).
- Responsibility for intent `denied-audit-ratelimit` (done): the per-account limit lives in the new file `20261046_audit_denied_rate_limit.sql`, which redefines `platform_audit_write`; no merged file was changed (runner checksum).
- Depends on: `auth.uid()`, `auth.jwt()`, `auth.sessions`, `auth.users` of the Supabase sign-in service; roles `anon`, `authenticated`, `service_role`.

### tests/database
Analyzed 2026-10-27 and re-read 2026-11-02: `stack-support.ts`, `audit.test.ts`, `audit-purge.test.ts`, `migrations.test.ts`; the other 54 entries (58 at HEAD, including `audit-denied-limit.test.ts` for the new limit) skimmed by name.
- Helpers in `stack-support.ts` (see `code-structure.md` "Database tests"); per-schema advisory locks; `resetWorkerData` from `scripts/db/worker.ts` truncates every table before each test.
- `audit.test.ts`: refused write/insert/update/delete for application roles, admin read policy, actor from the session, system actor, denied event committed with denied result (lines 180-203), rollback on injected failure, `details` format, check lists, indexes, under-50-ms overhead (NFR4.5).
- `stack-support.ts` also fixes the shared identities (`SUPER_ADMIN`, `PARENT`, `OUTSIDER`, `OTHER_ADMIN`, two organizations), gives each test process its own session ids and takes per-schema advisory locks. The stack config these tests run against is `supabase/config.toml` (see `architecture.md`).
- `audit-purge.test.ts`: 365-day boundary, system-caller-only, setting scope, 5000-row cap, security-definer and pinned search path.
- `migrations.test.ts`: applies all files to an empty database and to `worker_4`, second run changes nothing, pinned search path for every function, platform table rights, per-unit and per-follow-up ordering tests, refusal of hard-coded schemas and failing files.
- Run by npm scripts `test:database:stack` (migrations, audit, idempotency, holds, worker), `test:database:seed` (audit-purge, seed, reset, seed-timing) and others, and by `scripts/db/shuffled-tests.ts`; all inside `npm run verify:local` in CI after `npm run db:start`.

### tests
- `src/**/*.test.ts` (node tests), `tests/unit`, `tests/integration`, `tests/coverage` (Vitest), `tests/browser` (Playwright) as of 2026-10-12; `tests/database` above.

### scripts
`validate-runtime-config.ts`, `validate-toolchain.mjs`, `start-smoke.mjs`, `verification/*` (2026-10-12); `db/*` (start, stop, migrate, runner, worker, seed, reset, shuffled tests, first super admin) seen in the 2026-10-27 skim.

### verification
`authorization-matrix.json`, `fixtures.json`, `scenarios.json`, `sensitive-fields.json`, `evidence.schema.json`, `RUNBOOK.md`, `AUTHORIZATION.md` (2026-10-12).
