# Unit Test Instructions: u5-approval-screens

## Test framework and setup

- Browser tests: Playwright, config `playwright.config.ts`, files under `tests/browser/`. Unit tests: Vitest (`vitest.config.ts`), coverage thresholds 80/80/80 never lowered.
- Prerequisites: Node 24.x and npm 11.x (`.nvmrc`), `npm ci`, Playwright browsers installed, and the local backend running (`npm run db:start`, which needs Docker; the owner has acknowledged the firewall note for the exposed ports). Write `export PATH=...` before any `&&` chain. Playwright serves the production build: run `npm run build` (with `APP_SESSION_SECRET`, `SUPABASE_URL=http://127.0.0.1:54321` and a placeholder `SUPABASE_ANON_KEY` exported) after source edits and before browser specs.
- Test volume (Standard strategy): five to eight checks per component. This unit's components are the teacher list and detail, and the admin approvals list, detail and decision form; about 8 new browser checks in two new specs, on top of the existing suite. No production TypeScript logic is added, so the unit-test coverage floor is kept by the existing suite staying green.

## Commands for this unit only

1. Runner ready (Step 2), before any change:

```bash
npx vitest run --config vitest.config.ts tests/unit/design-tokens.test.ts tests/unit/css-lint.test.ts tests/unit/fonts.test.ts
```

2. The stylesheet check, after every stylesheet step:

```bash
npm run lint:css
```

3. New specs for this unit (Steps 4, 5, 8; need the database):

```bash
npx playwright test --config playwright.config.ts tests/browser/teacher-style.spec.ts tests/browser/admin-approvals-style.spec.ts
```

4. Existing specs that touch the teacher and admin screens and shared rules (must stay green, unchanged unless a measurement truly changes):

```bash
npx playwright test --config playwright.config.ts tests/browser/teacher-web.spec.ts tests/browser/admin-core.spec.ts tests/browser/directory-coordination.spec.ts tests/browser/functional-fixes.spec.ts tests/browser/list-polish.spec.ts tests/browser/navigation-polish.spec.ts tests/browser/visual-overhaul.spec.ts tests/browser/parent-web.spec.ts
```

Build and Test later runs the whole project (type check, lint, format check, coverage run, build, start smoke, all browser specs in the three browsers, dependency scan).

## What the new specs prove

- `teacher-style.spec.ts`: table panel look, header cells, row link at least 44px; cards shown and the table hidden at 600 px and the reverse at 1280 px (the 44rem switch kept); Vollkorn titles; the detail panel; status text contrast at least 4.5:1; no sideways scroll at 320 px; axe on list and detail with no serious or critical findings.
- `admin-approvals-style.spec.ts`: list cards and the state pill (contrast at least 4.5:1); detail panel; decision form panel, controls at least 44px, 3px `#1f4e79` focus ring; a real decision shows a status region with the green wash and contrast at least 4.5:1; an invalid or refused decision keeps its alert role and terracotta bar; no sideways scroll at 320 px; axe on list and detail.

## Mocking and test data

No mocks. The specs use the seeded accounts and helpers in `tests/browser/support` (`signInAs`, `world()`, `bindSeededSchema`); a decision is made against the seeded database and every test reseeds first. No new data and no real credentials. Every browser spec calls `bindSeededSchema` (a unit test enforces it).

## Not run in this stage

WebKit and mobile-chrome for the new specs, widths between 320 and 1280 px other than those named, the dependency scan and CI belong to Build and Test; they are recorded there, not claimed here. The owner's comparison with the Stitch screens is manual by team rule (no picture-comparison tests).
