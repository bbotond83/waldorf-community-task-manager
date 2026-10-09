# Code Summary: Visual overhaul, second round (navigation, lists and notifications)

## Files created and modified

New production files (3, counted by the production inventory, 153 to 156):

- `src/application/status-labels.ts`: `statusLabel(value)` and the Hungarian label table.
- `src/runtime/AppNav.tsx`: client component for the main menu (button-styled links, `aria-current`, collapsible "Navigáció" panel); also exports `currentNavigationId`.
- `src/runtime/BackToHomeLink.tsx`: back link of shell-less denied pages ("Vissza a beosztáshoz" for the teacher).

Modified production files:

- Menu and landing: `src/runtime/synthetic/profiles.ts` (one menu per profile, new `homePath` for parent), `src/application/authorization.ts` (`HOME_PATH_BY_ROLE.parent`), `app/admin/_lib/session.ts` (`withCoreNavigation` removed; denied result carries `homePath`), `app/admin/layout.tsx`, `src/runtime/AppShell.tsx`, `src/runtime/BrandMark.tsx` (optional `href`), `app/page.tsx` (redirect, welcome panel deleted), `app/api/synthetic/session/route.ts` (303 to `profile.homePath`), `app/belepes/actions.ts` and `app/belepes/page.tsx` (default destination Értesítések; a requested `/szulo/...` destination still wins).
- Denied pages: `app/admin/_components/AdminAccessState.tsx`, `app/szulo/_components/ParentAccessState.tsx`, `app/szulo/_lib/session.ts`, `app/szulo/layout.tsx`.
- Whole-card lists: `app/admin/_components/ResponsiveCollection.tsx`, `app/teacher/schedule/_components/ScheduleCollection.tsx`.
- Status words: `app/admin/_components/AdminFilterBar.tsx`, `app/admin/emlekeztetok/page.tsx`, `app/admin/adatvedelem/page.tsx`, the detail pages of nyilvantartasok, archivum, jovahagyasok and feladatok.
- Notifications: `app/szulo/ertesitesek/page.tsx`, `app/szulo/_components/NotificationReadForm.tsx` (rewritten as a checkbox).
- Styles: `app/globals.css` (menu buttons, whole-card list items, notification card layout, no focus box on non-interactive focus targets, reduced-motion, removal of the dead `.home-panel` rules, `.admin-form` grid made shrinkable so the settings select no longer overflows at 320 px).
- Data: `verification/fixtures.json` (parent `home` follows the runtime profile; `tests/unit/current-role-references.test.ts` compares them).
- Docs: `HASZNALATI_UTMUTATO_HU.md` (default pages, one menu, whole-card lists, checkbox; stale "Munkatárs" and "Óvodaadminisztrátor" profile rows corrected).

Not edited: authorization matrix rules, server-side page guards, `app/szulo/actions.ts`, any data, repository or API code.

Tests created: `src/application/status-labels.test.ts`, `tests/unit/navigation-access.test.ts`, `tests/integration/app-nav.test.tsx`, `tests/integration/notification-read-form.test.tsx`, `tests/browser/navigation-polish.spec.ts`.

Tests updated: `tests/integration/{admin-components,runtime-shell,parent-components,teacher-components,synthetic-route}`, `tests/coverage/{app-entrypoints,parent-pages,parent-actions,production-inventory}`, `tests/unit/{current-role-session,runtime-boundaries,design-tokens}`, `tests/browser/{runtime-foundation,visual-overhaul,admin-core,admin-advanced,parent-web,teacher-web,profile-login-performance}.spec.ts`, `tests/browser/support/profile-login-measurement.ts`.

## Key decisions

- **Landing**: the session route redirects (303) to `profile.homePath`; `/` with a session redirects to the same page; `/` without a session, with an expired or unknown session, or in production mode behaves as before. The parent's `homePath` is `/szulo/ertesitesek`; teacher `/teacher/schedule`; both admins `/admin`.
- **One menu**: defined once in `profiles.ts`; group admin 5 items, super admin 9, parent 2, teacher none (the shell renders no `<nav>` and no toggle). The authorization matrix keeps its own internal navigation item for the teacher.
- **aria-current**: set to `page` on the item for the current path, or the longest item address containing it (a detail page keeps its section marked); `/admin` only matches exactly.
- **Logo**: links to the profile's default page for every role (Beosztás for the teacher).
- **Teacher way back**: the detail page already had "Vissza a beosztáshoz". Pages without the shell (admin and parent denied states, which is what a teacher gets) now show "Vissza a beosztáshoz" through `BackToHomeLink`, using a `homePath` that the admin and parent session results carry when a session exists. The teacher's own `TeacherAccessState` is only shown to non-teachers and is unchanged.
- **Whole-card items**: admin items are one `Link` wrapping title and state label (accessible name "Cím Állapot"). Teacher items use a stretched link (title text link with a full-size `::after`): same accessible name (the title) in the table and the card layout, row and cell semantics kept, hidden "Részletek" column header removed. Ring on keyboard focus is drawn on the stretched `::after`.
- **Notifications**: the card is a grid: one whole-content link (`.parent-card-link`, test id `notification-link-<id>`) and the form beside it. The checkbox is uncontrolled (`defaultChecked`), submits through `requestSubmit()` on tick, is disabled and `aria-busy` while pending, reverts and refocuses on failure, shows an alert (`role="alert"`) with the action's Hungarian message, and a validation result is shown as "Jelölje be a négyzetet, hogy az értesítés olvasott legyen." (this is also what the no-JavaScript "Mentés" button shows when the box is unticked: nothing is marked). Accessible name: "Olvasottnak jelölöm" plus the title. The old "Kapcsolódó feladat" result link is dropped: it would be a second link in the card (FR1.5) and the whole card already opens the same target.
- **Focus**: `[tabindex="-1"]:focus` and `:focus-visible` have `outline: none` (headings, main, state panels); all controls keep the global 3 px ring. `autoFocus` stays; the parent notifications heading gained `autoFocus` so the landing page keeps the screen-reader focus move.
- **Login measurement helper**: no welcome page, so `measureProfileLogin` now asserts the default page directly; `permittedNavigationIds` reads the one menu; `greetingName` removed.

### Status label table (`src/application/status-labels.ts`)

| Value | Label | Value | Label |
|---|---|---|---|
| pending | Függőben | retrying | Újrapróbálás folyamatban |
| approved | Jóváhagyva | retry-scheduled | Újrapróbálás ütemezve |
| rejected | Elutasítva | stale | Elavult |
| active | Aktív | cancelled | Törölve |
| archived | Archivált | terminal | Végleges hiba |
| open | Nyitott | eligible-delete | Törölhető |
| scheduled | Ütemezve | eligible-anonymize | Anonimizálható |
| assigned | Kiosztva | blocked | Blokkolt |
| notes-saved | Jegyzet mentve | selected | Kiválasztva |
| queued | Sorban áll | validated | Ellenőrizve |
| sent | Elküldve | preview | Előnézet |
| retryable | Újrapróbálható | conflicts | Ütközések |
| confirmed | Megerősítve | committed | Végrehajtva |
| rolled-back | Visszavonva | interrupted | Megszakadt |
| recovered | Helyreállítva | available | Szabad |
| full | Betelt | ineligible | Nem vállalható |
| swap-pending | Csere függőben | cancellation-pending | Lemondás függőben |

Any other value shows "Ismeretlen állapot". Filter option values (`active`, `archived`, `open`, `pending`, reminders `retryable|sent|stale`) are unchanged; only their labels come from the same table. Teacher status text (`currentStatusLabel`) and the parent duty labels were already Hungarian and are untouched.

### Menu button colours and contrast (tokens only, no new hex)

| State | Text | Background | Border | Contrast (checked in `tests/unit/design-tokens.test.ts`) |
|---|---|---|---|---|
| default | `--color-primary-dark` | `--color-surface` | `--color-border-strong` | text 4.5:1 or more, border 3:1 or more |
| hover | `--color-primary-dark` | `--color-info-bg` | `--color-primary` | text 4.5:1 or more, border 3:1 or more |
| pressed | `--color-primary-dark` | `--color-danger-bg` | `--color-primary` | text 4.5:1 or more |
| current page | white | `--color-primary` | `--color-primary-dark` | text 4.5:1 or more |

Buttons are 44 px or taller (checked in the browser spec), hover and press movement is removed under `prefers-reduced-motion`.

## Test results

Baseline (Step 2, before any edit): `node --experimental-strip-types --test src/runtime/*.test.ts` 4 passed; Vitest on the 7 named files 109 passed (7 files).

Final runs (Node 24, npm 11):

- `npm run lint`, `npm run format:check`, `npm run typecheck`: clean.
- `npm test`: domain 232 passed; delivery 430 passed in 36 files.
- `npm run test:coverage`: domain 232 passed, all files 95.23 / 87.83 / 93.31 (lines / branches / functions); delivery 662 passed in 66 files, all files 92.55 / 84.49 / 94.02 (statements / branches / functions). The 80% floors were not touched.
- `npm run build`: passes. `npm run smoke:start`: `SMOKE_START_OK`.
- Playwright (chromium and mobile-chrome) on `navigation-polish`, `runtime-foundation`, `visual-overhaul`, `parent-web`, `teacher-web`, `admin-core`, `admin-advanced`: 139 passed, 1 skipped (the desktop-only keyboard ring test on mobile-chrome).
- `npx playwright test --grep @a11y --project=chromium`: 10 passed, including the four new default pages.
- `npm run verify:security`: privacy, secrets, SAST and no-deploy scans pass; `npm audit` found 0 vulnerabilities.

Not run: the Firefox project, `tests/browser/profile-login-existing.spec.ts` and `profile-login-performance.spec.ts` (separate configs that start their own servers or need the dev server on port 3000; their helper `profile-login-measurement.ts` and the performance spec were updated for the new landing but not executed), `npm run verify:local`, the real-integration checks that stay outstanding as before.

## Deviations from the plan

- Added `src/runtime/BackToHomeLink.tsx` (and `homePath` on the admin and parent denied session results) to give the teacher a way back from the shell-less denied pages; the plan named "the teacher denied page" without a file.
- `verification/fixtures.json` changed (parent `home`): required because a unit test compares it with the runtime profile; not named in the plan.
- `app/globals.css` also got a small fix for a horizontal overflow at 320 px on `/admin/beallitasok` (the `.admin-form` grid column let a long `select` widen the page), found by the new 320 px check; it is a menu-bearing page of the super admin.
- The real sign-in link text changed from "Tovább a feladatokhoz" to "Tovább az alkalmazásba" because the destination is now Értesítések by default. The invitation-acceptance destination (`/szulo/feladatok`) was left as it is: it is not the sign-in page.
- Notification "Kapcsolódó feladat" result link removed (see decisions).
- `tests/coverage/production-inventory.test.ts` was reformatted by Prettier along with the count change (153 to 156).

## Notes

- The synthetic parent state is a module-level store, so the `/api/synthetic/reset` route does not reset it inside a running production server; the new notification browser test therefore reads `notice-24-hour`, which no other spec uses, while the parent spec keeps the per-browser `7-day` notices.
- Tick-before-hydration: the checkbox submits through the hydrated form; the browser specs wait for `networkidle` before ticking. Without JavaScript the `<noscript>` "Mentés" button is the path.
- The detail pages' heading `autoFocus` does not take focus after a client-side navigation from a list; this predates the change and no requirement covers it.

## Revision R-01 (Step 16)

- `NotificationReadForm` moves keyboard focus to the notification card link (`notification-link-<id>`, found through the shared `li`) after the read state is saved; the box stays ticked and disabled. The failure path still refocuses the unticked box.
- Tests: component test added in `tests/integration/notification-read-form.test.tsx` (11 tests); focus assertion added in `tests/browser/navigation-polish.spec.ts`. Rerun: Vitest 36 files / 431 tests pass, Node runner 232 pass, lint, format check, typecheck and build clean, Playwright navigation-polish and parent-web on chromium and mobile-chrome 65 pass (1 skipped), @a11y on chromium 10 pass. `traceability.json` unchanged.
