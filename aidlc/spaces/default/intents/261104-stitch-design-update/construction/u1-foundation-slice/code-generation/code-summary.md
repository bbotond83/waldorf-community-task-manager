# Code Summary: u1-foundation-slice

## Files created, modified and deleted

- Created: `stylelint.config.mjs`; `app/fonts/` (four WOFF2 files for Vollkorn and Karla, latin and latin-ext, plus two OFL licence texts); `tests/unit/css-lint.test.ts`, `tests/unit/dependency-pins.test.ts`, `tests/unit/fonts.test.ts`; `tests/browser/sign-in-typography.spec.ts`.
- Modified: `package.json`, `package-lock.json`, `app/layout.tsx`, `app/globals.css`, `DESIGN.md`, `scripts/verification/run-local-verification.ts`, `tests/unit/design-tokens.test.ts`, `tests/coverage/app-entrypoints.test.tsx`.
- Deleted: nothing. The dead `.selector-*`, `.profile-grid` and `.profile-card*` rules were removed from `app/globals.css` after a search showed no file used them.

## Key implementation decisions

- Fonts load through `next/font/local` from the copied variable-font files (Vollkorn weights 400 to 900, Karla 200 to 800). `next/font/local` cannot give one family two unicode ranges, so there are four font declarations; `--font-heading` and `--font-body` chain the latin and latin-ext files of each family and then a system font. No Content-Security-Policy change.
- Named values added: `--font-heading`, `--font-body`, `--text-*` sizes, `--shadow-hover`, `--radius-pill`; `--shadow` now matches the Stitch card shadow. The 16 colour tokens are unchanged (they already equal the Stitch palette), so no contrast failure arose.
- Buttons: pill shape, 600 weight, hover and a 1px press; `.secondary-button` now uses the inset outline like `.button-link-secondary`. Reduced motion switches off the press movement.
- The warm background gradient moved from `body` to `html`, because a screenshot showed a plain strip above the card.
- Stylelint 18.0.0 with `stylelint-config-standard` 41.0.0. `lint:css` is a `lint-css` step in `verify:local` right after `lint`; CI runs `verify:local`, so it blocks there. Switched off with a reason in the config: the blank-line rules (Prettier owns those), `media-feature-range-notation`, `no-descending-specificity`, `no-duplicate-selectors`, `property-no-deprecated`. The stylesheet needed no rewrite.
- Five versions pinned to the installed ones. `npm install` also moved four transitive CSS packages (`@csstools/css-calc`, `css-parser-algorithms`, `css-syntax-patches-for-csstree`, `css-tokenizer`) as part of adding Stylelint.
- `DESIGN.md` no longer says "No webfonts" and now describes the fonts, named values and the Stitch project.

## Test coverage summary

- Existing suite, coverage run: 130 files and 1649 tests pass. Coverage 96.95% lines, 91.09% branches, 95.66% functions (thresholds 80/80/80 kept). Domain coverage run passes at 99.39% / 94.32% / 97.30%.
- New and changed unit files (43 tests together) pass: design tokens, CSS lint, dependency pins, fonts.
- `tests/browser/sign-in-typography.spec.ts`: 20 of 20 pass in Chromium and Firefox against the built app (see below for how it was run).
- Also passed: lint, lint:css, format check, type check, build, start smoke, manifest check, privacy, secret and SAST scans, `verify:no-deploy`, `npm audit --audit-level=high` (16 moderate findings are listed and do not fail that threshold).

## Tests written but not executed in this stage

- `identity.spec.ts`, `visual-overhaul.spec.ts`, `navigation-polish.spec.ts` and the rest of the existing browser specs: not run, because Docker is not running and they need the seeded local database. They are unchanged, but they were not re-checked against the restyled stylesheet. This is outstanding evidence until they run.
- The new sign-in spec was run through a temporary Playwright config (since removed) that started `next start` with placeholder settings; the normal `npm run test:browser` run of it needs the database. The `mobile-chrome` project, WebKit, the full `verify:local` and the database checks did not run.
- The owner's visual comparison with the Stitch screen is manual.

## Deviations from the plan

- Weights: variable-font ranges instead of fixed weights 600/700 and 400/600/700.
- Four font declarations instead of two (reason above); unicode-range strings are written out in each call because the build rejects them from a constant.
- `lint:css` is wired through `verify:local` rather than as a separate `ci.yml` step.
- `tests/coverage/app-entrypoints.test.tsx` was changed (not in the plan): `next/font/local` is mocked there because it only works inside the Next.js build; it also checks the four font classes on `<html>`.
- `--text-label` is 1rem, not 0.9rem, so labels do not shrink.
- Hover and press colours use the `--color-*` tokens, since the token test forbids literal hex outside `:root`.
- `DESIGN.md` is outside the Prettier list and already failed `prettier --check` before this change; its formatting was left alone.
