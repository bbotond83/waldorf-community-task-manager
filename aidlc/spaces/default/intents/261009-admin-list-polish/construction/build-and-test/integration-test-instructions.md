# Integration and Browser Test Instructions

## Scope

Minimal test strategy with the bugfix floor: the behaviour is covered by unit, component and page-render tests (run in Code Generation) plus browser checks against the real production build. This file lists the browser-level checks Build and Test runs.

## Setup

- Node 24 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- `npm run build` first; the Playwright config starts three `npm run start` servers (ports 3100 to 3102) in synthetic mode.
- Browsers: `npx playwright install chromium firefox` once.

## Commands

- Full browser suite on all projects (chromium, firefox, mobile-chrome): `npm run test:browser`
- Accessibility only (axe, serious or critical findings fail): `npm run test:a11y`
- This change's own spec: `npx playwright test --config playwright.config.ts tests/browser/list-polish.spec.ts`
- Login performance specs (a separate config, own server): `npm run test:login-performance`

## What the browser tests prove for this change

- Teacher schedule: the first visit is unfiltered (Minden csoport, empty dates, all granted groups); "Szűrők törlése" empties every field including unsubmitted typed values and address-supplied values; after clear, open a detail and Back, the fields stay empty; focus moves to the heading.
- Admin lists (Nyilvántartások, Feladatok és események, Jóváhagyások): "Szűrők törlése" resets search and status and shows the unfiltered list.
- Layout: labels sit above their fields with no horizontal overflow at 320 px and desktop on the teacher, admin, parent duty and reminders filters and on the admin create forms.
- "Új elem" and "Új feladat vagy esemény" are buttons (44 px, visible focus); the create page reads "Új elem", "Elem típusa", "Elem létrehozása".
- Every status word has a symbol in lists, detail pages and dropdown options, and the icons are hidden from the accessibility tree.
- Accessibility: the `@a11y` specs report no serious or critical violations.

## Test data

Synthetic fixtures only (`waldorf-local-v1`); no real family or child data. Each journey resets the synthetic state through `/api/synthetic/reset`.

## Coverage targets

Repository-wide line, branch and function coverage at least 80% (`npm run test:coverage`).
