# Integration Test Instructions

## Scope

This change is a UI-only restyle of an existing app, so the integration boundary under test is the browser against the production build and the real local database. The per-unit specs of U1 to U5 assert computed styles, sizes and layout at several widths, roles and focus behaviour, and automated accessibility; the existing parent, teacher and admin specs prove the behaviour did not change.

## Setup

- Start the local database once: `DB_ALLOW_ALL_INTERFACES=1 npm run db:start` (needs Docker and the owner's firewall acknowledgement; stop it with `npm run db:stop` when finished).
- Export the build-only environment variables from `build-instructions.md`, then `npm run build`.
- Every browser spec calls `bindSeededSchema` (a unit test enforces it) and reseeds its own schema; no shared state, no real credentials.

## Commands

The whole browser suite in every configured browser (chromium, firefox and mobile-chrome; the project defines no WebKit project):

```bash
npm run test:browser
```

Accessibility scan only (serious and critical violations block):

```bash
npm run test:a11y
```

Database layer tests (not changed by this work; run to prove the database is healthy):

```bash
npm run test:database:stack
npm run test:database:identity
npm run test:database:directory
npm run test:database:notifications-import
```

## Coverage targets

Vitest with the Istanbul provider, thresholds 80/80/80 for lines, branches and functions across all production source (`npm run test:coverage`). Thresholds are never lowered.

## Expected skips

Some specs skip by design: single-browser production-server specs skip outside Chromium, one identity case, and a mobile-only case. A skip is acceptable only when the spec states its reason with `test.skip`.

## Not covered by automation

Visual comparison with the Stitch screens is the owner's review (screenshots provided by the assistant); no picture-comparison tests exist by team rule.
