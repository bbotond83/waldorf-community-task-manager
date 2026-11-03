# Test Results

Run on 2026-11-02 against commit 1070fd6 plus the uncommitted change, Node 24.x.

| Check | Command | Result |
|---|---|---|
| Format | `npm run format:check` | Passed ("All matched files use Prettier code style!") |
| Lint | `npm run lint` (`--max-warnings=0`) | Passed, no warnings |
| Strict typecheck | `npm run typecheck` | Passed |
| Unit and component tests with coverage | `npm run test:coverage` | 127 files, 1615 tests passed; domain run 511 passed, 0 failed |
| Coverage | same run | statements 96.94%, branches 91.09%, functions 95.66%, lines 97.94% (floor 80%, unchanged) |
| Production build | `npm run build` | Succeeded |
| Bundle check | `npm run test:bundle` | Passed (fail 0) |
| Start smoke | `npm run smoke:start` | `SMOKE_START_OK: waldorf-local-ready` |
| Security scans | `npm run verify:security` | Exit 0: privacy, secret, SAST and no-deploy scans passed; `npm audit --audit-level=high` passed (16 moderate findings in dev tooling, none high or critical) |
| New browser test (Chromium, port 3100) | `npx playwright test tests/browser/identity.spec.ts --grep "Nincs jogosultság"` | 1 passed; includes axe with no serious or critical violations |
| Whole Chromium browser phase | `npx playwright test` with `VERIFY_BROWSER_PROJECTS=chromium` | 160 passed |

## Not executed here

- Firefox and mobile Chrome browser projects (CI runs every browser on every run).
- Database test groups (this change touches no database code).

## Failures

None.
