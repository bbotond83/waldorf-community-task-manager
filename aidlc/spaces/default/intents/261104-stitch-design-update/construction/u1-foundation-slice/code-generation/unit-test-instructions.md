# Unit Test Instructions: u1-foundation-slice

## Test framework and setup

- Unit tests: Vitest with jsdom, config `vitest.config.ts`, files under `tests/unit/`. Coverage uses the Istanbul provider with thresholds of 80% for lines, branches and functions; these are never lowered.
- Browser tests: Playwright, config `playwright.config.ts`, files under `tests/browser/`. They need the local backend and the app built for tests.
- Prerequisites for the browser commands: Node 24.x and npm 11.x (`.nvmrc`), `npm ci`, `npx playwright install chromium firefox webkit` once, and the local backend running (`npm run db:start`). Write `export PATH=...` before any `&&` chain so every command uses the right Node version.
- Test volume (Standard strategy): five to eight checks per component. U1 components: the CSS check, the version pins, the fonts, the design tokens, and the sign-in page with its frame. New checks planned: about 12 (8 unit, 4 browser), on top of the existing suite.

## Commands for this unit only

Run each new or changed file by its exact path.

1. Runner ready (Step 2), before any new test exists:

```bash
npx vitest run --config vitest.config.ts tests/unit/design-tokens.test.ts
```

2. CSS check test (Step 3):

```bash
npx vitest run --config vitest.config.ts tests/unit/css-lint.test.ts
```

3. Version pins test (Step 1):

```bash
npx vitest run --config vitest.config.ts tests/unit/dependency-pins.test.ts
```

4. Fonts test (Step 5):

```bash
npx vitest run --config vitest.config.ts tests/unit/fonts.test.ts
```

5. Design tokens test, extended (Step 7):

```bash
npx vitest run --config vitest.config.ts tests/unit/design-tokens.test.ts
```

6. Browser: the new sign-in typography spec plus the existing specs that touch the frame and the sign-in page (Steps 5, 10, 12):

```bash
npx playwright test --config playwright.config.ts tests/browser/sign-in-typography.spec.ts tests/browser/identity.spec.ts tests/browser/visual-overhaul.spec.ts tests/browser/navigation-polish.spec.ts
```

7. The stylesheet check itself:

```bash
npm run lint:css
```

Build and Test later runs these commands for the whole project (type check, lint, format check, coverage run, build, start smoke, all browser specs in the three browsers, dependency scan).

## What each new test proves

- `tests/unit/dependency-pins.test.ts`: none of `react`, `react-dom`, `zod`, `@axe-core/playwright`, `@playwright/test` is `latest` or a range in `package.json`, and each equals the version in `package-lock.json`.
- `tests/unit/css-lint.test.ts`: `stylelint.config.mjs` exists and covers `app/globals.css`; the `lint:css` script is part of `verify:local` and the CI job; a deliberately broken sample is rejected; the dead class names (`selector-*`, `profile-grid`, `profile-card*`) are gone from the stylesheet.
- `tests/unit/fonts.test.ts`: every declared font file exists with `latin` and `latin-ext` coverage; each family ships its licence text; the layout wires both families; `proxy.ts` keeps `font-src 'self'` and names no outside font host.
- `tests/unit/design-tokens.test.ts` (extended): the new font-family and type-size variables exist; colour tokens stay in the `--name: #rrggbb` form inside `:root`; contrast pairs still pass.
- `tests/browser/sign-in-typography.spec.ts`: headings compute to Vollkorn and body to Karla; no request leaves the app origin for fonts; controls are at least 44px; focus ring is 3px `#1f4e79`; no sideways scroll at 320, 375 and 1280 px and at 200% zoom; long Hungarian words wrap; the page has no serious or critical axe violations.

## Mocking and test data

- No mocks. Unit tests read real files (`package.json`, `package-lock.json`, `app/globals.css`, `app/layout.tsx`, `proxy.ts`, `app/fonts/`).
- Browser tests use the existing seeded local accounts and helpers in `tests/browser/support`; no new data and no real credentials.

## Coverage target

At least 80% line, branch and function coverage across production source, as enforced by `vitest.config.ts`. This unit adds no production TypeScript logic beyond the font wiring in `app/layout.tsx`, so the floor is kept by the existing suite staying green.

## Not run in this stage

Cross-browser runs in Firefox and WebKit, the dependency scan, and CI itself belong to Build and Test; they are recorded there, not claimed here. The owner's visual comparison with the Stitch screen is a manual review and has no automated test, by team rule.
