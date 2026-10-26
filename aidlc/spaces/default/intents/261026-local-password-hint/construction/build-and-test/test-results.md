# Test Results: Local password hint

Run on 2026-10-26 on Node 24.22.0, branch `fix/local-password-hint`.

## Build

`npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`: all exit 0.

## Tests

| Command | Result |
|---|---|
| `node --experimental-strip-types --test scripts/db/local-guard.test.ts` | 18 passed, 0 failed (17 passed and 1 failed against the previous `local-guard.ts`, as intended) |
| `npm test` | domain 511 passed, scripts 240 passed, delivery (vitest) 834 passed in 59 files; 0 failed |
| `npm run test:coverage` | exit 0; all files 99.39% lines, 94.34% branches, 97.30% functions |
| `npm run test:database:seed` | 57 passed, 0 failed (real local stack) |
| `npm run verify:security` | exit 0; scans pass; `npm audit --audit-level=high` reports only the 5 known moderate advisories |
| `npm run smoke:start` / `npm run test:bundle` | pass / pass |
| `npm run test:browser` | exit 0; 427 passed, 38 skipped, 0 failed (10.7 min) |

## Not run here

The identity, directory, notifications-import and stack database groups and the shuffled-order run were not run locally. The change touches only an error message, so CI runs them as the merge check.

## Loop-Back Log

None.
