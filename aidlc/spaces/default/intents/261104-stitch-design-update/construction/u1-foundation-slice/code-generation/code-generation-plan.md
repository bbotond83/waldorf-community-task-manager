# Code Generation Plan: u1-foundation-slice

## Summary

- Builds: the CSS check and version pins first, then Vollkorn and Karla fonts, shared named style values and controls, the page frame and the sign-in page, and the updated `DESIGN.md`.
- Touches: `package.json`, a new Stylelint config, `app/layout.tsx`, `app/globals.css`, new `app/fonts/` (font files and licence texts), `DESIGN.md`, and the CI/verify scripts that run lint.
- Tests: about 12 new automated checks (unit and browser), plus the existing suite kept green; the owner checks the sign-in page and page frame by screenshot.

## Scope and inputs

- Unit: `u1-foundation-slice` (kind `ui`, complexity L). Requirements covered: FR1.1 to FR1.4, FR2.1 to FR2.4, FR3.1, FR4.1, FR6.1 to FR6.3, and FR5.1 to FR5.6 as "must not change" proof (from `inception/units-generation/unit-of-work-story-map.md`).
- Decisions followed: ADR-001 one stylesheet, ADR-003 first slice is the sign-in page plus the page frame, ADR-004 split by screen group (`inception/domain-design/decisions.md`).
- Functional Design, NFR and infrastructure stages are skipped for this unit, so there are no design files to read. No user stories exist; steps trace to FR IDs.
- Finding that shapes the work: the app's 16 colour tokens already equal the Stitch palette (`#f8f0e3`, `#fffaf1`, `#98452f`, `#6f2f1f`, `#a8661a`, `#1f4e79`, and so on). The visible change in this unit is therefore mostly the type (Vollkorn headings, Karla body), the shared control shapes and the frame, not new colours. Colour tokens are kept as `--name: #rrggbb` in `:root`, as `tests/unit/design-tokens.test.ts` requires.
- Stitch values used (from project `projects/14373287019289018119`): headlines Vollkorn 600/700, body Karla 400, labels Karla 600/700, eyebrow 0.82rem with 0.08em tracking, card radius 1rem, pill radius 999px, content column `min(72rem, 100% - 2rem)`, focused flows 48rem, focus ring 3px `#1f4e79` with 3px offset, resting card shadow `0 12px 36px rgba(43,33,24,0.08)`.

## Open permission

Fonts are downloaded files. Before Step 3 runs, the owner is asked for explicit permission, with the file names, source and size. Source planned: the `@fontsource` npm packages for Vollkorn and Karla at one pinned version each, used only to copy the `latin` and `latin-ext` WOFF2 files (latin-ext carries the Hungarian letters ő and ű). Nothing is downloaded before that answer.

## Steps

Ordering follows the Testing Contract: test-after, one layer at a time. The CSS check comes first so the stylesheet is checked before it is rewritten.

- [x] **Step 1: Pin the five floating versions (FR6.2).** In `package.json` replace `latest` for `react`, `react-dom`, `zod`, `@axe-core/playwright` and `@playwright/test` with the installed versions (19.2.8, 19.2.8, 4.6.7, 4.13.0, 1.62.1, read from `package-lock.json` at build time). Run `npm install` so the lock file agrees; confirm nothing else moved. Covers FR6.2.
- [x] **Step 2: Verify the existing test runner and record the unit-scoped commands.** Vitest (`vitest.config.ts`) and Playwright (`playwright.config.ts`) already exist; run the commands in `unit-test-instructions.md` once to prove they work before any new test is added.
- [x] **Step 3: Add the CSS check, then its test (FR6.1).** Add `stylelint` and `stylelint-config-standard` (exact versions), a `stylelint.config.mjs` that reads `app/globals.css`, and a `lint:css` script. Wire `lint:css` into the blocking checks next to `lint` (the `verify:local` run and the CI job). Rules are chosen so the current stylesheet passes without mass rewrites; any rule that needs a rewrite is listed in `code-summary.md`. Write `tests/unit/css-lint.test.ts`: the config exists, `lint:css` is wired into `verify:local` and `ci.yml`, and a deliberately broken sample (duplicate property, unknown property) is rejected. Covers FR6.1.
- [x] **Step 4: Self-hosted fonts - implement (FR1.1 to FR1.4).** After the owner's download permission: add `app/fonts/` with Vollkorn (600, 700) and Karla (400, 600, 700) `latin` and `latin-ext` WOFF2 files and each family's OFL licence text. In `app/layout.tsx` load them with `next/font/local`, expose them as CSS variables on `<html>`, and keep `lang="hu"`. No CSP change is needed (`font-src 'self'` already allows them). Use `display: swap` with a system-font fallback so text is never hidden while loading.
- [x] **Step 5: Fonts - write and run their tests.** `tests/unit/fonts.test.ts`: each declared file exists; each family has a licence file; the layout wires both families; `proxy.ts` still has `font-src 'self'` and no external font host; the stylesheet names no `fonts.googleapis.com`. Browser check (in `tests/browser/sign-in-typography.spec.ts`): after load, the sign-in `h1` computes to Vollkorn and body text to Karla, and the page makes no request to a host other than the app.
- [x] **Step 6: Named values in `app/globals.css` - implement (FR2.1, FR2.2).** Add named values for the heading and body font families and for the main type sizes (headline XL/LG/MD/SM, body, label, eyebrow), keep the 16 colour tokens as `--name: #rrggbb`, add `--shadow` and `--radius` to match the Stitch card values. Replace the repeated literals in the base rules with them. Darken a colour only if it fails contrast (4.5 to 1 for text, 3 to 1 for large text and controls); the existing palette is expected to pass.
- [x] **Step 7: Named values - write and run their tests.** Extend `tests/unit/design-tokens.test.ts` to check the new font-family and type-size variables exist, that colour tokens are still `--name: #rrggbb`, and that the text/surface pairs still meet contrast. Run the whole file.
- [x] **Step 8: Shared controls - implement (FR2.3, FR2.4).** Restyle in `app/globals.css`: primary button, secondary button and `.button-link` variants (pill, 44px minimum, hover to `#6f2f1f`, pressed down 1px), text links, form fields and labels (44px minimum, cream fill, sand border), focus ring (3px `#1f4e79`, 3px offset), the card hover and pressed states, and reduced-motion handling (transforms off under `prefers-reduced-motion: reduce`). Class names, test ids and measured sizes the specs use stay as they are.
- [x] **Step 9: Remove dead styles (FR4.1).** Delete the unused `.selector-page`, `.selector-heading`, `.selector-hero`, `.selector-cover`, `.profile-grid`, `.profile-card`, `.profile-card-name`, `.profile-card-summary` rules (about lines 107 to 240; `.selector-*` and `.profile-*` appear nowhere in `app/` or `src/`). Keep `.centered-panel`, `.app-shell`, `.eyebrow`, `.brand-*` and the shared hover/pressed selectors for live classes. `tests/unit/browser-harness.test.ts` only mentions a `profile-selector-*` pattern as a banned string, so it stays valid.
- [x] **Step 10: Shared controls - write and run their tests.** In `tests/browser/sign-in-typography.spec.ts` (and by running the existing `visual-overhaul.spec.ts` and `identity.spec.ts` unchanged): the primary button is at least 44px tall and pill-shaped, the sign-in fields are at least 44px, the focus ring is 3px `#1f4e79` after a Tab press, and no horizontal scroll at 320px. `tests/unit/css-lint.test.ts` also asserts the dead class names are gone from the stylesheet (regression for FR4.1).
- [x] **Step 11: Page frame and sign-in page - implement (FR3.1, FR2.x in context).** Restyle the frame (skip link, header, brand mark, role menu, page container `min(72rem, 100% - 2rem)`, ambient top-left terracotta glow on the parchment base) and the sign-in page (`app/bejelentkezes/page.tsx`, `SignInForm.tsx`, `.centered-panel` at 48rem with the Vollkorn heading, eyebrow and Karla fields). Markup changes are limited to what the style needs; Hungarian copy from `COPY` is not changed, and test ids (`sign-in-page`, `sign-in-skip-link`, `sign-in-forgot-link`) stay. The other centred panels (access denied, password reset, invitation) pick up the shared look through `.centered-panel` only.
- [x] **Step 12: Page frame and sign-in page - write and run their tests.** Browser tests for the sign-in page at 320, 375 and 1280 px (and 200% zoom): no horizontal overflow, long Hungarian words wrap rather than clip, skip link first in Tab order and visible on focus, heading holds focus on load, light mode only. An axe scan of the sign-in page must report no serious or critical violations. The existing specs for identity, navigation and the parent/teacher/admin frames must stay green; where a measurement truly changes, the matching spec changes in this same unit and the change is listed in `code-summary.md`.
- [x] **Step 13: Update `DESIGN.md` (FR6.3).** Replace the "No webfonts" statement with the self-hosted Vollkorn and Karla description, the named values, and the Stitch project reference; keep the file's other sections accurate to the code. Documentation only; checked by Prettier through the existing format check.
- [ ] **Step 14: Environment, build and traceability.** Run Prettier on every touched file, then the unit's full gate set (type check, lint, `lint:css`, format check, unit tests with coverage, build, start smoke, the unit's browser specs). Write `code-summary.md`, `source-manifest.json` and `traceability.json`. Prepare desktop and 320px screenshots of the sign-in page and page frame for the owner check.

## Requirement trace

| Requirement | Step |
|---|---|
| FR1.1 to FR1.4 | 4, 5 |
| FR2.1, FR2.2 | 6, 7 |
| FR2.3, FR2.4 | 8, 10 |
| FR3.1 | 11, 12 |
| FR4.1 | 9, 10 |
| FR5.1 to FR5.6 | 8, 10, 11, 12 (existing specs stay green; Hungarian copy, test ids, focus behaviour, wrapping, light mode and reduced motion are asserted again on the sign-in page) |
| FR6.1 | 3 |
| FR6.2 | 1 |
| FR6.3 | 13 |

## Owner check (gated)

The owner compares the sign-in page and the page frame, at 320 px and on desktop, with the Stitch "Bejelentkezés és Profilválasztó" screen using screenshots from the assistant. U2 does not start until the owner approves. Open point carried from review: whether this check also includes a small sample of shared controls (cards, badges, filter fields); the plan includes buttons, links and form fields, and leaves cards, badges and filter fields for U2 unless the owner asks.

## Risks

- Contrast: Stitch's surface and text colours match the current palette, so no failure is expected; if axe or the token test reports one, only the failing colour is darkened.
- Stylesheet rewrite breaks a spec that measures sizes: mitigated by running the browser specs after each of Steps 8, 9 and 11, not only at the end.
- Font files add page weight: only the two weights per family that the design uses, `latin` and `latin-ext` only.

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
