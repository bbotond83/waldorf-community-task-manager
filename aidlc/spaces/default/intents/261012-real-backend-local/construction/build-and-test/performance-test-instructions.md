# Performance Test Instructions: Real local backend

Scope: the local performance targets of the requirements (NFR4) and the per-unit NFR4 targets. They are measured on the owner's machine against the local stack; hosted performance is not in this intent's scope (no deployed target exists yet).

## Targets and the checks that fail above a limit

| Target | Limit | Check |
|---|---|---|
| Small seed | 60 s | `tests/database/seed-timing.test.ts` (in `npm run test:database:seed`) |
| Reset | 30 s | same file |
| 30-family seed | 120 s | same file |
| Sign-in on seeded data | 5000 ms | same file (database level) and `tests/browser/sign-in-timing.spec.ts` (browser phase) |
| Directory and coordination timing targets | per U3 NFR4.6 to NFR4.9 | `tests/database/directory-timing.test.ts` (in `npm run test:database:directory`) |
| Notifications and import timing, including the 2000-row workbook preview and commit | 60 s each | `tests/database/notifications-timing.test.ts` (in `npm run test:database:notifications-import`) |
| Stack start, migrations, worker setup, scans | per U1 NFR4 targets, reported | `tests/database/worker.test.ts`, `tests/database/migrations.test.ts`, `scripts/verification/scan-artifacts.test.ts` |
| Audit write overhead | under 50 ms per operation | `tests/database/audit.test.ts` |

The full browser suite duration is reported only.

## How to run

```
npm run test:database:seed
npm run test:database:directory
npm run test:database:notifications-import
npm run test:browser
```

The timing tests print each measured duration. They are load sensitive: close other heavy programs first, run them alone, and if one fails near its limit run it once more before treating it as a defect. A ceiling is never raised to make a run pass (a decision on a retry policy is in the follow-up plan, group C).

## Reporting

Record each measured value in `test-results.md` next to its limit. A value over its limit makes the target `Not Met`.
