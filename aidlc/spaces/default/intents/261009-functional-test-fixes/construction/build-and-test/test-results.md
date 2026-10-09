# Test Results: Functional test fixes

Run on 2026-10-09 with Node 24 and npm 11 (Homebrew `node@24` first on `PATH`), branch `feature/functional-test-fixes`, working tree with all changes uncommitted. Every command was run for real; exit codes are the shell's.

## Build and static checks

| Step | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 (`--max-warnings=0`) |
| Format | `npm run format:check` | exit 0 |
| Type check | `npm run typecheck` | exit 0 |
| Production build | `npm run build` | exit 0 |
| Start smoke | `npm run smoke:start` | exit 0, `SMOKE_START_OK: waldorf-local-ready` |

## Tests

| Layer | Command | Result |
|---|---|---|
| Unit and component (Node runner + Vitest) | `npm test` | exit 0; Node runner 246 tests passed; Vitest delivery project 39 files, 491 tests passed |
| Coverage | `npm run test:coverage` | exit 0; 70 files, 737 tests passed |
| Database role migration | `npm run test:database:roles` | exit 0; 9 passed, 0 failed |
| Browser, all projects | `npm run test:browser` | exit 0; 278 passed, 1 skipped, 0 failed, 0 flaky (3.3 min), on chromium, firefox and mobile-chrome |
| Login performance | `npm run test:login-performance` | exit 0; 8 passed |

The browser run includes this change's `tests/browser/functional-fixes.spec.ts` (notification journey, pending request journey, admin back links, per-list filters, empty-submit messages, no test copies and no technical text outside "Fejlesztői részletek") and the `@a11y` axe tests on all three projects, with no serious or critical violations. The one skipped test is the desktop-only keyboard focus-ring check, which the spec skips on the mobile device profile by design.

### Coverage

All files: 93.02% statements, 85.5% branches, 94.27% functions, 95.44% lines (Vitest delivery project). The configured floors (80% lines, branches, functions) hold and were not changed.

## Security checks

`npm run verify:security`: `PRIVACY_SCAN_PASS files=59`, `SECRETS_SCAN_PASS files=1298`, `SAST_SCAN_PASS files=233`, `NO-DEPLOY_SCAN_PASS files=233`, `npm audit --audit-level=high` found 0 vulnerabilities. `proxy.ts` (content security policy) has no changes.

## Failures

None. No loop-back was needed, so there is no `## Loop-Back Log`. (During Code Generation the developer saw five firefox back-link height assertions read 43.99998 px against a 44 px floor; the test now rounds, and the full run above is clean.)

## Not run

- `playwright.login-existing.config.ts`: it targets an already running server on port 3000 with the Chrome channel and belongs to an earlier piece of work; the login-performance config was run instead.
- A human visual review of the new screens: only automated tests and the earlier tester walkthrough (before the fixes) have been done; the fixed screens have not been looked at by eye by the person yet.
- The contrast ratio of the greyed read card was checked by the design-token contrast test and axe, but the measured number is not recorded (review note R-04).
