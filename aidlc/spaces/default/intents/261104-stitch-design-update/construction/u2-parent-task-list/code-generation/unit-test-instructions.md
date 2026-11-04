# Unit Test Instructions: u2-parent-task-list

## Test framework and setup

- Browser tests: Playwright, config `playwright.config.ts`, files under `tests/browser/`. Unit tests: Vitest (`vitest.config.ts`), coverage thresholds 80/80/80 never lowered.
- Prerequisites: Node 24.x and npm 11.x (`.nvmrc`), `npm ci`, `npx playwright install chromium firefox webkit` once, and the local backend running: `npm run db:start` needs Docker running. Write `export PATH=...` before any `&&` chain.
- Test volume (Standard strategy): five to eight checks per component. This unit's components are the task card with its badge, the status filter, and the empty states; about 7 new browser checks in one new spec, on top of the existing suite. This unit adds no production TypeScript logic, so the unit-test coverage floor is kept by the existing suite staying green.

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
npx playwright test --config playwright.config.ts tests/browser/parent-list-style.spec.ts
```

4. Existing specs that touch the parent list and the shared filter rules (must stay green, unchanged unless a measurement truly changes):

```bash
npx playwright test --config playwright.config.ts tests/browser/parent-web.spec.ts tests/browser/visual-overhaul.spec.ts tests/browser/list-polish.spec.ts tests/browser/functional-fixes.spec.ts
```

Build and Test later runs the whole project (type check, lint, format check, coverage run, build, start smoke, all browser specs in the three browsers, dependency scan).

## What the new spec proves (`tests/browser/parent-list-style.spec.ts`)

- Card: background `#fffaf1`, radius 16px, title in Vollkorn, date in Karla, whole card clickable, link at least 44px tall; hover lifts 2px and under reduced motion it does not move.
- Status badge: pill shape, icon visible and paired with the Hungarian status word.
- Filter: label above the select at 320 and 1280 px, select and button at least 44px and bottom-aligned, focus ring on the select 3px `#1f4e79`.
- Empty and "no match" states: "Nincs találat." panel style and roles (`status`, `alert`) kept.
- No horizontal scroll at 320 px with a long Hungarian title (wraps, never clipped).
- Axe scan of the list and of the empty-filter state: no serious or critical violations.

## Mocking and test data

No mocks. The spec uses the seeded accounts and helpers in `tests/browser/support` (`signInAs`, `world()`, `bindSeededSchema`); no new data, no real credentials. Each browser spec must call `bindSeededSchema` (a unit test enforces it).

## Not run in this stage

If Docker is not running, none of the browser commands above can run; they are then recorded as outstanding evidence, never as passed. WebKit and the full three-browser run, the dependency scan and CI belong to Build and Test. The owner's comparison with the Stitch screens is manual by team rule (no picture-comparison tests).
