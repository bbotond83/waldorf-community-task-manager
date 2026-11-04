# Code Generation Plan: u4-cancellation

## Summary

- Builds: the Stitch look for the parent cancellation request page: the page header, the reason form, its hint, the "already requested" and "not cancellable" states, and the confirmation that names the affected task.
- Touches: `app/globals.css` (only what is specific to the cancellation page; the shared form and notice rules from U3 are reused, not redefined), small class hooks in `app/szulo/feladatok/[id]/lemondas/page.tsx` where the style needs them, `DESIGN.md`, and one new browser spec. The swap (`csere`) page shares the same form and notice rules, so it is looked at, not restyled.
- Tests: about 6 new browser checks (page header, reason form, confirmation, ineligible state, 320 px, accessibility) plus the existing suite kept green; the owner checks screenshots at 320 px and desktop.

## Scope and inputs

- Unit: `u4-cancellation` (kind `ui`, complexity S). Requirements: FR3.4 (cancellation form and confirmation) and FR5.1 to FR5.6 as "must not change" proof. Depends on U3 (approved): it reuses the form, notice and action-state rules and the outlined pill link style.
- Decisions followed: ADR-001 (one stylesheet), ADR-004 (screen groups). Functional Design is skipped; steps trace to FR IDs.
- Stitch references used: "Feladat lemondása / módosítása" and "Lemondás Megerősítése" in `projects/14373287019289018119`. Read the two screenshots before styling. Stitch features with no element in the app are not built (for example a multi-option "modify" choice, avatars, round icons, calendar or message buttons, progress or credit lines); the Content-Security-Policy does not allow Stitch's outside icon font, so the existing inline icons stay.
- Also check (not restyle): the swap request page `/szulo/feladatok/[id]/csere`, which uses the same form and notice rules U3 changed. Take screenshots at 320 px and 1280 px; if anything is broken (overflow, contrast, lost spacing), fix it with the narrowest change and say so in the summary.

## Current code (facts)

- `app/szulo/feladatok/[id]/lemondas/page.tsx` renders `section.parent-page[data-testid=cancellation-request-page] > a (back link, `cancellation-back-link`), h1 "Lemondási kérelem" (tabIndex -1), ParentStatePanel > ParentMutationForm (form.parent-form, hidden inputs, label "Indoklás", textarea `cancellation-reason-input`, `p.form-hint#reason-hint`, submit "Lemondási kérelem elküldése")` with `afterSuccess` = `PendingRequestPanel` (`cancellation-pending-panel`, the confirmation naming the task); or `p[data-testid=cancellation-ineligible-state]` when the family has no cancellable assignment.
- The back link here is a bare `a` (the detail page got `parent-back-link`), and the page has no `parent-detail-header`: the header look should match the detail page without duplicating rules.
- Specs that touch it (stay green): `parent-web.spec.ts`, `functional-fixes.spec.ts`, `directory-coordination.spec.ts`, `parent-detail-style.spec.ts` (pending-cancellation pill and the follow-up links on the detail page).
- Kept as they are: class names `parent-page`, `parent-form`, `parent-notice`, `parent-pending-notice`, `parent-action-state*`, `form-hint`; every `data-testid`; 44px minimums; Hungarian copy; the focus move to messages and the `role=status` / `role=alert` behaviour.

## Steps

Ordering follows the Testing Contract: test-after, one layer at a time. Run `npm run lint:css` after every stylesheet step. Browser specs run against the local database, which is already running.

- [x] **Step 1: Project structure and configuration.** No new dependency, folder or setting. Confirm `npm run lint:css` and the unit-scoped commands in `unit-test-instructions.md` work from the U3 state.
- [x] **Step 2: Verify the existing test runner and record the unit-scoped commands.** Run the commands once before any change to prove they work.
- [x] **Step 3: Cancellation page header and reason form - implement (FR3.4).** Give the page the same header look as the detail page by adding the existing `parent-back-link` class to the back link (no new rule) and a Vollkorn headline-lg `h1`; style the reason form through the shared `.parent-form` rules (cream panel, 1rem gap, label above the textarea, muted `form-hint`), with a cancellation-specific rule only where needed (for example the textarea minimum height of 7rem and a destructive-but-calm submit pill in the shared primary colour, not red). Keep DOM order, test ids and Hungarian copy.
- [x] **Step 4: Header and form - write and run their tests.** `tests/browser/parent-cancellation-style.spec.ts` (new, calls `bindSeededSchema`): the back link at least 44px, the title in Vollkorn, the form panel background `#fffaf1` with radius, the label above the textarea, the textarea at least 44px tall with a 3px `#1f4e79` focus ring, the submit button a pill of at least 44px, and no horizontal scroll at 320 px. Run with `parent-web` and `functional-fixes`.
- [x] **Step 5: Confirmation and states - implement (FR3.4).** Style the confirmation after a real request: `PendingRequestPanel` in the cancellation page shows the pending notice naming the task with the info wash and blue bar (reuse U3's `.parent-pending-notice`), and the success action state keeps the green wash and `role=status`. The "already requested" state and the ineligible paragraph read as a quiet callout (info wash with the left bar), not bare text. Follow-up links (back to the task) are the outlined pills from U3.
- [x] **Step 6: Confirmation and states - write and run their tests.** Extend the new spec: after a real cancellation request the confirmation is a `status` region with the green wash and text contrast of at least 4.5:1 and the pending panel names the task and keeps its link at least 44px; the ineligible state (a task the family has not signed up for) has the bar and contrast of at least 4.5:1; an axe scan of the form and of the confirmation finds no serious or critical violations. Run in Chromium and Firefox.
- [x] **Step 7: Swap page check - verify, change only if broken.** Open `/szulo/feladatok/[id]/csere` (and the swap-request board `/szulo/cserek` if reachable from it) at 320 px and 1280 px, with the form, a success state and a refusal. If a shared rule from U3 broke it, fix it with the narrowest change. Add one assertion to the new spec that the swap form has no sideways scroll at 320 px and its submit button is at least 44px.
- [x] **Step 8: Environment and build.** Run Prettier on every touched file and the unit's gate set: lint, `lint:css`, format check, type check, unit tests with coverage, build, start smoke, and the browser specs named above (all three browsers in Build and Test). No coverage threshold is changed.
- [ ] **Step 9: Documentation and traceability.** Update `DESIGN.md` for the cancellation page; write `code-summary.md`, `source-manifest.json`, `traceability.json`. Prepare screenshots at 320 px and 1280 px of: the cancellation form, the confirmation, the ineligible state, and the swap page, for the owner check.

## Requirement trace

| Requirement | Step |
|---|---|
| FR3.4 | 3 to 7 |
| FR5.1 to FR5.6 | 3 to 7: Hungarian copy, test ids and class hooks unchanged; keyboard and focus ring and the focus move to messages; wrapping and no sideways scroll at 320; light mode and reduced motion; proved by the existing parent specs plus the new spec |

## Owner check (gated)

The owner compares screenshots of the cancellation form and its confirmation at 320 px and on desktop with the Stitch "Feladat lemondása / módosítása" and "Lemondás Megerősítése" screens; Stitch features listed above as not built are expected differences. U5 does not start until the owner approves.

## Risks

- The form and notice rules are shared with the detail and swap pages; a cancellation-only tweak must be scoped by the page's test id or a new class on its own markup, never by loosening a shared rule.
- The cancellation success state replaces nothing and is focus-managed; the style must not hide or move it. Covered by the focus and role checks.
- Contrast: green on green wash and the ineligible callout are checked by the new spec and axe, not assumed. Ochre is never used for text (3.9:1 on the info wash).

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
