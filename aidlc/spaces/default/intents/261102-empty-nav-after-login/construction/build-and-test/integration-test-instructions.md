# Integration and browser test instructions

## Setup and commands

The local database stack must be running (`npm run db:start`). Node 24 first on the path.

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && npm run test:delivery
```

Browser tests (Chromium only here; CI runs every browser) use a production build served on port 3100 and the seeded worker schemas:

```bash
export PATH=/opt/homebrew/opt/node@24/bin:$PATH && VERIFY_BROWSER_PROJECTS=chromium npx playwright test --config playwright.config.ts
```

## Targets and test data

At least 80% lines, branches and functions (`npm run test:coverage`). The four role-landing browser tests must show no serious or critical accessibility violations. Test accounts are the synthetic seeded ones; no real credentials or mail are used.
