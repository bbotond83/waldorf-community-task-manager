# Test Results: Visual overhaul, second round

Run on 2026-10-09 with Node 24.21.0 and npm 11.19.0 (Homebrew `node@24` first on `PATH`), branch `feature/visual-overhaul-navigation`, working tree with all changes uncommitted. Every command was run for real; exit codes are the shell's.

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
| Unit and component (Node runner + Vitest) | `npm test` | exit 0; Node runner 232 tests passed; Vitest delivery project 36 files, 431 tests passed |
| Coverage | `npm run test:coverage` | exit 0; 66 files, 663 tests passed |
| Database role migration | `npm run test:database:roles` | exit 0; 9 passed, 0 failed |
| Browser, all projects | `npm run test:browser` | exit 0; 209 passed, 1 skipped, 0 failed, 0 flaky (2.1 min), on chromium, firefox and mobile-chrome |
| Login performance | `npm run test:login-performance` | exit 0; 8 passed |

The browser run includes this change's `tests/browser/navigation-polish.spec.ts` and the `@a11y` axe tests on all three projects, with no serious or critical violations, now also loading the new default pages. The one skipped test is the desktop-only keyboard focus-ring check, which the spec skips on the mobile device profile by design.

### Coverage

All files: 92.56% statements, 84.51% branches, 94.02% functions, 94.96% lines (Vitest delivery project). The configured floors (80% lines, branches, functions) hold and were not changed.

## Security checks

`npm run verify:security`: `PRIVACY_SCAN_PASS files=58`, `SECRETS_SCAN_PASS files=1289`, `SAST_SCAN_PASS files=225`, `NO-DEPLOY_SCAN_PASS files=225`, `npm audit --audit-level=high` found 0 vulnerabilities. `proxy.ts` (content security policy) has no changes.

## Failures

None. No loop-back was needed, so there is no `## Loop-Back Log`.

## Not run

- `playwright.login-existing.config.ts`: it targets an already running server on port 3000 with the Chrome channel and belongs to an earlier piece of work; the login-performance config was run instead.
- A human visual review of every new screen: only automated tests and screenshots from earlier rounds have been checked; the new menus, lists and notification cards have not been looked at by eye by the person yet.
