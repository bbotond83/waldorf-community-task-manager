# Unit Test Instructions: u3-task-details-signup

## Test framework and setup

- Browser tests: Playwright, config `playwright.config.ts`, files under `tests/browser/`. Unit tests: Vitest (`vitest.config.ts`), coverage thresholds 80/80/80 never lowered.
- Prerequisites: Node 24.x and npm 11.x (`.nvmrc`), `npm ci`, Playwright browsers installed, and the local backend running (`npm run db:start`, which needs Docker; the owner has acknowledged the firewall note for the exposed ports). Write `export PATH=...` before any `&&` chain.
- Test volume (Standard strategy): five to eight checks per component. This unit's components are the detail panel with its status, the signup form with its confirmation, and the notices, actions and note panels; about 7 new browser checks in one new spec, on top of the existing suite. No production TypeScript logic is added, so the unit-test coverage floor is kept by the existing suite staying green.

## Commands for this unit only

1. Runner ready (Step 2), before any change:

```bash
npx vitest run --config vitest.config.ts tests/unit/design-tokens.test.ts tests/unit/css-lint.test.ts
```

2. The stylesheet check, after every stylesheet step:

```bash
npm run lint:css
```

3. New spec for this unit (Steps 4, 6, 8; needs the database):

```bash
npx playwright test --config playwright.config.ts tests/browser/parent-detail-style.spec.ts
```

4. Existing specs that touch the detail page, signup, confirmation and the shared form and notice rules (must stay green, unchanged unless a measurement truly changes):

```bash
npx playwright test --config playwright.config.ts tests/browser/parent-web.spec.ts tests/browser/functional-fixes.spec.ts tests/browser/directory-coordination.spec.ts tests/browser/notifications-import.spec.ts tests/browser/parent-list-style.spec.ts tests/browser/list-polish.spec.ts tests/browser/visual-overhaul.spec.ts
```

Build and Test later runs the whole project (type check, lint, format check, coverage run, build, start smoke, all browser specs in the three browsers, dependency scan).

## What the new spec proves (`tests/browser/parent-detail-style.spec.ts`)

- Detail panel: cream `#fffaf1` background, 16px radius, rows without their own card border, Vollkorn title and Karla labels; back link at least 44px.
- Status pill keeps its icon and Hungarian word and its text contrast is at least 4.5:1.
- Signup: after a real signup, the confirmation is a `status` region with a green wash, a left bar and text contrast of at least 4.5:1; the button is a pill of at least 44px with a 3px `#1f4e79` focus ring; a refused attempt keeps the `alert` role and a terracotta bar.
- Notices (full, ineligible, pending request) keep their bars; the follow-up action links are pill shaped, at least 44px, and wrap without sideways scroll at 320 px; the contribution form's label sits above its textarea.
- No horizontal scroll at 320 px with a long Hungarian title (wraps, never clipped).
- Axe scan of the detail page in its main states: no serious or critical violations.

## Mocking and test data

No mocks. The spec uses the seeded accounts and helpers in `tests/browser/support` (`signInAs`, `world()`, `bindSeededSchema`); a signup is performed against the seeded database. No new data and no real credentials. Every browser spec calls `bindSeededSchema` (a unit test enforces it).

## Not run in this stage

WebKit and mobile-chrome, widths between 320 and 1280 px other than those named, the dependency scan and CI belong to Build and Test; they are recorded there, not claimed here. The owner's comparison with the Stitch screens is manual by team rule (no picture-comparison tests).
