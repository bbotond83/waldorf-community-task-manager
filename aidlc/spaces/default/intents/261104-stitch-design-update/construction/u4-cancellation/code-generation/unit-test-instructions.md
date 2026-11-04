# Unit Test Instructions: u4-cancellation

## Test framework and setup

- Browser tests: Playwright, config `playwright.config.ts`, files under `tests/browser/`. Unit tests: Vitest (`vitest.config.ts`), coverage thresholds 80/80/80 never lowered.
- Prerequisites: Node 24.x and npm 11.x (`.nvmrc`), `npm ci`, Playwright browsers installed, and the local backend running (`npm run db:start`, which needs Docker; the owner has acknowledged the firewall note for the exposed ports). Write `export PATH=...` before any `&&` chain.
- Test volume (Standard strategy): five to eight checks per component. This unit's components are the cancellation header and form, and the confirmation with its states; about 6 new browser checks in one new spec, on top of the existing suite. No production TypeScript logic is added, so the unit-test coverage floor is kept by the existing suite staying green.

## Commands for this unit only

1. Runner ready (Step 2), before any change:

```bash
npx vitest run --config vitest.config.ts tests/unit/design-tokens.test.ts tests/unit/css-lint.test.ts
```

2. The stylesheet check, after every stylesheet step:

```bash
npm run lint:css
```

3. New spec for this unit (Steps 4, 6, 7; needs the database):

```bash
npx playwright test --config playwright.config.ts tests/browser/parent-cancellation-style.spec.ts
```

4. Existing specs that touch the cancellation and swap pages and the shared form and notice rules (must stay green, unchanged unless a measurement truly changes):

```bash
npx playwright test --config playwright.config.ts tests/browser/parent-web.spec.ts tests/browser/functional-fixes.spec.ts tests/browser/directory-coordination.spec.ts tests/browser/notifications-import.spec.ts tests/browser/parent-detail-style.spec.ts tests/browser/parent-list-style.spec.ts tests/browser/list-polish.spec.ts tests/browser/visual-overhaul.spec.ts
```

Build and Test later runs the whole project (type check, lint, format check, coverage run, build, start smoke, all browser specs in the three browsers, dependency scan).

## What the new spec proves (`tests/browser/parent-cancellation-style.spec.ts`)

- Header and form: back link at least 44px, Vollkorn title, cream `#fffaf1` form panel with radius, label above the textarea, textarea and submit button at least 44px, 3px `#1f4e79` focus ring, submit button a pill.
- Confirmation: after a real cancellation request the confirmation is a `status` region with the green wash and text contrast of at least 4.5:1, the pending panel names the task and its link is at least 44px.
- Ineligible state: bar and text contrast of at least 4.5:1.
- No horizontal scroll at 320 px on the cancellation page and on the swap page; the swap form's submit button is at least 44px.
- Axe scan of the form and of the confirmation: no serious or critical violations.

## Mocking and test data

No mocks. The spec uses the seeded accounts and helpers in `tests/browser/support` (`signInAs`, `world()`, `bindSeededSchema`); a cancellation request is made against the seeded database. No new data and no real credentials. Every browser spec calls `bindSeededSchema` (a unit test enforces it).

## Not run in this stage

WebKit and mobile-chrome, widths between 320 and 1280 px other than those named, the dependency scan and CI belong to Build and Test; they are recorded there, not claimed here. The owner's comparison with the Stitch screens is manual by team rule (no picture-comparison tests).
