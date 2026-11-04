# Code Generation Plan: u2-parent-task-list

## Summary

- Builds: the Stitch look for the parent task list at `/szulo/feladatok`: task cards, the status filter, the status badge and the empty and "no match" states.
- Touches: `app/globals.css` (the parent list, filter, badge and state rules), small markup hooks in `app/szulo/feladatok/page.tsx` and `app/szulo/_components/ParentStatePanel.tsx` only where the style needs them, and one new browser spec.
- Tests: about 7 new browser checks (card, badge, filter, empty states, 320 px, accessibility) plus the existing suite kept green; the owner checks screenshots at 320 px and desktop.

## Scope and inputs

- Unit: `u2-parent-task-list` (kind `ui`, complexity M). Requirements: FR3.2, FR3.5, and FR5.1 to FR5.6 as "must not change" proof (`inception/units-generation/unit-of-work-story-map.md`). Depends on U1 (approved): fonts, named values and shared controls are used, not redefined.
- Decisions followed: ADR-002 (the existing parent list serves as "Saját vállalásaim"; the heading "Családi feladatok" stays; no new section, query or route), ADR-001 (one stylesheet).
- Functional Design is skipped for this unit; steps trace to FR IDs.
- Stitch references used: "Feladatok (Szülői nézet)", "Feladatok keresése és szűrése", "Szűrés: Nincs találat (Üres állapot)", "Saját vállalásaim" in `projects/14373287019289018119`.
- What the Stitch list shows that the app does not have, and is therefore NOT built (UI-only restyle, no new features): the greeting block, the "Elérhető feladatok / Saját vállalásaim" tab switch, category chips, task description, place and head-count lines, "Jelentkezem" buttons on cards, the bottom navigation bar and the footer note. Stitch's icons come from Google's Material Symbols web font; they are not added, because that is an outside font host (the Content-Security-Policy allows only self-hosted fonts). The existing inline status icons (`StatusBadge`) stay.
- What is built from the Stitch card: cream surface `#fffaf1`, 1rem radius, 1.25rem padding, resting shadow `0 12px 36px rgb(43 33 24 / 8%)` (`--shadow`), status shown as a pill at the card's top right area using the existing `StatusBadge` colours (positive: `#2f6b3a` on `#e8f3e6`; pending: `#a8661a` on `#f5ecd9`; negative: `#98452f` on `#fbe9e3`, with the text still paired with its icon), title in Vollkorn headline-sm (`--font-heading`), date in Karla body-sm, hover lifts 2px with terracotta border and `#f5ecd9` wash, pressed state flush with `#fbe9e3`, reduced motion removes the lift.

## Current code (facts)

- Markup: `app/szulo/feladatok/page.tsx` renders `section.parent-page > header, form.parent-filter (.filter-field select + .filter-actions button), ul.parent-collection > li.parent-card > a.parent-card-link (h2, p, StatusBadge strong.parent-state-badge)`; empty states are `p[data-testid="duties-filter-empty"]` ("Nincs találat.") and `ParentStatePanel` (`section.parent-state`, `role=status|alert`).
- Specs that touch it (stay green): `parent-web.spec.ts`, `visual-overhaul.spec.ts` (whole card clickable), `list-polish.spec.ts` (labels above fields at 320 and 1280, filter row alignment, filter options, `.parent-state-badge`, badge icon visible), `functional-fixes.spec.ts`.
- Kept as they are: class names `parent-page`, `parent-filter`, `filter-field`, `filter-actions`, `parent-collection`, `parent-card`, `parent-card-link`, `parent-state-badge`, `parent-state`, `status-badge*`; every `data-testid`; the 44px minimums; the select height 2.9rem and the button height rule in `.filter-actions`.

## Open points

- Browser specs need the local database (Docker). In U1 they could not run. Before Step 6 the owner is asked to start Docker (`npm run db:start`) so the existing and new browser specs run for real; if Docker stays off, they are reported as outstanding evidence, not as passed.
- Carried from review: confirm at screenshot review that `/szulo/feladatok` shows the family's own signups, so it can stand in for "Saját vállalásaim" (ADR-002).

## Steps

Ordering follows the Testing Contract: test-after, one layer at a time. Run the CSS check (`npm run lint:css`) after every stylesheet step.

- [x] **Step 1: Project structure and configuration.** No new dependency, folder or setting. Confirm `npm run lint:css` and the unit-scoped commands in `unit-test-instructions.md` work from the U1 state.
- [x] **Step 2: Verify the existing test runner and record the unit-scoped commands.** Run the commands once before any change to prove they work (browser commands only if the database is up).
- [x] **Step 3: Task cards and status badge - implement (FR3.2).** In `app/globals.css` restyle `.parent-card`, `.parent-card-link`, `.parent-card h2`, `.parent-state-badge` and `.status-badge` as described above, using the named values from U1 (`--font-heading`, `--font-body`, `--text-*`, `--shadow`, `--shadow-hover`, `--radius`, `--radius-pill`, colour tokens only, no new hex outside `:root`). Keep the whole card clickable and the link at least 44px tall. Markup change allowed only to place the badge (for example a header row inside `.parent-card-link`); the `h2`, the date paragraph and the badge keep their order for screen readers and their test ids.
- [x] **Step 4: Cards and badge - write and run their tests.** `tests/browser/parent-list-style.spec.ts` (new): card background `#fffaf1`, radius 16px, title computed to Vollkorn, date to Karla, badge is pill shaped with its icon visible, card link at least 44px tall, hover raises the card by 2px, and under `prefers-reduced-motion: reduce` it does not move. Run it together with `parent-web.spec.ts`, `visual-overhaul.spec.ts` and `functional-fixes.spec.ts`.
- [x] **Step 5: Status filter - implement (FR3.2).** Restyle `.parent-filter`, `.filter-field`, `.filter-field label`, `.filter-field select` and `.filter-actions` to the Stitch panel: cream surface, 1px sand border, 1rem radius, label above the field in Karla 600, select 44px minimum with the existing 2.9rem height, sand/strong border and cream fill, the "Szűrés" button as the shared primary pill at the same height as the select. The shared `.filter-field` and `.filter-actions` rules are also used by admin and teacher lists; change them only in ways that keep those lists' alignment, and scope anything parent-specific under `.parent-filter`.
- [x] **Step 6: Filter - write and run its tests.** Extend `tests/browser/parent-list-style.spec.ts`: label above the select at 320 and 1280 px, select and button at least 44px, button and select bottoms aligned, focus ring on the select is 3px `#1f4e79`. Run `list-polish.spec.ts` unchanged (it covers the same rows on the admin and teacher lists, which must not shift).
- [x] **Step 7: Empty and "no match" states - implement (FR3.5).** Restyle `.parent-state` (and the `duties-filter-empty` paragraph, giving it a small class hook such as `parent-empty` only if the style needs one) to the Stitch empty state: cream panel, 0.35rem left bar in terracotta for errors and in `#1f4e79`/sand for neutral notices as today, Vollkorn heading, short Karla text, room around it, no nested card. Hungarian copy ("Nincs találat.", "Nincs megjeleníthető elem", "Nincs kapcsolt feladat.", error messages) is not changed.
- [x] **Step 8: Empty states - write and run their tests.** Extend the new spec: filtering to a state with no duties shows the "Nincs találat." state with the expected panel style; the neutral `status` state and the error `alert` state keep their roles and bar colours; no horizontal scroll at 320 px with a long Hungarian task title (it wraps, never cut off); an axe scan of the list and of the empty-filter state finds no serious or critical violations. Run the new spec in Chromium and Firefox.
- [x] **Step 9: Environment and build.** Run Prettier on every touched file and the unit's gate set: lint, `lint:css`, format check, type check, unit tests with coverage, build, start smoke, and the unit's browser specs (all three browsers in Build and Test). No coverage threshold is changed.
- [ ] **Step 10: Documentation and traceability.** Note any new class hook or changed rule in `DESIGN.md` only if the described look changed; write `code-summary.md`, `source-manifest.json`, `traceability.json`. Prepare screenshots at 320 px and 1280 px of: the list with several statuses, the filter panel, the "Nincs találat." state, and the family's own signups, for the owner check.

## Requirement trace

| Requirement | Step |
|---|---|
| FR3.2 | 3, 4, 5, 6 |
| FR3.5 | 7, 8 |
| FR5.1 to FR5.6 | 3 to 8: Hungarian copy, test ids and class hooks unchanged; keyboard and focus ring; wrapping and no sideways scroll at 320; confirmation flows untouched; light mode and reduced motion; proved by the existing parent, list and navigation specs plus the new spec |

## Owner check (gated)

The owner compares screenshots of the parent task list at 320 px and on desktop with the Stitch "Feladatok (Szülői nézet)", "Feladatok keresése és szűrése", "Szűrés: Nincs találat" and "Saját vállalásaim" screens. Stitch features listed above as not built are expected differences. U3 does not start until the owner approves.

## Risks

- Shared filter rules: changes to `.filter-field` or `.filter-actions` can shift admin and teacher lists; mitigated by scoping under `.parent-filter` and by running `list-polish.spec.ts` unchanged.
- Contrast: badge colours on the new card surface are checked by axe and by the token test; only a failing colour is darkened.
- Specs that measure sizes can break with padding changes; the browser specs are run after Steps 3, 5 and 7.

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
