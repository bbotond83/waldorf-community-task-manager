# Integration and Browser Test Instructions

## Scope

Minimal test strategy with the bugfix floor: the new behaviour is covered by unit, component and page-render tests (run in Code Generation) plus browser tests that exercise the real production build. This file lists the browser-level checks Build and Test runs.

## Setup

- Node 24 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- `npm run build` first; the Playwright config starts three `npm run start` servers (ports 3100 to 3102) in synthetic mode, so no manual server is needed.
- Browsers: `npx playwright install chromium firefox` once.

## Commands

- Full browser suite on all projects (chromium, firefox, mobile-chrome): `npm run test:browser`
- Accessibility only (axe, serious or critical findings fail): `npm run test:a11y`
- This change's own spec: `npx playwright test --config playwright.config.ts tests/browser/visual-overhaul.spec.ts`

## What the browser tests prove for this change

- Profile chooser: each role card is one button that selects the profile by mouse and keyboard; no horizontal overflow and no broken role names at 320 and 375 px.
- Parent task list: a whole task card opens the task detail.
- Admin overview: the "Nyitott jóváhagyások" card opens the waiting approvals and its count equals the rows shown.
- Cover banner: served resized (at most 250 KB at 375 px width) and the page stays usable and stable when image requests fail.
- Accessibility: the existing `@a11y` specs on `/`, `/szulo/feladatok`, `/teacher/schedule`, `/admin/nyilvantartasok` and `/admin/import` stay free of serious or critical violations with the new palette.

## Test data

Synthetic fixtures only (`waldorf-local-v1`); no real family or child data.

## Coverage targets

Repository-wide line, branch and function coverage at least 80% (`npm run test:coverage`).
