# Code Generation Plan: Visual overhaul and UX fixes

## Summary

- Builds: Hungarian-aware role names, whole-card controls (profile chooser, parent task list, admin overview), kindergarten logo and cover photo, and a terracotta-led palette taken from the building photo.
- Touches: `app/globals.css`, `src/runtime/` (`ProfileSelector.tsx`, `AppShell.tsx`, new `BrandMark.tsx`, new `hyphenation.ts`), `app/szulo/feladatok/page.tsx`, `app/admin/page.tsx`, the three public pages, existing tests, user guide, and `public/brand/`.
- Tests: about 4 new test files plus updates to about 10 existing ones (unit, component, page-render and Playwright browser tests).

## Scope and Blast Radius

Zero-Unit work (bugfix scope, no Unit DAG). Source: `requirements.md` (FR1 to FR6, NFR1 to NFR6). No business rules, access rules, data flows, API routes or database code change. Applicable testable layer: Frontend behavior only (plus one small pure helper). The data model, repository and API layers are not touched and have no steps.

| File | Consumers / tests | Impact |
|---|---|---|
| `app/globals.css` | every page; axe `@a11y` specs on `/`, `/szulo/feladatok`, `/teacher/schedule`, `/admin/nyilvantartasok`, `/admin/import` | high (cross-cutting): colours and hyphenation change everywhere |
| `src/runtime/ProfileSelector.tsx` | `tests/integration/runtime-shell.test.tsx`, six Playwright specs via `profile-selector-<id>-button`, `HASZNALATI_UTMUTATO_HU.md` | medium |
| `src/runtime/AppShell.tsx` | 3 layouts (`app/szulo`, `app/admin`, `app/teacher`) and `app/page.tsx`, `runtime-shell.test.tsx`, teacher spec (`page.locator("form")` count 1) | medium |
| `app/szulo/feladatok/page.tsx` | `parent-web.spec.ts` (`duty-open-<id>`), `tests/coverage/parent-pages.test.tsx` | low |
| `app/admin/page.tsx` | `profile-login-measurement.ts` (dashboard ids), admin specs | medium |
| `app/belepes/page.tsx`, `app/meghivas/[token]/page.tsx`, `app/hozzaferes-megtagadva/page.tsx` | page-render tests | low |
| `tests/coverage/production-inventory.test.ts` | asserts an exact count of production files (151 today) | low, must be updated |

Rules kept: stable `data-testid` hooks stay wherever the element survives (`profile-selector-<id>-form/-input/-button`, `duty-card-<id>`, `duty-open-<id>`, `admin-dashboard-approvals/-records/-tasks`, `admin-dashboard-summary/-records-state/-tasks-state`); removed ids are `admin-dashboard-queue` and `admin-dashboard-queue-state`. Names and copy are Hungarian, identifiers English, colocated `*.test.ts` for domain-side code, no new remote origins (CSP `font-src 'self'`, `img-src 'self'`).

Commands need Node 24 and npm 11 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.

## Implementation Steps

- [ ] Step 1: Project structure and configuration skeleton. Confirm branch `feature/visual-overhaul`; confirm `public/brand/logo.png` (1237 px, transparent) and `public/brand/cover.jpg` (2048x1536) exist and are served by Next from `/brand/...`; `next.config.ts` needs no change (default image optimizer, local files). Do not commit anything.
- [ ] Step 2: Verify the test runner and record the baseline. Run the existing tests this change touches before editing anything and record pass counts: `node --experimental-strip-types --test src/runtime/*.test.ts`, `npx vitest run --config vitest.config.ts tests/integration/runtime-shell.test.tsx tests/coverage/parent-pages.test.tsx tests/coverage/production-inventory.test.ts tests/coverage/app-entrypoints.test.tsx`. The exact commands are in `unit-test-instructions.md`.
- [ ] Step 3: Frontend behavior, design tokens and styles - implement (FR1.1, FR1.3, FR6.1 to FR6.4, NFR1, NFR2, NFR3). In `app/globals.css`: sample dominant colours from `public/brand/cover.jpg` with a throwaway script outside the repo (roof terracotta, timber, wall ochre, garden green) and define tokens (`--color-primary`, `--color-primary-dark`, `--color-surface`, `--color-background`, `--color-accent-ochre`, `--color-success`, `--color-info-bg`, `--color-danger-bg`, focus ring) tuned to WCAG AA; replace the hard-coded `#eef6fb` and `#fff1ed`; replace `overflow-wrap: anywhere` on `h1, h2, p` with `hyphens: auto; overflow-wrap: break-word`; add card styles (`.profile-card` as a button, `.parent-card-link`, `.dashboard-link`, `.brand-link`, `.selector-hero`) with hover, pressed, `:focus-visible` states, 44 px targets, and 320 px layouts; keep the reduced-motion rule; use green for `.success-panel`. System fonts only.
- [ ] Step 4: Frontend behavior, design tokens - write and run tests. New `tests/unit/design-tokens.test.ts` reads `app/globals.css`, resolves the colour tokens and asserts WCAG contrast (text on background and surface at least 4.5:1, button text on primary at least 4.5:1, focus ring and borders at least 3:1) and that no hex colour appears outside `:root`.
- [ ] Step 5: Frontend behavior, role-name syllable breaks - implement (FR1.2). New `src/runtime/hyphenation.ts` exporting `withSyllableBreaks(text)`, a lookup of the four fixed role names to Hungarian syllables (Cso-port-ad-mi-niszt-rá-tor, Szu-per-ad-mi-niszt-rá-tor; Szülő and Óvónő unchanged) that joins syllables with U+00AD and returns unknown text untouched. Used only for visible headings; the hidden status text keeps the plain label.
- [ ] Step 6: Role-name syllable breaks - write and run tests. New `src/runtime/hyphenation.test.ts` (Node test runner): breaks occur only at the listed syllable boundaries, every segment has at least 2 letters, removing U+00AD gives back the original, unknown text is unchanged.
- [ ] Step 7: Frontend behavior, branding and profile chooser - implement (FR2, FR5, FR1.2). New `src/runtime/BrandMark.tsx` (`next/image` logo, alt "Cinkotai Waldorf Óvoda", explicit width and height, optional link to `/`). `ProfileSelector.tsx`: a hero with the cover photo (`next/image`, `alt=""`, `sizes`, fixed aspect ratio box with a token background so a failed load does not shift layout) and the logo (not a link on this page); each profile becomes `<form ...><input hidden ...><button type="submit" className="profile-card" data-testid="profile-selector-<id>-button">` containing the role name (with syllable breaks) and the scope summary; the "Profil használata" button is removed. `AppShell.tsx`: header gets `BrandMark` linking to `/`; hidden status text unchanged. `app/belepes/page.tsx`, `app/meghivas/[token]/page.tsx`, `app/hozzaferes-megtagadva/page.tsx`: `BrandMark` linking to `/` above the panel heading. `app/page.tsx` greeting uses the syllable-break text.
- [ ] Step 8: Branding and profile chooser - write and run tests. Update `tests/integration/runtime-shell.test.tsx` (card is one button whose accessible name holds role and summary, four buttons, form posts `profileId` to `/api/synthetic/session`, no "Profil használata", logo alt, cover decorative, hidden status keeps plain label); update `tests/coverage/app-entrypoints.test.tsx` if its markup assertions need it.
- [ ] Step 9: Frontend behavior, parent task list - implement (FR3). `app/szulo/feladatok/page.tsx`: each `li.parent-card` (keeps `data-testid="duty-card-<id>"`) holds one `<a className="parent-card-link" data-testid="duty-open-<id>">` wrapping the title (h2), date and status; the "Részletek" link is removed; the `?allapot=` query is kept.
- [ ] Step 10: Parent task list - write and run tests. Extend `tests/coverage/parent-pages.test.tsx`: one link per task with the title in it, the `?allapot=` filter kept in `href`, no "Részletek" text, no nested interactive element.
- [ ] Step 11: Frontend behavior, admin overview - implement (FR4). `app/admin/page.tsx`: three cards (`admin-dashboard-approvals`, `-records`, `-tasks`) become links to `/admin/jovahagyasok?state=pending`, `/admin/nyilvantartasok`, `/admin/feladatok`; the "Függőben lévő kérelmek" card and its facade call are removed; counts and `-summary`, `-records-state`, `-tasks-state` ids stay.
- [ ] Step 12: Admin overview - write and run tests. New `tests/coverage/admin-dashboard.test.tsx` (modelled on `tests/coverage/admin-pages.test.tsx`): three links with the right `href`, no queue card, counts rendered, approvals count equals the pending rows of the approvals list for the same fixture (FR4.3).
- [ ] Step 13: Browser tests - write and run. Update Playwright specs and `tests/browser/support/profile-login-measurement.ts` (label matching tolerant of soft hyphens; drop the queue assertion). Add: chooser card selects a profile by mouse and keyboard; no horizontal overflow and no broken role names at 320 and 375 px; admin overview card opens the pending approvals and the row count equals the card count; parent card opens the task detail; cover image is served resized (at most 150 KB at 375 px width, NFR4) and the page stays usable and stable when image requests are aborted (R-05). Run the touched specs on chromium and mobile-chrome after `npm run build`; the `@a11y` tests must stay free of serious or critical findings.
- [ ] Step 14: Environment and build configuration. Update `tests/coverage/production-inventory.test.ts` expected count for the two new production files; run `npm run lint`, `npm run format:check` (format first with Prettier where needed), `npm run typecheck`.
- [ ] Step 15: Documentation and traceability. Update `HASZNALATI_UTMUTATO_HU.md` (line 26 chooser step, line 97 task detail step); write `code-summary.md` (files, chosen hex values and contrast ratios, decisions, deviations) and `traceability.json`. Note in the summary that `public/brand/` is untracked and must be committed for CI and builds.
- [x] Step 16: Revision after review (requested by the person at the gate). (a) Track the brand assets: stage `public/brand/` in git with `git add public/brand/` (staging only, no commit; the person confirmed the images may be used in this internal kindergarten app). (b) R-04: use the explicit `.ts` extension for the `hyphenation` import in `app/page.tsx`. (c) R-03: keep the greeting `h1` in `app/page.tsx` plain text (no soft hyphens; CSS automatic hyphenation with `lang="hu"` still applies) and simplify the browser-test helper and assertions that tolerated soft hyphens in that heading; soft hyphens stay on the chooser card name. (d) R-02: the cover looks too soft at quality 45: serve it at the default quality 75 (keep `images.qualities` including 75, drop 45 if no longer used), and relax the NFR4 limit for the cover banner at 375 px width to at most 250 KB transferred; update the browser test that asserts the limit; record the new limit and measured size in `code-summary.md` as a deviation from the 150 KB figure in `requirements.md` (NFR4). Then re-run the affected tests (`tests/integration/runtime-shell.test.tsx`, `tests/coverage/app-entrypoints.test.tsx`, `tests/unit/design-tokens.test.ts`, `src/runtime/hyphenation.test.ts`), lint, format check, typecheck, `npm run build`, and the touched Playwright specs on chromium and mobile-chrome; update `code-summary.md` and `traceability.json` if targets change.

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
| FR1.1, FR1.3 | 3, 4 |
| FR1.2 | 5, 6, 7, 8 |
| FR2.1 to FR2.3 | 7, 8, 13 |
| FR3.1 to FR3.3 | 9, 10, 13 |
| FR4.1 to FR4.4 | 11, 12, 13 |
| FR5.1 to FR5.3 | 7, 8, 13, 15 |
| FR6.1 to FR6.4 | 3, 4, 13 |
| NFR1, NFR2 | 3, 4, 13 |
| NFR3 | 3, 4 |
| NFR4 | 7, 13 |
| NFR5 | 2, 14 |
| NFR6 | 8, 10, 12, 13, 14, 15 |
