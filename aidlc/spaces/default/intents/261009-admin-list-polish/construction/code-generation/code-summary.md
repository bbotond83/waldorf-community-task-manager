# Code Summary: Admin and schedule list polish

## Baseline (Step 2, before any edit)

Node runner: 9/9 on `src/application/status-labels.test.ts`. Vitest: 119/119 across the seven baseline files named in `unit-test-instructions.md`.

## Files created and modified

New production files (3, production inventory 161 to 164):

- `src/runtime/StatusBadge.tsx`: inline SVG icon (`aria-hidden`) plus the Hungarian word, one tone class per icon.
- `src/runtime/FilterClearLink.tsx`: client "Szűrők törlése" link; empties the form fields, navigates to the bare address and moves focus to the page heading; a plain link without scripts.
- `app/teacher/_lib/schedule.ts`: `readTeacherSchedule` and `teacherRange` (one authorized read per granted group, merged by start time).

Modified production files:

- Teacher logic: `src/teacher-tracking/tracking-model.ts` (optional `from`/`to`, `isOptionalTrackingRange`), `src/application/teacher-facade.ts`, `src/teacher-web/synthetic-teacher.ts`, `src/teacher-web/synthetic-teacher-repository.ts`, `app/teacher/_lib/filters.ts` (empty means absent; `teacherDetailQuery`, `teacherScheduleHref`).
- Status symbols and wording: `src/application/status-labels.ts` (symbol tables, `statusSymbol`, `statusOptionText`, `dutyStateOptionText`, teacher free-text mapping), `src/admin-advanced/synthetic-advanced.ts` ("elem" wording).
- Teacher pages: `app/teacher/schedule/page.tsx`, `[id]/page.tsx`, `_components/ScheduleFilter.tsx`, `_components/ScheduleCollection.tsx`, `app/teacher/_components/TeacherStatePanel.tsx`.
- Admin pages and actions: `AdminFilterBar.tsx`, `ResponsiveCollection.tsx`, `ImportWorkflow.tsx`, `app/admin/_lib/action-state.ts`, `app/admin/actions.ts`, the list pages (nyilvantartasok, feladatok), the create page (nyilvantartasok/uj), the detail pages (nyilvantartasok, feladatok, jovahagyasok, archivum), archivum list, emlekeztetok, adatvedelem.
- Parent pages and styles: `app/szulo/feladatok/page.tsx`, `app/szulo/feladatok/[id]/page.tsx` (shared status badge and option texts), `app/globals.css` (shared filter-form layout, `.button-link`, secondary clear style, badge and icon tones).
- Docs: `HASZNALATI_UTMUTATO_HU.md`.

Not edited: authorization matrix, server-side page guards, data model.

Tests created: `src/application/status-symbols.test.ts`, `tests/unit/teacher-schedule.test.ts`, `tests/integration/status-badge.test.tsx`, `tests/integration/filter-clear-link.test.tsx`, `tests/browser/list-polish.spec.ts` (35 tests per project).

Tests updated: `src/application/teacher-facade.test.ts`, `src/teacher-web/synthetic-teacher-repository.test.ts`, `tests/unit/{teacher-filters,design-tokens}.test.ts`, `tests/integration/{admin-components,teacher-components,teacher-routes}`, `tests/coverage/{admin-pages,teacher-pages,parent-pages,parent-functional-fixes,production-inventory}`, `tests/browser/{teacher-web,navigation-polish,functional-fixes,admin-advanced}.spec.ts`.

## Key decisions

- **Teacher clear and first visit (R-01)**: "All fields should be cleared." is applied everywhere: the group select has an empty first option "Minden csoport", dates are optional (empty means no limit, one date is a one-sided limit, a filled pair with start after end keeps its message), and the first visit and a bare address show every granted group. "Every granted group" is implemented as one authorized read per granted group, merged by start time; an unknown or not-permitted `groupId` is still denied. An empty string is treated as absent. This deliberately changes the old first-visit default (first group, 2026-08-12 to 2026-08-20); four teacher test files changed on purpose, plus `tests/integration/teacher-routes.test.ts` (a malformed `groupId` now yields an empty group with the invalid-date marker).
- **Detail links in the all-groups list**: each entry's detail address names its own group (`groupId`) and carries an `allGroups=1` marker when the list was unfiltered; the back link returns to the bare list, so the fields stay empty after Back.
- **Clear control (R-03)**: `FilterClearLink` clears the inputs on click and then navigates, because a keyed form alone cannot clear a typed value when the address does not change; the forms are also keyed by their address-derived values. Focus goes to the page heading.
- **Layout (R-05)**: one shared filter-field layout, label above field, equal 2.9 rem control and button heights, buttons bottom-aligned on wide screens and stacked on a phone, applied to the teacher, admin, parent duty and reminders filters; admin create forms use a CSS-only tighter label spacing. The privacy page has no filter form, so nothing was applied there.
- **Buttons**: "Új elem" and "Új feladat vagy esemény" use `.button-link` (primary pill like "Szűrés", 44 px, hover, pressed, focus ring); test ids are unchanged.
- **Wording (R-04)**: every user-facing "Rekord/rekord" is now "Elem/elem" with the grammar forms from the plan; the case-insensitive search over `app/`, `src/`, `tests/` and the user guide finds no plain "rekord" except two negative assertions (`tests/coverage/admin-pages.test.tsx:83`, `tests/browser/list-polish.spec.ts:391`).
- **Status symbols (R-02)**: one shared table next to the labels; the symbol is an inline SVG in lists, detail pages and the status column, and a plain text-presentation character in dropdown options (no emoji-presentation character; a unit test checks it). A unit test fails when any key of `STATUS_LABELS` or `DUTY_STATE_LABELS` has no symbol. Unknown states show "?"; a missing teacher status shows "Nincs elérhető állapot" without a symbol. The teacher's free-text "Ütemezett" is shown as "Ütemezve"; other known words use the shared label; unmapped text is shown unchanged with the neutral symbol.
- **Colours**: no new hex token; icons use the existing success, primary, ochre and neutral tokens, asserted at 3:1 on the card surfaces in `design-tokens.test.ts`.

### Symbol table

Dropdown characters: check ✓, cross ✕, clock ◔, dot ●, ring ○, half ◐, square ■, diamond ◆, calendar ▦, pencil ✎, arrow →, retry ↻, undo ↺, warning △, block ⊘, pause ‖, unknown ?.

| Status key | Char | | Status key | Char |
|---|---|---|---|---|
| pending, queued, retry-scheduled, swap-pending, cancellation-pending | ◔ | | approved, eligible-delete, eligible-anonymize, validated, confirmed, committed | ✓ |
| rejected, terminal | ✕ | | active, available | ● |
| archived, preview | ○ | | open | ◐ |
| scheduled | ▦ | | assigned (admin) | ◆ |
| notes-saved | ✎ | | sent | → |
| retryable, retrying, recovered | ↻ | | stale, conflicts | △ |
| cancelled, blocked, ineligible | ⊘ | | selected, full | ■ |
| rolled-back | ↺ | | interrupted | ‖ |

Parent duty states: available ●, full ■, ineligible ⊘, assigned (parent) ✓, swap-pending ◔, cancellation-pending ◔.

## Test results

- Domain tests (`npm run test:domain`): 258/258. Delivery Vitest: 531/531 across 42 files. `npm run test:coverage` exit 0 (domain: lines 95.30%, branches 88.54%, functions 93.21%; delivery: 93.24% / 86.15% / 94.49%).
- Browser (after `npm run build`): the seven-file Step 8 command on chromium, firefox and mobile-chrome gave 341 passed, 1 skipped, 6 failed; the failures were two `teacher-web.spec.ts` tests asserting old behaviour (the word "Ütemezett" and the Back URL with a query), updated and rerun: 30/30 on all projects. `@a11y` on chromium 13/13, no serious or critical findings. `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build` clean. The full seven-file command is rerun in Build and Test.

## Deviations and open items

- The "Szűrők törlése" control is a client component, not a plain link (see decisions).
- `tests/integration/teacher-routes.test.ts` changed although it was not on the plan's R-01 list.
- Glyph rendering of the dropdown characters was verified on desktop chromium, firefox and the mobile-chrome emulation only; a real Android or older iOS font stack was not checked.
- The developer used two shell edits on source files (a Python edit to `app/teacher/_lib/filters.ts`, `sed -i` on `tests/coverage/parent-pages.test.tsx`) against the file-tool rule; both were read back and verified, and neither touched the AI-DLC record.
- `playwright.login-existing.config.ts` was not run.
