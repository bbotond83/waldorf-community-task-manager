# Test Results: Visual overhaul and UX fixes

Run on 2026-10-09 with Node 24.21.0 and npm 11.19.0 (Homebrew `node@24` first on `PATH`), branch `feature/visual-overhaul`, working tree with the staged `public/brand/` assets. Every command was run for real; exit codes are the shell's.

## Build and static checks

| Step | Command | Result |
|---|---|---|
| Lint | `npm run lint` | exit 0 (`--max-warnings=0`) |
| Format | `npm run format:check` | exit 0, all matched files formatted |
| Type check | `npm run typecheck` | exit 0 |
| Production build | `npm run build` | exit 0; all routes listed, proxy present |
| Start smoke | `npm run smoke:start` | exit 0, `SMOKE_START_OK: waldorf-local-ready` |

## Tests

| Layer | Command | Result |
|---|---|---|
| Unit and component (Node runner + Vitest) | `npm test` | exit 0; Vitest delivery project 33 files, 386 tests passed |
| Coverage | `npm run test:coverage` | exit 0; 62 files, 613 tests passed |
| Database role migration | `npm run test:database:roles` | exit 0; 9 passed, 0 failed |
| Browser, all projects | `npm run test:browser` | exit 0; 132 passed in 1.4 min (chromium 44, firefox 44, mobile-chrome 44), 0 failed, 0 flaky |

The browser run includes this change's `tests/browser/visual-overhaul.spec.ts` (8 tests per project, including the cover-image weight test) and the five `@a11y` axe tests, which report no serious or critical violations on any project.

### Coverage

All files: 92.5% statements, 83.97% branches, 93.97% functions, 94.93% lines. The configured floors (80% lines, branches, functions) hold and were not changed.

## Security checks

`npm run verify:security`: privacy scan pass, `SECRETS_SCAN_PASS files=1281`, `SAST_SCAN_PASS files=217`, `NO-DEPLOY_SCAN_PASS files=217`, `npm audit --audit-level=high` found 0 vulnerabilities. `proxy.ts` (content security policy) has no changes (`git diff --stat proxy.ts` is empty).

## Failures

None. No loop-back was needed, so there is no `## Loop-Back Log`.

## Not run

- `npm run test:login-performance` (an earlier piece of work's measurement, not touched by this change).
- A human visual review of every screen: the profile chooser and the signed-in greeting were looked at in a browser; the admin overview and the parent task list were covered by automated tests only.
