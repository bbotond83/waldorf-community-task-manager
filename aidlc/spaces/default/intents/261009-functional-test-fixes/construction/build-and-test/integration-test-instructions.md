# Integration and Browser Test Instructions

## Scope

Minimal test strategy with the bugfix floor: the new behaviour is covered by unit, component and page-render tests (run in Code Generation) plus browser journeys that exercise the real production build. This file lists the browser-level checks Build and Test runs.

## Setup

- Node 24 first on `PATH`: `export PATH=/opt/homebrew/opt/node@24/bin:$PATH`.
- `npm run build` first; the Playwright config starts three `npm run start` servers (ports 3100 to 3102) in synthetic mode with `SYNTHETIC_TEST_COPIES=1`.
- Browsers: `npx playwright install chromium firefox` once.

## Commands

- Full browser suite on all projects (chromium, firefox, mobile-chrome): `npm run test:browser`
- Accessibility only (axe, serious or critical findings fail): `npm run test:a11y`
- This change's own spec: `npx playwright test --config playwright.config.ts tests/browser/functional-fixes.spec.ts`
- Login performance specs (a separate config, own server): `npm run test:login-performance`

## What the browser tests prove for this change

- Notification journey: opening a notification keeps Értesítések current in the menu, the back link reads "Vissza az értesítésekhez" and returns to the list, the notification is read and greyed, ticking another one persists after a reload.
- Pending request journey: after a swap request the parent sees the confirmation and the pending notice, cannot send it again, and both request links are gone.
- Admin: every detail page and both "new" forms have a back link to their list; each list's filter offers only statuses valid for that list; an empty submit of both "new" forms shows a Hungarian message.
- No "– Firefox próba" or "– mobil próba" entries in the normal demo lists (the base ids are used), and no "Verzió", "Korreláció" or scenario selector outside the collapsed "Fejlesztői részletek" section (including import and settings).
- Accessibility: the existing `@a11y` specs report no serious or critical violations.

## Test data

Synthetic fixtures only (`waldorf-local-v1`); no real family or child data. The journeys reset the synthetic state before each test through `/api/synthetic/reset`.

## Coverage targets

Repository-wide line, branch and function coverage at least 80% (`npm run test:coverage`).
