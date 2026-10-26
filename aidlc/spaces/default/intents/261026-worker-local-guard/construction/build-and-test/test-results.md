# Test Results: Worker local-only guard

Run on 2026-10-26 on Node 24.22.0, branch `fix/worker-local-guard`.

## Build

`npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`: all exit 0.

## Tests

| Command | Result |
|---|---|
| `node --experimental-strip-types --test scripts/db/tooling.test.ts scripts/db/local-guard.test.ts` | 51 passed, 0 failed (the two refusal tests fail against the previous `worker.ts`, as intended) |
| `node --experimental-strip-types --test tests/database/worker.test.ts` (real local stack) | 13 passed, 0 failed |
| `npm test` | domain 511 passed, scripts 245 passed, delivery (vitest) 834 passed in 59 files; 0 failed |
| `npm run test:coverage` | exit 0; all files 99.39% lines, 94.34% branches, 97.30% functions |
| `npm run test:database:stack` | 116 passed, 0 failed (real local stack) |
| `npm run test:database:seed` | 57 passed, 0 failed (real local stack) |
| `npm run verify:security` | exit 0; scans pass; `npm audit --audit-level=high` reports only the 5 known moderate advisories |
| `npm run smoke:start` / `npm run test:bundle` | pass / pass |
| `npm run test:browser` | exit 0; 427 passed, 38 skipped, 0 failed (10.9 min) |

## Not run here

The identity, directory, notifications-import and shuffled-order database runs were not run locally. They prepare their schemas through `setupWorker` against the real stack, which the stack and seed groups and the worker tests already exercise; CI runs all of them as the merge check.

## Loop-Back Log

None.
