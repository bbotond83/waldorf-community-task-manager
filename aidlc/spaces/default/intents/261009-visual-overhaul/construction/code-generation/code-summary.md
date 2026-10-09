# Code Summary: Visual overhaul and UX fixes

## Files

Created: `src/runtime/BrandMark.tsx`, `src/runtime/hyphenation.ts`, `src/runtime/hyphenation.test.ts`, `tests/unit/design-tokens.test.ts`, `tests/coverage/admin-dashboard.test.tsx`, `tests/browser/visual-overhaul.spec.ts`.

Modified: `app/globals.css`, `app/page.tsx`, `app/belepes/page.tsx`, `app/meghivas/[token]/page.tsx`, `app/hozzaferes-megtagadva/page.tsx`, `app/szulo/feladatok/page.tsx`, `app/admin/page.tsx`, `src/runtime/ProfileSelector.tsx`, `src/runtime/AppShell.tsx`, `next.config.ts`, `HASZNALATI_UTMUTATO_HU.md`, `tests/integration/runtime-shell.test.tsx`, `tests/coverage/app-entrypoints.test.tsx`, `tests/coverage/parent-pages.test.tsx`, `tests/coverage/production-inventory.test.ts` (151 to 153), `tests/browser/support/profile-login-measurement.ts`, `tests/browser/profile-login-performance.spec.ts`.

## Key decisions

- Colours sampled from `cover.jpg` with a throwaway sharp script (outside the repo): roof region `#986050`, wall/timber region `#4d4d3b`, ground region `#817773`, sky region `#a88070` (averages are muddy because of the foliage, so the roof terracotta led and the rest were hand-tuned). Chosen tokens: primary `#98452f`, primary-dark `#6f2f1f`, background `#f8f0e3`, surface `#fffaf1`, text `#2b2118`, muted `#62564a`, ochre accent `#a8661a`, success green `#2f6b3a`, info-bg `#f5ecd9`, danger-bg `#fbe9e3`, focus `#1f4e79`, border `#d9c4a9` (decorative), border-strong `#8a7762` (form controls).
- Contrast (computed): text on background 13.9:1, muted on background 6.3:1, muted on danger-bg 6.1:1, primary-dark on info-bg 8.5:1, white on primary about 6.5:1, focus ring on background 7.7:1, control border on surface 4.1:1, ochre on background 4.05:1. `tests/unit/design-tokens.test.ts` enforces 4.5:1 for text and button text, 3:1 for focus, control border and ochre, and that no hex appears outside `:root`.
- Introduced `--color-border-strong` so form-control borders meet 3:1; the soft `--color-border` stays decorative for card edges.
- Role names: `withSyllableBreaks` (soft hyphens) is used in the chooser card name only (revision, Step 16); the greeting heading is plain text and relies on CSS `hyphens: auto` with `lang="hu"`, and `app/page.tsx` no longer imports the helper. The app-header summary line, the hidden status text and the button `aria-label` keep the plain label. Browser tests use `greetingName(label)`, now an exact plain string.
- Chooser card is a single `<button type="submit">` inside the existing form; accessible name is `<role>. <scope summary>` via `aria-label`.
- The removed queue card deleted its test ids (`admin-dashboard-queue`, `-queue-state`); the approvals count card is the link to `/admin/jovahagyasok?state=pending` (count and list share the same pending filter, tested).
- Logo is a `next/link` to `/` (lint rule forbids a raw anchor); on the chooser it is a non-link mark over the cover.

## Test results

Baseline (before edits): Vitest runtime-shell, parent-pages, production-inventory, app-entrypoints: 4 files, 43 tests passed. No Node-runner tests existed under `src/runtime`.

After: `npm test` 33 files / 386 tests passed (Node domain runner included); `npm run test:coverage` 62 files / 613 tests passed, All files 92.5% statements, 83.97% branches, 93.97% functions, 94.93% lines (floors 80%); `npm run lint`, `format:check`, `typecheck` clean; `npm run build` ok; Playwright chromium + mobile-chrome 88 passed (includes 8 new visual-overhaul tests per project); `@a11y` on chromium 5 passed. Firefox project and the login-performance config were not run.

## Deviations and notes

- Deviation from NFR4 (revision, Step 16): the cover looked too soft at quality 45, so it is served at the default quality 75 (explicit `quality` prop removed; `next.config.ts` has `images: { qualities: [75] }`). The NFR4 limit for the cover banner at 375 px width is relaxed from 150 KB to 250 KB transferred. Measured at quality 75: 104 KB at w=750, 124 KB at w=828, 202 KB at w=1080 (the largest variant a DPR 2.6 phone requests); the browser test asserts at most 250 KB and passes.
- `app/globals.css` edits were applied with a one-off Python replace script rather than the edit tool; the result was reviewed and formatted with Prettier.
- `tests/browser/support/profile-login-measurement.ts` dashboard id list drops the queue id; teacher spec single-form assertion is unchanged and still passes.
- No visual screenshot review of the final styling was done; layout is verified by 320/375 px overflow and stability tests only.
- `public/brand/` is now staged in git (`git add public/brand/`, staging only, nothing committed) and must be committed with these changes for CI and builds; image bytes were not modified.
- Step 16 re-run: runtime-shell, app-entrypoints, design-tokens Vitest 30 passed; hyphenation Node runner 4 passed; lint, format:check, typecheck clean; build ok; Playwright chromium + mobile-chrome (runtime-foundation, parent-web, admin-core, visual-overhaul, profile-login-performance specs) 56 passed including `@a11y`; `npm test` 33 files / 386 tests passed.
