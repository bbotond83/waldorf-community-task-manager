## Developer Code Scan Results

Focused scan for intent `261009-functional-test-fixes` (bugfix, Minimal, brownfield) at commit f51c844. The shared CodeKB (analyzed at a031222) predates the navigation-polish merge, so facts below that differ from it are marked "changed".

### Scan Coverage
- **Analyzed deeply**:
  - app/szulo/ertesitesek/page.tsx
  - app/szulo/_components/NotificationReadForm.tsx
  - app/szulo/actions.ts
  - app/szulo/layout.tsx
  - app/szulo/feladatok/page.tsx
  - app/szulo/feladatok/[id]/page.tsx
  - app/szulo/feladatok/[id]/csere/page.tsx
  - app/szulo/feladatok/[id]/lemondas/page.tsx
  - app/admin/layout.tsx, app/admin/_lib/session.ts
  - app/admin/_components/ (ResponsiveCollection, AdminFilterBar, AdminMutationForm, AsyncStatePanel)
  - app/admin/actions.ts
  - app/admin/nyilvantartasok/ (list, uj, [id]), app/admin/feladatok/ (list, uj, [id]), app/admin/archivum/page.tsx, app/admin/jovahagyasok/[id]/page.tsx, app/admin/emlekeztetok/page.tsx, app/admin/adatvedelem/page.tsx
  - src/runtime/AppNav.tsx, src/runtime/BackToHomeLink.tsx, src/runtime/synthetic/profiles.ts
  - src/application/status-labels.ts
  - tests/unit/navigation-access.test.ts, tests/integration/app-nav.test.tsx, tests/integration/runtime-shell.test.tsx, tests/integration/notification-read-form.test.tsx, tests/browser/parent-web.spec.ts, tests/browser/navigation-polish.spec.ts (targeted greps and reads)
  - verification/fixtures.json
- **Skimmed only** (outside or at the edge of the snapshot paths, read for evidence but not claimed as analyzed): src/parent-web/synthetic-parent.ts (duty/notification fixtures, request state), src/admin-core/synthetic-admin.ts (admin item states), src/admin-advanced/synthetic-advanced.ts (correlation ids), the other admin pages (jovahagyasok list, beallitasok, import), app/teacher/, tests/coverage/*, tests/integration/admin-components, parent-components, remaining browser specs, scripts/, supabase/, package.json and CI files.
- **Left out**: node_modules, .next, build and coverage output, caches, AI-DLC install (.claude/, aidlc/ workspace, .github aidlc files).

### Packages Found
- waldorf-community-task-manager — single Next.js 16 app (app router) — TypeScript — delivery layer in app/, composition and shell in src/runtime, facades in src/application, domain modules under src/*.

### Build System
- **Type**: npm scripts, Next.js build, node strip-types for src tests
- **Config Files**: package.json, next.config.ts, vitest.config.ts, playwright.config.ts
- **Build Dependencies**: app -> src/runtime, src/application, domain modules

### APIs Discovered
- Server actions: app/szulo/actions.ts (signUp, requestSwap, requestCancellation, markNotificationRead, updateContribution); app/admin/actions.ts (saveRecord, archive/restore, saveTask, assign, decideApproval, saveEventNotes) and advanced-actions.ts.
- Route handlers: /api/synthetic/session, /api/synthetic/reset, /api/readiness, munkatars/beosztas.

### Frameworks & Libraries
- next 16.4.0, react latest, zod latest, Vitest 4.1.11 + Testing Library, Playwright + axe.

### Test Coverage
- **Test Directories**: tests/unit, tests/integration, tests/coverage, tests/browser, tests/database, colocated src tests
- **Test Frameworks**: Vitest (jsdom), node:test, Playwright (chromium, firefox, mobile-chrome)
- **Coverage Config**: present, 80 percent line/branch/function

### Code Quality Indicators
- **Linting**: ESLint (max-warnings 0) and Prettier, blocking
- **CI/CD**: .github/workflows/ci.yml (not re-read this run)
- **Documentation**: JSDoc on shell and navigation helpers; page files undocumented

### Technical Debt Signals
- Parent duty page keeps its own `STATE_LABELS` (app/szulo/feladatok/page.tsx:5-12) differing from the shared `STATUS_LABELS` in src/application/status-labels.ts (e.g. "Jelentkezésre nyitott" vs "Szabad", "Nem jogosult" vs "Nem vállalható", "Vállalt feladat" vs "Kiosztva").
- AdminFilterBar offers a fixed four-value state select (active, archived, open, pending) for every list (app/admin/_components/AdminFilterBar.tsx:24-27); lists have different real value sets (tasks: open/scheduled/assigned; approvals: pending/approved/rejected; records: active/archived).
- No back-navigation affordance exists on admin pages (no "Vissza" link anywhere under app/admin; the only back links are the three parent ones and access-denied states).

## Handoff Summary
- **Intent-relevant finding**: Detailed observations per focus area (no fixes proposed):

1. **Parent notifications** (app/szulo/ertesitesek/page.tsx).
   - The page renders `ul.parent-collection > li.parent-card.notification-card`, each with one whole-card `a.parent-card-link` (`href={notification.link}`, testid `notification-link-<id>`) containing title, `TIMING_LABEL`, `PROVIDER_LABEL` and `<strong>` "Olvasott"/"Olvasatlan" (:54), followed by a sibling `NotificationReadForm`. The read text is rendered from the server-fetched `notification.isRead` only; the form's local success state does not change it, and the form never calls `router.refresh`.
   - `markNotificationReadAction` (app/szulo/actions.ts:70-92) calls the facade, returns `{...success, link}`; it does not `revalidatePath` (unlike the duty actions that call `revalidateParentDuty`). The page is under `dynamic = "force-dynamic"` layout, but a client-side navigation back to the page may still show cached router data.
   - `NotificationReadForm` (client): checkbox `name="id"` with `defaultChecked={done}`, `disabled={done || isPending}`; `onChange` calls `form.requestSubmit()` when ticked; effects reset on failure and move focus to the card link on success. `done = isRead || state.state === "success"`.
   - Link target: fixtures in src/parent-web/synthetic-parent.ts:108-148 hard-code `link: "/szulo/feladatok/<dutyId>"` (notice-7-day, -firefox, -mobile, notice-24-hour; notice-stale links back to /szulo/ertesitesek). `markNotificationRead` (:293-300) sets `isRead: true` in the in-memory map and returns `{link}`; there is no read-on-open path, so opening a card's link does not mark the notification read.
   - Mark-read state source: `state.notifications` Map in `synthetic-parent.ts`, reset by `resetSyntheticParentState` (called by /api/synthetic/reset).
2. **Menu and current item**.
   - `AppNav` (src/runtime/AppNav.tsx, client) uses `usePathname` and `currentNavigationId`: exact href match, else longest item href that is a path prefix (excluding "/admin"). `aria-current="page"` set on the match. For parent items, `/szulo/feladatok/duty-assigned` resolves to "Feladatok" even when the user arrived from Értesítések (no `from` signal), which is where a "current item" mismatch can arise.
   - `parentNavigation` (src/runtime/synthetic/profiles.ts:25-28) order today: parent-duties "Feladatok", parent-notifications "Értesítések". Parent `homePath` is `/szulo/ertesitesek` (:62) while the menu starts with Feladatok (changed since the stored KB: default page is now Értesítések). Teacher has an empty menu; group admin 5 items; super admin 9 items; one list per profile, no request-time rewrite any more (changed: `withCoreNavigation` is gone from app/admin/_lib/session.ts).
   - Order assertions: tests/integration/runtime-shell.test.tsx (:49-100, compares link text to `profile.navigation` labels, so reordering does not break that test but explicit link lookups do), tests/unit/runtime-boundaries.test.ts:34-35 (lists "parent-duties","parent-notifications" ids in that order), tests/unit/navigation-access.test.ts (hrefs unique/allowed; no order check), tests/browser/support/profile-login-measurement.ts (:25, :45, :155 clicks `app-shell-navigation-parent-duties`), tests/browser/navigation-polish.spec.ts (parent flows from :175), src/application/authorization.ts matrix row `navigation: {id:"parent-duties"...}` (:50, not consumed by AppShell).
   - `BackToHomeLink` (src/runtime/BackToHomeLink.tsx) renders a Link to `homePath ?? "/"`; the teacher variant relabels to "Vissza a beosztáshoz". It is only used by denied/error states (ParentAccessState, AdminAccessState), not by the parent task detail page.
   - "Vissza a feladatokhoz": app/szulo/feladatok/[id]/page.tsx:29-31, plain `<a href={backHref}>` (testid `duty-detail-back-link`) with `backHref = /szulo/feladatok[?allapot=…]`; always points to the duties list regardless of where the user came from (a notification arriving here lands on a link that says "feladatokhoz").
3. **Admin area**.
   - Lists: nyilvantartasok and feladatok use `AdminFilterBar` (GET `q`, `state`) + `AsyncStatePanel` + `ResponsiveCollection` + `AdminPagination`; archivum shows `listRecords({state:"archived"})`; jovahagyasok is analogous. `ResponsiveCollection` renders a whole-card `Link` with title and `statusLabel(item.state)` badge (changed: no "Részletek" link any more).
   - Status values reach lists from `AdminItemModel.state` in src/admin-core/synthetic-admin.ts: records active/archived; tasks/events open/scheduled (assigned/notes-saved only as action results); approvals pending/approved. The filter select is fixed (Minden állapot, Aktív, Archivált, Nyitott, Függőben) on every list page including feladatok (where "Ütemezve" can never be selected) and jovahagyasok (where "Jóváhagyva" cannot); synthetic repo matches `item.state === state`. Asserted by tests/browser/navigation-polish.spec.ts:160-171 (exact option texts).
   - `statusLabel` (src/application/status-labels.ts) is the shared Hungarian label source (34 values, unknown -> "Ismeretlen állapot"); used by lists, detail pages, reminders (`job.status`), privacy lifecycle (`candidate.eligibility`).
   - Detail pages: feladatok/[id] finds the item through `listTasks`, shows `h2` title, "Állapot: <label>", "Verzió: {task.version}" (:51-52 of that page), an edit form, an assignment form with the "Kapacitási helyzet" scenario select (`admin-assignment-scenario-select`: eligible, ineligible, full, retryable, terminal; default from `?scenario=`) (:91-103), and for scheduled events a notes form. nyilvantartasok/[id] shows "Állapot" and "Verzió: {record.version}" plus edit and archive forms. jovahagyasok/[id] carries a hidden `scenario` input fed by `?scenario=`; adatvedelem items have a "Forgatókönyv" select (success, retryable, terminal). These scenario controls exist to drive Playwright and unit scenarios.
   - New forms: nyilvantartasok/uj posts `saveRecordAction` (hidden id="new", expectedVersion=1, `idempotencyKey = record:create:<randomUUID()>` generated during server render, `kind` select family/child/group/school-year, `title` required max 120); feladatok/uj posts `saveTaskAction` (`kind` task/event, `title`). Both wrap `AdminMutationForm` (useActionState; summary region focus on non-success; success shows only the `state.message` status, no redirect, no link back, no form reset). Validation: `normalizeRequiredText(title, 120)` in app/admin/actions.ts, `parseMutationContext`; revalidatePath("/admin/nyilvantartasok") / "/admin/feladatok". A repeat press re-submits the same idempotency key (key is fixed per page render) so a second create returns the replayed result instead of a duplicate (not verified end to end).
   - A back link could live in the page `header` of each admin sub-page (no shared page-header component exists; each page repeats `<header><p className="eyebrow">…`) or in a shared component under app/admin/_components/; `AppShell` renders children inside `main#fo-tartalom` (src/runtime/AppShell.tsx, not re-read this run).
4. **Parent swap/cancel**.
   - Pages csere/ and lemondas/ fetch `getDuty`, show a back link "Vissza a feladathoz" (`swap-back-link`, `cancellation-back-link`) and, when `duty.assignmentId` exists, a `ParentMutationForm` with required protected reason textarea; `?scenario=` drives conflict/retryable/terminal outcomes (hidden counterpartId / assignmentId suffix).
   - Pending state: `createRequest` (synthetic-parent.ts:316-352) sets the duty state to "swap-pending" or "cancellation-pending" and bumps version; `assignmentId` remains. The detail page (app/szulo/feladatok/[id]/page.tsx) shows the "Feladatműveletek" links (swap/cancel) whenever `duty.assignmentId` is truthy, regardless of `duty.state`, so pending duties still offer both request links and show no pending notice; submitting again returns `REQUEST_DUPLICATE` conflict (id `<kind>-request-<dutyId>`; a swap and a cancellation use separate ids, so both can be pending at once). The list shows pending via parent `STATE_LABELS` ("Cserekérelem folyamatban", "Lemondási kérelem folyamatban"); the detail page does not render the state at all.
   - Actions: `requestSwapAction`/`requestCancellationAction` call `revalidateParentDuty(id)` on success.
5. **Demo/fixture data**.
   - Entries "– Firefox próba" / "– mobil próba" exist as per-browser-project copies: duties duty-garden-firefox/-mobile, duty-assigned-firefox/-mobile (synthetic-parent.ts:33-105) and notifications notice-7-day-firefox/-mobile (:118-134). They are used by tests/browser/parent-web.spec.ts through `projectSuffix` (lines 4-8, 57, 83, 94, 109-111): Playwright runs chromium, firefox and mobile-chrome against one shared in-memory server, so each project mutates its own duty. Removing them from the demo data requires a different isolation scheme (e.g. reset per test, or tests seed/rename); they are visible to a real parent user as shown in the functional test.
   - "Korreláció" row on app/admin/emlekeztetok/page.tsx:~60-64 prints `job.correlationId` ("corr-lampas-01", "corr-kert-01", "corr-regi-01" in src/admin-advanced/synthetic-advanced.ts:54-74); asserted by tests/browser/admin-advanced.spec.ts:79 and used by the retry form's hidden `correlationId` (the value is also needed by `retryReminderAction`).
   - "Verzió: N" is visible on feladatok/[id] and nyilvantartasok/[id] (also feeds hidden `expectedVersion`); scenario selectors: feladatok/[id] (Kapacitási helyzet), jovahagyasok/[id] (hidden), adatvedelem (Forgatókönyv), parent csere/lemondas `?scenario=`.
   - verification/fixtures.json lists profiles, homes (parent home "/szulo/ertesitesek"), states; the fixture family ids differ from runtime ones (family-fenyo vs family-boroka), so it is documentation data, not the runtime source.
6. **Existing tests to update**: tests/browser/parent-web.spec.ts (notification link and read flow :104-140, suffix helpers), tests/browser/navigation-polish.spec.ts (:160-171 filter option texts, :175-210 notification card and checkbox), tests/browser/admin-core.spec.ts and admin-advanced.spec.ts (admin lists, forms, "Verzió"/"Korreláció" text), tests/integration/notification-read-form.test.tsx, tests/integration/app-nav.test.tsx (BackToHomeLink, currentNavigationId), tests/integration/runtime-shell.test.tsx, tests/integration/admin-components.test.tsx, parent-components.test.tsx, tests/unit/navigation-access.test.ts, runtime-boundaries.test.ts, tests/coverage/parent-pages.test.tsx (:182-190 notifications), parent-actions.test.ts, admin-pages.test.tsx, admin-actions.test.ts, admin-dashboard.test.tsx, app-entrypoints.test.tsx, src/application/status-labels.test.ts.
- **Risks / follow-up**:
  - Playwright projects share one server state, so any change to demo data or read state must keep per-project isolation (suffix fixtures) or add reset-per-test.
  - Reordering parent menu changes `parent-duties`/`parent-notifications` order that `runtime-boundaries.test.ts:34-35` asserts, and `homePath` already differs from the first menu item.
  - Notification read state is a pure in-memory flag; the page's "Olvasott/Olvasatlan" text only updates after a server refresh, and `markNotificationReadAction` does not revalidate.
  - Parent and admin state wording come from two separate label maps.
  - New-record/task forms never return to the list after success and have no back link.
  - The prior stored CodeKB navigation and `withCoreNavigation` descriptions are obsolete at HEAD; this run's synthesis corrects them.
  - Coverage (80 percent) and ESLint scope (app, src/application, src/runtime, tests, scripts) apply to all of the above.
