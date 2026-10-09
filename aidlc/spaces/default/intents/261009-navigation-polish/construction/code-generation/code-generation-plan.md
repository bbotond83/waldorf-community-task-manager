# Code Generation Plan: Visual overhaul, second round (navigation, lists and notifications)

## Summary

- Builds: one consistent menu per profile shown as buttons, a default landing page per profile (no welcome page, no teacher menu), whole-card list items for every role, Hungarian status words, and a redesigned notification card with a "read" checkbox.
- Touches: `src/runtime/` (`AppShell.tsx`, `ProfileSelector` unchanged, `synthetic/profiles.ts`, new `AppNav.tsx`, new `status-labels.ts` under `src/application/`), `app/page.tsx`, `app/api/synthetic/session/route.ts`, `app/admin/_lib/session.ts`, `app/admin/_components/ResponsiveCollection.tsx`, the admin pages that show states, `app/teacher/` lists and denied page, `app/szulo/ertesitesek/page.tsx` and `NotificationReadForm.tsx`, `app/belepes/actions.ts`, `app/globals.css`, about 14 existing tests and the user guide.
- Tests: about 5 new test files plus updates to about 14 existing ones (unit, component, page-render and Playwright browser tests).

## Scope and Blast Radius

Zero-Unit work (bugfix scope, no Unit DAG). Source: `requirements.md` (FR1 to FR7, NFR1 to NFR6, with the review points folded in). No business rules, access rules (authorization matrix, server-side page guards), data model, API or database code change. Applicable testable layer: Frontend behavior only (plus two small pure helpers). The data model, repository and API layers are not touched and have no steps.

| File or group | Consumers / tests | Impact |
|---|---|---|
| `src/runtime/synthetic/profiles.ts` (navigation lists, `homePath`) | `AppShell`, `app/page.tsx`, session route, `tests/unit/current-role-session.test.ts`, `runtime-boundaries.test.ts`, profile-login specs (`app-shell-navigation-<id>` counts) | high: the single source of menus and landing pages |
| `app/admin/_lib/session.ts` (`withCoreNavigation`) and `app/admin/layout.tsx` | every admin page | high: the request-time menu rewrite is removed |
| `src/application/authorization.ts` (`HOME_PATH_BY_ROLE`) | session facade, authorization tests | low: only the parent home path value changes |
| `src/runtime/AppShell.tsx`, new `AppNav.tsx` | 3 layouts, `runtime-shell.test.tsx`, teacher spec (`page.locator("form")` count 1) | medium |
| `app/page.tsx`, `app/api/synthetic/session/route.ts`, `app/belepes/actions.ts` | landing flow, `app-entrypoints.test.tsx`, `runtime-foundation`, `visual-overhaul`, `profile-login-measurement` | medium |
| `app/admin/_components/ResponsiveCollection.tsx` plus four list pages and detail pages | `admin-components.test.tsx`, `admin-core.spec.ts` | medium |
| `app/teacher/schedule/_components/ScheduleCollection.tsx`, teacher detail and denied pages | `teacher-web.spec.ts` | medium |
| `app/szulo/ertesitesek/page.tsx`, `NotificationReadForm.tsx`, `app/szulo/actions.ts` (read only) | `parent-web.spec.ts` (`notification-read-button-*`) | medium |
| `app/globals.css` | every page; axe `@a11y` specs | high (cross-cutting) |
| `tests/coverage/production-inventory.test.ts` | asserts an exact production file count (153 today) | low, must be updated |

Rules kept: stable `data-testid` hooks stay wherever the element survives (`<testId>-open-<id>` on the whole-card links, `teacher-schedule-open-<id>` and `teacher-schedule-card-open-<id>`, `notification-link-<id>`, `notification-read-form|state-<id>`, `app-shell-navigation-<id>` for the ids that remain); removed ids are the "Részletek" text links' separate buttons, the teacher menu items, and `notification-read-button-<id>` is replaced by a checkbox (`notification-read-checkbox-<id>`). Copy is Hungarian, identifiers English. No new remote origins.

Commands need Node 24 and npm 11 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Implementation Steps

- [ ] Step 1: Project structure and configuration skeleton. Confirm branch `feature/visual-overhaul-navigation`; no config or dependency change is needed. Do not commit anything.
- [ ] Step 2: Verify the test runner and record the baseline. Run the existing tests this change touches before editing anything and record pass counts: `node --experimental-strip-types --test src/runtime/*.test.ts` and `npx vitest run --config vitest.config.ts tests/integration/runtime-shell.test.tsx tests/integration/admin-components.test.tsx tests/coverage/app-entrypoints.test.tsx tests/coverage/parent-pages.test.tsx tests/coverage/production-inventory.test.ts tests/unit/current-role-session.test.ts tests/unit/runtime-boundaries.test.ts`.
- [ ] Step 3: Status words (Frontend behavior and pure helper) - implement (FR2). New `src/application/status-labels.ts` exporting `statusLabel(value)` with the Hungarian map (pending: Függőben, approved: Jóváhagyva, rejected: Elutasítva, active: Aktív, archived: Archivált, open: Nyitott, scheduled: Ütemezve, and every other value the synthetic data and the application's status types can produce, listed in the file) and the fallback "Ismeretlen állapot". Use it in `ResponsiveCollection.tsx`, the four admin detail pages (nyilvantartasok, archivum, jovahagyasok, feladatok), `emlekeztetok` (`job.status`) and `adatvedelem` (`candidate.eligibility`), and make the filter `<option>` labels read from the same map while their `value`s stay unchanged.
- [ ] Step 4: Status words - write and run tests. New `src/application/status-labels.test.ts` (Node runner): every status value present in the synthetic admin data and the status unions has a label, none returns the fallback, unknown input returns "Ismeretlen állapot", no label contains an English word from a deny list (FR2.4). Update `tests/integration/admin-components.test.tsx` (text "Aktív", not "active") and `tests/browser/admin-core.spec.ts` ("Állapot: Archivált").
- [ ] Step 5: Menus and landing pages (Frontend behavior and routing) - implement (FR6, FR7). In `src/runtime/synthetic/profiles.ts` define the one menu per profile: parent Feladatok, Értesítések; teacher none; group admin Áttekintés, Nyilvántartások, Feladatok és események, Jóváhagyások, Archívum; super admin those five plus Importálás, Emlékeztetők, Adatvédelem, Beállítások; set `homePath` to `/szulo/ertesitesek`, `/teacher/schedule`, `/admin`, `/admin`. Remove `withCoreNavigation` and let `app/admin/layout.tsx` pass `profile.navigation` unchanged. Update `HOME_PATH_BY_ROLE` in `src/application/authorization.ts` (parent), the default destination in `app/belepes/actions.ts` and every place a post-sign-in redirect for teacher or admin is computed (FR6.4, FR6.4a; a requested destination still wins). `app/api/synthetic/session/route.ts` redirects (303) to the profile's `homePath`; `app/page.tsx` with a session redirects to `homePath` and the welcome panel is deleted; an unknown role, expired session or missing session keeps today's behaviour (FR6.6). The authorization matrix and server-side page guards are not edited.
- [ ] Step 6: Menus and landing pages - write and run tests. Update `tests/unit/current-role-session.test.ts`, `tests/unit/runtime-boundaries.test.ts`, `tests/coverage/app-entrypoints.test.tsx` (redirect instead of "Üdvözlünk"; no welcome heading rendered), `tests/coverage/` session route test if present. New `tests/unit/navigation-access.test.ts`: for every profile, every menu link and the `homePath` resolves to a route that the existing authorization matrix allows that role to open, the group admin menu excludes import, reminders, privacy and settings, and the menu lists match FR7.1 in label and order (FR7.4).
- [ ] Step 7: Shell, menu buttons and focus (Frontend behavior) - implement (FR4, FR5, FR6.3, FR6.5). New client component `src/runtime/AppNav.tsx` (uses `usePathname`) rendering the menu as button-styled links with `aria-current="page"` on the current page, a 44 px target and the collapsible "Navigáció" panel on narrow screens; `AppShell.tsx` renders it only when the profile has menu items (teacher: no `<nav>`, no toggle), passes `profile.homePath` to `BrandMark` as the logo link, and keeps the skip link and status text. Teacher detail page and the teacher denied page get a "Vissza a beosztáshoz" link. In `app/globals.css`: menu button styles (default, hover, pressed, current, focus-visible), remove the visible focus ring from non-interactive headings and `[tabindex="-1"]` targets while keeping the programmatic focus (`autoFocus` stays), keep `:focus-visible` on interactive controls.
- [ ] Step 8: Shell, menu buttons and focus - write and run tests. Update `tests/integration/runtime-shell.test.tsx` (menu items per profile, no nav for the teacher, `aria-current`, logo links to `homePath`); new `tests/integration/app-nav.test.tsx` for current-page marking and hidden menu; update `tests/browser/runtime-foundation.spec.ts`, `visual-overhaul.spec.ts` and `profile-login-measurement.ts` (landing page after profile selection, no welcome heading, heading still focused, no visible outline on the focused heading via computed style, nav counts from the one menu, teacher without nav).
- [ ] Step 9: Whole-card list items (Frontend behavior) - implement (FR1.1, FR1.2, FR1.4, FR1.5). `ResponsiveCollection.tsx`: each `li` holds one `Link` (keeps `<testId>-open-<id>`) wrapping the title and the Hungarian state label; no "Részletek". `ScheduleCollection.tsx`: card layout is one link per card; table layout keeps row and cell semantics with the title cell link stretched over the row (position and `::after`), same accessible name as the card, hidden "Részletek" header removed. `app/globals.css`: `.admin-card-link`, `.teacher-card-link`, `.teacher-row-link` styles with hover, pressed and focus-visible states and 44 px targets.
- [ ] Step 10: Whole-card list items - write and run tests. Update `tests/integration/admin-components.test.tsx` (one link per item, href kept, no "Részletek"), add a teacher schedule component test for both layouts (one link per item, row semantics kept, same accessible name), update `tests/browser/teacher-web.spec.ts` (open test ids, keyboard open from the table) and `admin-core.spec.ts` (click a whole approval item).
- [ ] Step 11: Notifications (Frontend behavior) - implement (FR3). `app/szulo/ertesitesek/page.tsx`: each notification is a card with one whole-card `a` (keeps `notification-link-<id>`) and, beside it on the right, `NotificationReadForm`; the "Megnyitás" link is removed. `NotificationReadForm.tsx` becomes a checkbox (`notification-read-checkbox-<id>`) with the accessible name "Olvasottnak jelölöm" plus the notification title, submits as soon as it is ticked, is disabled and busy while the request runs, reverts and shows a Hungarian error in a `role="alert"` region if the action fails, is ticked and disabled when already read, and carries a `<noscript>` "Mentés" submit button for no-JavaScript use. `app/globals.css`: `.notification-card` with its own padding, a two-column layout (content left, checkbox right), alignment that works from 320 px up.
- [ ] Step 12: Notifications - write and run tests. New `tests/integration/notification-read-form.test.tsx` (tick submits once, busy state, failure reverts with an alert message, read state ticked and disabled, accessible name, noscript fallback present); extend `tests/coverage/parent-pages.test.tsx` (card has one link and one checkbox, no "Megnyitás"); update `tests/browser/parent-web.spec.ts` (`notification-read-button-*` becomes the checkbox).
- [ ] Step 13: Browser tests - write and run. New `tests/browser/navigation-polish.spec.ts` covering per profile: lands on the default page after choosing it, the same menu items and order on every page, `aria-current`, teacher has no menu and can get back to Beosztás from a detail page and from the denied page, admin list items open on a whole-card click, no English status word on admin lists, notification card opens and the checkbox marks it read, no visible ring on the focused heading, and no horizontal overflow at 320 px on the changed screens. Run on chromium and mobile-chrome after `npm run build`; the `@a11y` tests must stay free of serious or critical findings and now also load the new default pages.
- [ ] Step 14: Environment and build configuration. Update `tests/coverage/production-inventory.test.ts` expected count for the new production files; run `npm run lint`, `npm run format:check` (format first with Prettier where needed), `npm run typecheck`.
- [ ] Step 15: Documentation and traceability. Update `HASZNALATI_UTMUTATO_HU.md` (landing pages, menu, notification checkbox, whole-card lists); write `code-summary.md` (files, the status label table, decisions, deviations, baseline counts) and `traceability.json` mapping every FR and NFR id to an existing file.
- [x] Step 16: Revision after review (requested by the person at the gate). R-01: after a successful tick of the notification checkbox in `app/szulo/_components/NotificationReadForm.tsx`, keyboard focus must not fall to the page body: move focus to that notification's whole-card link (`notification-link-<id>`) once the read state is saved (the box stays ticked and disabled), and keep the failure path that refocuses the unticked box. Add a component test for it in `tests/integration/notification-read-form.test.tsx` and a focus assertion in the browser test that marks a notification read (`tests/browser/navigation-polish.spec.ts` or `parent-web.spec.ts`). Then re-run the affected tests (`tests/integration/notification-read-form.test.tsx`, `tests/coverage/parent-pages.test.tsx`), lint, format check, typecheck, `npm run build`, and the touched Playwright specs on chromium and mobile-chrome; update `code-summary.md` (and `traceability.json` if a target changes).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "bugfix",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Include a targeted regression for the bug or vulnerability.",
      "Keep the existing test suite green."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:0dbb24e082818d67bb4a2759f2e3b0e80eaa5e9ea8db6464cc687dc75ac9b9b8",
  "contract_sha256": "sha256:8e04002e90151bfcdb1fb4689b1f511c05063f263489bcef08e9e6f892efd023"
}
```

## Traceability

| Requirement | Plan steps |
|---|---|
| FR1.1 to FR1.5 | 9, 10, 13 |
| FR2.1 to FR2.4 | 3, 4, 13 |
| FR3.1 to FR3.5 | 11, 12, 13 |
| FR4.1, FR4.2 | 7, 8, 13 |
| FR5.1 to FR5.3 | 7, 8, 13 |
| FR6.1 to FR6.6 | 5, 6, 7, 8, 13 |
| FR7.1 to FR7.4 | 5, 6, 13 |
| NFR1, NFR2, NFR3 | 7, 9, 11, 13 |
| NFR4 | 2, 14 |
| NFR5 | 6, 8, 10, 12, 13, 14, 15 |
| NFR6 | 3, 5, 7, 11, 15 |
