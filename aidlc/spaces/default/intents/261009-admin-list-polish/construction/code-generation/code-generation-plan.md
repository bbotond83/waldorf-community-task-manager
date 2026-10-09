# Code Generation Plan: Admin and schedule list polish

## Summary

- Builds: working "Szűrők törlése" on the teacher schedule and the three admin lists, label-above-field filter and form layouts, "Új elem" and "Új feladat vagy esemény" as proper buttons, "Rekord" renamed to "Elem" in all user-facing copy, and a small symbol before every status word (a shared status badge plus symbol characters in the status dropdowns).
- Touches: `app/teacher/` (filters, `ScheduleFilter`, `TeacherStatePanel`, `ScheduleCollection`), `src/teacher-web/` (optional group and dates), `app/admin/` (`AdminFilterBar`, list and detail pages, create pages, `ResponsiveCollection`, `actions.ts`, `action-state.ts`, reminders, privacy), `app/szulo/feladatok/` (duty filter and status), `src/application/status-labels.ts`, `src/admin-advanced/synthetic-advanced.ts` (wording), `app/globals.css`, `HASZNALATI_UTMUTATO_HU.md`, about 18 existing tests.
- Tests: about 4 new test files (symbol table, teacher filter semantics, status badge, layout and clear journeys) and updates to about 18 existing ones, plus Playwright checks on chromium, firefox and mobile-chrome.

## Scope and Blast Radius

Zero-Unit work (bugfix scope, no Unit DAG). Source: `requirements.md` (FR1 to FR4, NFR1 to NFR7) and the scan handoff `inception/reverse-engineering/developer-scan.md`. No business rule, authorization matrix or page guard changes. The review points of the requirements stage are settled here:

- R-01 (first-visit change): FR1.2 deliberately changes the teacher schedule's first-visit and no-date behaviour (today: first group and the window 2026-08-12 to 2026-08-20); this is carved out of FR1.7 and NFR6. The person's answer was "All fields should be cleared." and the build applies it to the first visit as well; the Code Generation gate asks the person to confirm that point. Rules: an empty or absent `groupId` shows every group the teacher is granted (never a group outside the grant); an unknown or not-permitted `groupId` keeps today's behaviour (the validation or fallback it has now); a single filled date applies a one-sided limit; a filled pair with start after end keeps today's Hungarian validation message. Tests that change on purpose: `tests/unit/teacher-filters.test.ts`, `tests/coverage/teacher-pages.test.tsx`, `tests/integration/teacher-components.test.tsx`, `tests/browser/teacher-web.spec.ts`, and the group/date steps in `tests/browser/support/profile-login-measurement.ts`.
- R-02 (status symbols, boundary): symbols cover every key of `STATUS_LABELS` and `DUTY_STATE_LABELS`, shown only where a status stands as its own item (list badge, "Állapot" line, status column, status dropdown options on the admin lists, the reminders filter and the parent duty filter), never inside a sentence (the pending-request notice text stays a sentence). "Ismeretlen állapot" and the empty teacher status ("Nincs elérhető állapot") get a neutral symbol or none, decided in the table. The teacher status column maps its free text to the shared labels (the repository's "Ütemezett" is shown as "Ütemezve"; a wording change that is noted in the user guide); text that has no mapping is shown unchanged with the neutral symbol. The finished symbol table is a section of `code-summary.md`, and one unit test fails when any key of either label table has no symbol. "Olvasott" and "Olvasatlan" on notification cards are not statuses of this table and stay as they are.
- R-03: after "Szűrők törlése" (link navigation) focus moves to the page heading (the app's existing page-load pattern); the Back button case is: filter, click clear, open a detail page, press Back: the filter fields are empty. A typed but unsubmitted value and an address-supplied value are both cleared (the form is keyed by its address-derived values).
- R-04: grammar, listed here: "Új elem", "Elem típusa", "Elem létrehozása", "Elem részletei", "Archivált elem", "Az elem nem található.", "Nincs archivált elem.", "Az elem archiválva." and "Az elem visszaállítva.", "Az elem nem állítható vissza, mert ütköző aktív elem létezik.", "3 elem módosult, 1 sor változatlan maradt.", "Napraforgó csoport: 1 új elem", "Az elem már létezik.", and in the user guide "elemre", "elemet" and "blokkolt elemnél". Check: a search for `rekord` (case-insensitive) over `app/`, `src/`, the tests' expected strings and `HASZNALATI_UTMUTATO_HU.md` finds only identifiers, test ids, route names and comments; the result is recorded in `test-results.md`. `tests/coverage/admin-pages.test.tsx:82` and `tests/browser/admin-advanced.spec.ts:55` change together with the strings.
- R-05: label-above-field layout is applied and checked at 320 px and desktop for: the teacher schedule filter, the admin filter bar on the three lists, the parent duty filter, the reminders and privacy (`advanced-filter`) filters, and the admin create forms (`.admin-form`).

| File or group | Consumers / tests | Impact |
|---|---|---|
| `app/teacher/_lib/filters.ts`, `src/teacher-web/*`, teacher page and `ScheduleFilter`, `TeacherStatePanel` | `teacher-filters.test.ts`, `teacher-pages.test.tsx`, `teacher-components.test.tsx`, `teacher-web.spec.ts`, `profile-login-measurement.ts` | high: first-visit and clear semantics change |
| `app/admin/_components/AdminFilterBar.tsx` and the three list pages | `admin-components.test.tsx`, `admin-functional-fixes.test.tsx`, `functional-fixes.spec.ts:215-290`, `navigation-polish.spec.ts:155-171` | medium: clear control, option symbols |
| `src/application/status-labels.ts` (+ symbols) | every status render site, `status-labels.test.ts` | medium |
| status render sites (`ResponsiveCollection`, four admin detail pages, reminders, privacy, parent duty list and detail, teacher schedule) | admin and parent component and page tests, browser specs | medium |
| create pages and links (`nyilvantartasok/uj`, `feladatok/uj`, list pages), "rekord" copy in 8 files | `admin-pages.test.tsx:82`, `admin-advanced.spec.ts:55`, user guide | medium |
| `app/globals.css` (filter grids, button, badge, tokens) | every page; axe `@a11y`; `tests/unit/design-tokens.test.ts` | high (cross-cutting) |
| `tests/coverage/production-inventory.test.ts` | asserts an exact production file count | low, must be updated |

Rules kept: stable `data-testid` hooks stay wherever the element survives; copy is Hungarian, identifiers English; no new remote origins; hex colours only as `:root` tokens with a contrast assertion. Commands need Node 24 and npm 11 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Implementation Steps

- [x] Step 1: Project structure and configuration skeleton. Confirm branch `feature/admin-list-polish`; no dependency change. Do not commit anything.
- [x] Step 2: Verify the existing test runner and record the baseline: run the commands in `unit-test-instructions.md` (baseline section) before editing anything and record pass counts in `code-summary.md`.
- [x] Step 3: Business logic: teacher filters and status symbols - implement (FR1.1, FR1.2, FR4.2, FR4.6). `app/teacher/_lib/filters.ts` (and the teacher repository or facade it calls): empty or absent `groupId` means every granted group, empty dates mean no limit, one-sided dates work, invalid range keeps its message, unknown or not-permitted `groupId` keeps today's behaviour; `teacherFilterQuery` omits empty values. `src/application/status-labels.ts`: add the symbol table (`STATUS_SYMBOLS`, `DUTY_STATE_SYMBOLS`, `statusSymbol`, `dutyStateSymbol`) next to the label tables with the three approval symbols (check, cross, clock) and a fitting symbol for every other key, a neutral entry for unknown, plus the plain-character form used in dropdown options (`statusOptionText`); teacher free-text status mapping helper (known words to shared states, unknown text unchanged). Each symbol exists as an inline vector icon key and as a plain character.
- [x] Step 4: Business logic - write and run tests. Update `tests/unit/teacher-filters.test.ts` for the new semantics (R-01 rules); new `src/application/status-symbols.test.ts` (Node runner): every key of `STATUS_LABELS` and `DUTY_STATE_LABELS` has a symbol and a plain character, approval symbols are the three required ones, unknown is neutral, teacher mapping ("Ütemezett" becomes "Ütemezve", unknown text unchanged, null shows no symbol).
- [x] Step 5: Frontend, shared pieces - implement (FR2, FR3.1 to FR3.3, FR4.1 to FR4.5). New `StatusBadge` component (inline SVG icon with `aria-hidden` plus the word, colour from tokens, one shared place under `src/runtime/` or `app/_components/`); replace every standalone status render with it (list badge, the four detail "Állapot" lines, reminders and privacy, parent duty list and detail, teacher status column and card); status `<option>` texts (admin lists, reminders filter, parent duty filter) use `statusOptionText`, "Minden állapot" stays plain. `app/globals.css`: one shared filter-form layout (label above field, grid with equal heights and bottom-aligned buttons, stacked on a phone) applied to `.admin-filter`, `.teacher-filter`, `.parent-filter`, `.advanced-filter` and `.admin-form`; a `.button-link` (primary pill, same look as "Szűrés", 44 px, hover, pressed, focus-visible) and a secondary style for "Szűrők törlése"; badge and icon styles; any new colour is a `:root` token.
- [x] Step 6: Frontend, clear controls and create buttons - implement (FR1.3 to FR1.7, FR3). `ScheduleFilter` and `TeacherStatePanel` clear links go to the bare schedule address and the form is keyed by its address-derived values so no stale value survives; the group select gets an empty first option "Minden csoport" and the date inputs lose `required`; `AdminFilterBar` gets "Szűrők törlése" (link to the list without filter values, keyed form, test id `admin-filter-clear-link`) and the clear action moves focus to the page heading; `nyilvantartasok/page.tsx` "Új elem" and `feladatok/page.tsx` "Új feladat vagy esemény" use `.button-link` (test ids unchanged). Rename "Rekord" to "Elem" in the 8 files and the synthetic strings per the R-04 list.
- [x] Step 7: Frontend - write and run tests. New `tests/integration/status-badge.test.tsx` (icon `aria-hidden`, word kept, accessible name unchanged); update `tests/integration/admin-components.test.tsx` (clear control and keyed reset, option texts with symbols, badge, create button class), `tests/integration/teacher-components.test.tsx` (empty first group option, dates not required, clear link), `tests/coverage/teacher-pages.test.tsx`, `tests/coverage/admin-pages.test.tsx` ("elem részletei"), `tests/coverage/admin-functional-fixes.test.tsx`, `tests/integration/parent-components.test.tsx` and `tests/coverage/parent-pages.test.tsx` (badge on duty state), and `tests/unit/design-tokens.test.ts` for any new token.
- [x] Step 8: Browser checks - write and run. New `tests/browser/list-polish.spec.ts`: (a) teacher schedule: type a date without submitting, click "Szűrők törlése", all fields empty and all granted groups listed; open `?groupId=...&from=...&to=...`, clear, all fields empty; filter, open a detail, Back, fields as the address says, then clear, detail, Back, fields empty (R-03); focus is on the heading after clear; (b) each admin list: type a search and choose a status, clear, both reset and the unfiltered list shows; (c) label-above-field and no horizontal overflow at 320 px and desktop on every filter and create form listed in R-05; (d) "Új elem" and "Új feladat vagy esemény" are buttons (44 px, focus-visible), the create page shows "Új elem", "Elem típusa", "Elem létrehozása"; (e) status symbols present beside each status word in lists and dropdown options, and hidden from the accessibility tree. Update `teacher-web.spec.ts`, `navigation-polish.spec.ts:155-171`, `functional-fixes.spec.ts:215-290`, `admin-advanced.spec.ts:55` ("3 elem"), `admin-core.spec.ts`, `parent-web.spec.ts` as needed. Run on chromium, firefox and mobile-chrome after `npm run build`; the `@a11y` tests stay free of serious and critical findings.
- [x] Step 9: Environment and build configuration. Update `tests/coverage/production-inventory.test.ts` for the new production files; run `npm run lint`, `npm run format:check` (format first with Prettier where needed) and `npm run typecheck`.
- [x] Step 10: Documentation and traceability. Update `HASZNALATI_UTMUTATO_HU.md` (clear behaviour and first visit on the teacher schedule, label layout, "Új elem" and the new button, "elem" wording including its grammar forms, status symbols and the "Ütemezve" wording of the teacher status, checklist rows); write `code-summary.md` (files, the symbol table, decisions R-01 to R-05, deviations, baseline counts) and `traceability.json` mapping every FR and NFR id to an existing file; record the `rekord` search result for Build and Test.

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
