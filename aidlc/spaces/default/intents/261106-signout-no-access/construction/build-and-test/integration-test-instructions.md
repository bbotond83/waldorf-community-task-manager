# Integration Test Instructions

The Minimal strategy needs no extra integration suite for this change. The one boundary this change touches is the page-to-sign-out-action link, which is covered by the browser spec.

## What runs

- `tests/browser/no-access.spec.ts` (Playwright, Chromium): opens `/hozzaferes-megtagadva`, checks the Hungarian guidance, clicks the sign-out button and expects the sign-in page (`/bejelentkezes`).

## Command

```bash
VERIFY_BROWSER_PROJECTS=chromium npx playwright test tests/browser/no-access.spec.ts --config playwright.config.ts
```

Needs the database stack (`npm run db:start`), a production build (`npm run build`) and the environment from `build-instructions.md`.

## Not covered here

- Firefox and mobile-chrome projects: run by CI on every pull request (`VERIFY_BROWSER_PROJECTS` unset runs all three).
- A signed-in account with a real "no linked record" state.
