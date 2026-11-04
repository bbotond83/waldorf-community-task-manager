# Code Generation Plan: u5-approval-screens

## Summary

- Builds: the Stitch look for the teacher schedule (filter, table on wide screens, cards under 44rem, detail page) and the admin approvals (list, detail, decision form).
- Touches: `app/globals.css` (the `.teacher-*` and `.admin-*` rules for these pages, reusing the U1 to U4 shared look), small class hooks in the teacher schedule and admin approvals pages and their components only where the style needs them, `DESIGN.md`, and two new browser specs (teacher, admin).
- Tests: about 8 new browser checks (table and card look, the table-to-cards switch at 44rem, filter, detail panel, decision form and its states, 320 px, accessibility) plus the existing suite kept green; the owner checks screenshots at 320 px and desktop.

## Scope and inputs

- Unit: `u5-approval-screens` (kind `ui`, complexity M). Requirements: FR3.6 and FR5.1 to FR5.6 as "must not change" proof. Depends on U1 to U4 (approved): it reuses the page frame, button, pill, filter, state, card, detail-panel, form and notice rules and does not redefine them.
- Decisions followed: ADR-001 (one stylesheet), ADR-004 (screen groups). Functional Design is skipped; steps trace to FR IDs.
- Stitch reference: "Jóváhagyások (Pedagógus és Adminisztrátori nézet)" in `projects/14373287019289018119` (screenshot file `screenshot_00065f5fb50730b0023bc0f97f2d7745`, download with `mcp__stitch__download_file` using `name: projects/14373287019289018119/files/<fileId>`; large results land in a tool-results file). Read it before styling. Stitch features with no element in the app are not built (tabs, avatars, round icons, bulk actions, counters, search fields that do not exist, extra buttons); the Content-Security-Policy does not allow an outside icon font, so existing inline icons stay.
- The table-to-cards switch under 44rem stays exactly as it is (same breakpoint, same markup structure).

## Current code (facts)

- Teacher: `app/teacher/schedule/page.tsx` and `[id]/page.tsx`, components `ScheduleFilter.tsx` and `ScheduleCollection.tsx`. Classes used: `teacher-page`, `teacher-filter`, `teacher-collection`, `teacher-table-wrapper`, `teacher-table`, `teacher-row-link`, `teacher-card-list`, `teacher-card`, `teacher-card-link`, `teacher-detail-grid`, `filter-field`, `filter-actions`, `eyebrow`, `form-hint`, `button-link button-link-secondary`. Existing `.teacher-*` rules start near `app/globals.css` line 1434 (U1 touched only shared controls, not these).
- Admin: `app/admin/jovahagyasok/page.tsx` (list) and `[id]/page.tsx` (detail and decision form), components `ResponsiveCollection.tsx`, `AdminMutationForm.tsx`, `AdminFilterBar.tsx`, `AdminBackLink.tsx`, `AdminPagination.tsx`. Classes used: `admin-page`, `admin-filter`, `admin-collection`, `admin-card`, `admin-card-link`, `admin-state-badge`, `admin-detail-grid`, `admin-form`, `admin-checkbox-field`, `admin-checkbox-label`, `admin-field-error`, `admin-safe-reason`, `admin-form-success-link`, `admin-back-link`. Existing `.admin-*` rules are in `app/globals.css` lines about 410 to 690.
- Specs that touch them (stay green): `teacher-web.spec.ts`, `admin-core.spec.ts`, `directory-coordination.spec.ts`, `functional-fixes.spec.ts`, `list-polish.spec.ts`, `navigation-polish.spec.ts`, `visual-overhaul.spec.ts`.
- Kept as they are: class names and `data-testid`s, 44px minimums, Hungarian copy, `role`s and focus moves, the break at 44rem, light mode and reduced motion.

## Steps

Ordering follows the Testing Contract: test-after, one layer at a time. Run `npm run lint:css` after every stylesheet step. Playwright serves the production build, so run `npm run build` after source edits before browser specs. Browser specs run against the local database, which is already running.

- [x] **Step 1: Project structure and configuration.** No new dependency, folder or setting. Confirm `npm run lint:css` and the unit-scoped commands in `unit-test-instructions.md` work from the U4 state.
- [x] **Step 2: Verify the existing test runner and record the unit-scoped commands.** Run the commands once before any change to prove they work.
- [x] **Step 3: Teacher schedule list - implement (FR3.6).** Restyle the filter (shared `.parent-filter` look through the teacher selectors or shared selectors, no duplicated colours), the table (cream panel, sand dividers, header row in muted Karla caps, row hover, whole-row link kept) and the card list under 44rem (the U2 duty-card look: cream card, soft shadow, Vollkorn title, status text readable). Page header with eyebrow and Vollkorn headline-lg. Keep DOM, test ids and the 44rem switch.
- [x] **Step 4: Teacher list - write and run its tests.** `tests/browser/teacher-style.spec.ts` (new, calls `bindSeededSchema`): table panel background and radius, header cell font, row link at least 44px high, cards shown and the table hidden at 600 px and the reverse at 1280 px (breakpoint kept), title in Vollkorn, no sideways scroll at 320 px, text contrast at least 4.5:1 on the status text. Run with `teacher-web` and `list-polish`.
- [x] **Step 5: Teacher detail - implement and test (FR3.6).** Restyle `.teacher-detail-grid` as the U3 detail panel (one cream panel, divided rows, label above value) and the back link. Extend the new spec with a detail-panel check and an axe scan of list and detail.
- [x] **Step 6: Admin approvals list - implement (FR3.6).** Restyle the filter bar, the collection cards (`admin-card` as the U2 card: cream, shadow, Vollkorn title) and the state badge `admin-state-badge` as the shared status pill (reuse the pill selectors; pending text dark terracotta, never ochre text), pagination as quiet outlined pills of at least 44px.
- [x] **Step 7: Admin detail and decision form - implement (FR3.6).** Restyle `.admin-detail-grid` as the detail panel, the decision form (`admin-form`) as the shared `.parent-form` look (cream panel, label above field, 44px controls, pill primary button), checkbox field with a 44px target, field errors in terracotta with the existing role and focus move, the success link and the terminal/denied action states as the U3 notices (green wash for success, terracotta bar for refusal, info wash for neutral). The protected reason text (`admin-safe-reason`) keeps its wrapping.
- [x] **Step 8: Admin screens - write and run their tests.** `tests/browser/admin-approvals-style.spec.ts` (new, calls `bindSeededSchema`): card look and pill contrast on the list, detail panel, decision form panel and controls at least 44px with the 3px `#1f4e79` focus ring, a real approval shows a status region with the green wash and contrast at least 4.5:1, a refused or invalid decision keeps its alert role and terracotta bar, no sideways scroll at 320 px, axe on list and detail with no serious or critical findings. Run with `admin-core`, `directory-coordination`.
- [x] **Step 9: Environment and build.** Run Prettier on every touched file and the unit's gate set: lint, `lint:css`, format check, type check, unit tests with coverage, build, start smoke, and the browser specs named above (all three browsers in Build and Test). No coverage threshold is changed.
- [ ] **Step 10: Documentation and traceability.** Update `DESIGN.md` (teacher and admin approval bullets); write `code-summary.md`, `source-manifest.json`, `traceability.json`. Prepare screenshots at 320 px and 1280 px of: the teacher list (cards and table), teacher detail, the admin approvals list, the admin detail with the decision form, and a decision outcome, for the owner check.

## Requirement trace

| Requirement | Step |
|---|---|
| FR3.6 | 3 to 8 |
| FR5.1 to FR5.6 | 3 to 8: Hungarian copy, test ids and class hooks unchanged; keyboard and focus ring and the focus move to messages; wrapping and no sideways scroll at 320; light mode and reduced motion; proved by the existing teacher, admin and navigation specs plus the new specs |

## Owner check (gated)

The owner compares screenshots of the teacher and admin approval screens at 320 px and on desktop with the Stitch "Jóváhagyások" screen; Stitch features listed above as not built are expected differences. Build and Test does not start until the owner approves.

## Risks

- Several admin pages share `.admin-*` rules (tasks, records, import, settings). A change meant for approvals must be scoped by the approvals pages' own wrapper or class, or be a look change that is right for all of them; the admin specs run in this unit and the other admin pages are looked at once at 320 px for breakage.
- The table-to-cards switch is a measured behaviour; the new spec asserts it at 600 and 1280 px.
- Contrast: pills, badges, cards and form states are checked by the new specs and axe, not assumed. Ochre is never used for text.
- The decision form changes data; specs reseed before each test.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "classic",
  "test_strategy": "standard",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n- **Methodology evidence**: Unchanged. Tests sit next to the code or in `tests/` in the same pull request, and each fix commit carries its regression test. No history shows tests written ahead of the code as a rule.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source (Vitest with the Istanbul provider, thresholds 80/80/80 in `vitest.config.ts`).\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets.\n\nFor a style-only change the existing gates are the safety net, and they react to styling: browser specs assert computed styles, element sizes, layout at several widths and class hooks, and `tests/unit/design-tokens.test.ts` reads colour tokens only in the form `--name: #rrggbb` inside `:root` of `app/globals.css`. Restyled screens keep those class names, measurements and token format, or the matching tests change in the same pull request.\n\nWe check how restyled screens look by owner review: the owner compares each restyled screen with the Stitch design using screenshots provided by the assistant. We do not add automatic picture-comparison tests.\n\nWe want an automated check on `app/globals.css` (a CSS linter such as Stylelint wired into the project's blocking checks), because nothing but the browser specs catches style mistakes today. This is new work for this change and is planned in later stages.\n\nWe want the floating `latest` versions of `react`, `react-dom`, `zod`, `@axe-core/playwright` and `@playwright/test` pinned during this work, so check results do not change without a code change. This is new work, planned in later stages."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
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
  "input_sha256": "sha256:5df66fa83f9fc72e3b00c57e199c93c2d694c97d3aa2f7bf33c2670b6aa41cee",
  "contract_sha256": "sha256:096a6223dc54a271012983f92324eaf70d64a55a671662f5bc16a93e7021b96e"
}
```
