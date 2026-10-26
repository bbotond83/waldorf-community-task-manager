# Test Results: Password reset clears the lockout

Run on 2026-10-26 on Node 24.22.0, branch `fix/password-reset-clears-lockout`.

## Build

- `npm run typecheck`: pass. `npm run lint`: pass (0 warnings). `npm run format:check`: pass.
- `npm run build`: pass (exit 0).

## Tests

| Command | Result |
|---|---|
| `node --experimental-strip-types --test src/identity/reset.test.ts` | 12 passed, 0 failed (10 passed and 2 failed against the previous `reset.ts`, as intended) |
| `npm test` | domain 511 passed, scripts 239 passed, delivery (vitest) 834 passed in 59 files; 0 failed |
| `npm run test:coverage` | exit 0; all files 99.39% lines, 94.32% branches, 97.30% functions |
| `npm run test:database:identity` | 332 passed, 0 failed (real local stack) |
| `npm run verify:security` | exit 0; privacy, secret, SAST and no-deploy scans pass; `npm audit --audit-level=high` reports only the 5 known moderate advisories (group D of the follow-up plan) |
| `npm run smoke:start` | pass (`SMOKE_START_OK`) |
| `npm run test:bundle` | pass |
| `npm run test:browser` | exit 0; 427 passed, 38 skipped, 0 failed (11.3 min) |

## Not run here

- The directory, notifications-import, seed, stack database groups and the shuffled-order run were not run locally. This change touches no database object, so CI runs them as the merge check.

## Loop-Back Log

None.
