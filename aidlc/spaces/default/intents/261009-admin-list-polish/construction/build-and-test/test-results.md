# Test Results: Admin and schedule list polish

Run on 2026-10-09 with Node 24 and npm 11 (Homebrew `node@24` first on `PATH`), branch `feature/admin-list-polish`, working tree with all changes uncommitted. Every command was run for real; exit codes are the shell's.

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
| Unit and component (Node runner + Vitest) | `npm test` | exit 0; Node runner 258 tests passed; Vitest delivery project 42 files, 531 tests passed |
| Coverage | `npm run test:coverage` | exit 0; 74 files, 789 tests passed |
| Database role migration | `npm run test:database:roles` | exit 0; 9 passed, 0 failed |
| Browser, all projects | `npm run test:browser` | exit 0; 383 passed, 1 skipped, 0 failed, 0 flaky (5.1 min), on chromium, firefox and mobile-chrome |
| Login performance | `npm run test:login-performance` | exit 0; 8 passed |

The browser run includes this change's `tests/browser/list-polish.spec.ts` (teacher and admin clear journeys, label layout at 320 px and desktop, create buttons, status symbols) and the `@a11y` axe tests on all three projects, with no serious or critical violations. The one skipped test is the desktop-only keyboard focus-ring check, which the spec skips on the mobile device profile by design.

### Coverage

Delivery project: 93.24% statements, 86.15% branches, 94.49% functions, 95.6% lines. The configured floors (80% lines, branches, functions) hold and were not changed.

## Wording check

A case-insensitive search for `rekord` over `app/`, `src/`, `tests/` and `HASZNALATI_UTMUTATO_HU.md` (excluding English `record` identifiers) finds only two negative assertions: `tests/browser/list-polish.spec.ts:391` and `tests/coverage/admin-pages.test.tsx:83`.

## Security checks

`npm run verify:security`: `PRIVACY_SCAN_PASS files=59`, `SECRETS_SCAN_PASS files=1306`, `SAST_SCAN_PASS files=241`, `NO-DEPLOY_SCAN_PASS files=241`, `npm audit --audit-level=high` found 0 vulnerabilities. `proxy.ts` (content security policy) has no changes.

## Failures

None in this run. No loop-back was needed, so there is no `## Loop-Back Log`. (During Code Generation six browser assertions in `teacher-web.spec.ts` failed because they asserted the old behaviour; they were updated and the full run above is clean.)

## Not run

- `playwright.login-existing.config.ts`: it targets an already running server on port 3000 with the Chrome channel; the login-performance config was run instead.
- A human look at the changed screens: only automated tests and the earlier tester walkthrough exist; the person has not yet reviewed the clear behaviour, the new layout and the status symbols by eye.
- The status glyphs in dropdown options were verified only on desktop chromium, firefox and the mobile-chrome emulation, not on a real Android or older iOS font stack.
