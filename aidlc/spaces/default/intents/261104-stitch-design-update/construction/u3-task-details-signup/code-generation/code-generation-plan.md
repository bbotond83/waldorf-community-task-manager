# Code Generation Plan: u3-task-details-signup

## Summary

- Builds: the Stitch look for the parent task detail page: the detail panel, the status pill, the notices, the signup form with its confirmation, and the follow-up actions and note forms on that page.
- Touches: `app/globals.css` (detail, form and notice rules), small class hooks in `app/szulo/feladatok/[id]/page.tsx`, `app/szulo/_components/ParentMutationForm.tsx` and `PendingRequestNotice.tsx` only where the style needs them, `DESIGN.md`, and one new browser spec.
- Tests: about 7 new browser checks (detail panel, signup and its confirmation, notices, 320 px, accessibility) plus the existing suite kept green; the owner checks screenshots at 320 px and desktop.

## Scope and inputs

- Unit: `u3-task-details-signup` (kind `ui`, complexity M). Requirements: FR3.3 and FR5.1 to FR5.6 as "must not change" proof. Depends on U2 (approved): it reuses the card, pill, filter and state rules from U1 and U2 and does not redefine them.
- Decisions followed: ADR-001 (one stylesheet), ADR-004 (screen groups). Functional Design is skipped; steps trace to FR IDs.
- Stitch references used: "Feladat Részletei", "Sikeres Jelentkezés Visszaigazolása" in `projects/14373287019289018119` (screenshots read: one cream detail panel with an eyebrow, a Vollkorn title, a status pill, rows with a small muted label above a larger value, an amber-tinted callout panel for the family's own commitment, outlined pill buttons for follow-up actions, section headings in Vollkorn, a left-bar callout for information).
- Not built (not in the app; UI-only restyle): the hero photo, the participant list, the head-count progress bar, "+4 hours" credit line, calendar download, "message the organiser", the round icons in front of each row, avatars and any other Stitch feature without an existing element. Stitch's icons come from an outside icon font, which the Content-Security-Policy does not allow; the existing inline status icon stays.

## Current code (facts)

- `app/szulo/feladatok/[id]/page.tsx` renders `section.parent-page > a (back link) , header (p.eyebrow, h1), dl.parent-detail-grid > div(dt, dd) x3 (Időpont, Helyszín, Állapot with StatusBadge), PendingRequestNotice (div.parent-notice.parent-pending-notice), ParentMutationForm signup (form.parent-form, button "Jelentkezem"), p.parent-notice (full / ineligible), nav.parent-page-actions (Cserekérelem, Lemondási kérelem links), section.parent-note-panel (allergen note), a second ParentMutationForm (textarea note, `form-hint`)`.
- `ParentMutationForm` shows the outcome in `div.parent-action-state.parent-action-state-<state>` (`role=status` on success, `alert` otherwise) above the fields; it is also used by the swap and cancellation pages (U4 owns the cancellation look and reuses what this unit styles).
- Specs that touch it (stay green): `parent-web.spec.ts` (signup success text "jelentkezés sikerült", contribution note), `functional-fixes.spec.ts` (back link text), `directory-coordination.spec.ts` and `notifications-import.spec.ts` (signup success state), `list-polish.spec.ts` and `navigation-polish.spec.ts`.
- Kept as they are: class names `parent-page`, `parent-detail-grid`, `parent-notice`, `parent-pending-notice`, `parent-action-state*`, `parent-form`, `parent-note-panel`, `parent-page-actions`, `form-hint`, `status-badge*`; every `data-testid`; 44px minimums; Hungarian copy.

## Steps

Ordering follows the Testing Contract: test-after, one layer at a time. Run `npm run lint:css` after every stylesheet step. Browser specs run against the local database, which is already running.

- [x] **Step 1: Project structure and configuration.** No new dependency, folder or setting. Confirm `npm run lint:css` and the unit-scoped commands in `unit-test-instructions.md` work from the U2 state.
- [x] **Step 2: Verify the existing test runner and record the unit-scoped commands.** Run the commands once before any change to prove they work.
- [x] **Step 3: Detail panel and status - implement (FR3.3).** Restyle `.parent-detail-grid` so the three facts read as one cream panel (`#fffaf1`, 1px sand border, 1rem radius, resting shadow) of rows, each row a small muted Karla label (`dt`, 600) above a larger value (`dd`, body), thin sand dividers between rows; no card inside a card (the grid cells lose their own border and background). The status value keeps its `StatusBadge` with icon and word, coloured as the U2 pill (reuse the same rule through a shared selector rather than copying colours). Page header: eyebrow, Vollkorn headline-lg title, back link as a quiet text link with at least 44px height. Keep the DOM order and the `data-testid`s; markup change only if a wrapper is needed for the panel.
- [x] **Step 4: Detail panel - write and run its tests.** `tests/browser/parent-detail-style.spec.ts` (new, calls `bindSeededSchema`): the panel background `#fffaf1`, radius 16px, no nested border on the rows, title Vollkorn and labels Karla, the status pill keeps icon and word and its text contrast is at least 4.5:1, the back link at least 44px, and the page has no horizontal scroll at 320 px with a long title. Run with `parent-web`, `functional-fixes` and `directory-coordination` specs.
- [x] **Step 5: Signup form and confirmation - implement (FR3.3).** Restyle `.parent-form` (scoped for this page so the swap and cancellation forms are reviewed, not silently changed: shared rules are allowed to change only where U4 will keep them), the primary "Jelentkezem" button as the shared pill, `.parent-action-state` so a success is a green wash (`--color-success-bg`) with a 0.35rem green left bar and a Vollkorn/Karla bold message, an error or conflict a terracotta bar on the danger wash, validation messages with their links, all with the existing roles (`status`, `alert`) and focus move. Keep the 44px minimum, the disabled "Feldolgozás folyamatban" state readable (not only grey), and the reduced-motion behaviour.
- [x] **Step 6: Signup and confirmation - write and run their tests.** Extend the new spec: after a real signup the confirmation (`signup-form-state-success`) is a `status` region with the green wash and bar and contrast of at least 4.5:1, the button is a pill of at least 44px, focus ring 3px `#1f4e79`; a refused attempt keeps the `alert` role and a terracotta bar. Run `parent-web`, `directory-coordination`, `notifications-import` specs unchanged.
- [x] **Step 7: Notices, actions and note panels - implement (FR3.3).** Restyle `.parent-notice` and `.parent-pending-notice` (left bar callout: info wash with `#1f4e79`-bar for neutral text, as today, terracotta for refusals), `.parent-page-actions` links (Cserekérelem, Lemondási kérelem) as outlined pill buttons with at least 44px height and no overflow when they wrap at 320 px, `.parent-note-panel` (the permitted allergen information, amber-tinted callout with a Vollkorn heading) and the contribution note form (label above the textarea, `form-hint` muted). No nested cards.
- [x] **Step 8: Notices and actions - write and run their tests.** Extend the new spec: a full or ineligible task shows its notice with the bar; the two action links are pill shaped, at least 44px, and wrap without sideways scroll at 320 px; the contribution form's label sits above its textarea; an axe scan of the detail page (available task, signed-up task with the actions and note form) finds no serious or critical violations. Run in Chromium and Firefox.
- [x] **Step 9: Environment and build.** Run Prettier on every touched file and the unit's gate set: lint, `lint:css`, format check, type check, unit tests with coverage, build, start smoke, and the browser specs named above (all three browsers in Build and Test). No coverage threshold is changed.
- [ ] **Step 10: Documentation and traceability.** Update `DESIGN.md` for the detail panel and confirmation look; write `code-summary.md`, `source-manifest.json`, `traceability.json`. Prepare screenshots at 320 px and 1280 px of: an open task's detail page, the signup confirmation, a signed-up task with the actions and note form, and a full/ineligible notice, for the owner check.

## Requirement trace

| Requirement | Step |
|---|---|
| FR3.3 | 3 to 8 |
| FR5.1 to FR5.6 | 3 to 8: Hungarian copy, test ids and class hooks unchanged; keyboard and focus ring and the focus move to messages; wrapping and no sideways scroll at 320; light mode and reduced motion; proved by the existing parent, signup and navigation specs plus the new spec |

## Owner check (gated)

The owner compares screenshots of the task detail page and the signup confirmation at 320 px and on desktop with the Stitch "Feladat Részletei" and "Sikeres Jelentkezés Visszaigazolása" screens. Stitch features listed above as not built are expected differences. U4 does not start until the owner approves.

## Risks

- `ParentMutationForm` and `.parent-form` are shared with the swap and cancellation pages; this unit may change the shared form and notice look, and U4 then restyles what is specific to cancellation. Mitigation: the screenshots for this unit include no cancellation page; U4 checks them, and the specs for the swap and cancellation pages run in this unit too (`parent-web`, `functional-fixes`).
- The signup success state replaces nothing on the page and is focus-managed; the style must not hide or move it off screen. Covered by the focus and role checks.
- Contrast: green on green wash, terracotta on danger wash and the pending pill are checked by the new spec and axe, not assumed.

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
