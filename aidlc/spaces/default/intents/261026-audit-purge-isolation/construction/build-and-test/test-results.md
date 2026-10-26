# Test Results: Audit purge isolation

Run on 2026-10-26 on Node 24.22.0 against the local Supabase stack (Docker), branch `fix/audit-purge-own-call`.

## Build

- `npm run db:migrate`: applied `20261045_audit_purge_isolation.sql` to `public` (1 applied, 38 already up to date).
- `npm run typecheck`: pass. `npm run lint`: pass (0 warnings). `npm run format:check`: pass.
- `npm run build`: pass (exit 0).

## Tests

| Command | Result |
|---|---|
| `npm test` | 508 passed, 0 failed |
| Affected database files (`audit-purge`, `identity-housekeeping`, `migrations`, `identity-catalogue`) | 91 passed, 0 failed |
| `npm run test:database:identity` | 332 passed, 0 failed |
| `npm run test:database:seed` | 57 passed, 0 failed |
| `npm run test:coverage` | exit 0; all files 99.39% lines, 94.30% branches, 97.28% functions |
| `npm run verify:security` | exit 0; privacy, secret, SAST and no-deploy scans pass; `npm audit --audit-level=high` reports 5 moderate advisories (known, group D of the follow-up plan), none high or critical |
| `npm run smoke:start` | pass (`SMOKE_START_OK`) |
| `npm run test:bundle` | pass |
| `npm run test:browser` | exit 0; 427 passed, 38 skipped, 0 failed (10.6 min) |

## Not run here

- The directory and notifications-import database groups, the stack group and the shuffled-order run were not run locally. This change does not touch them, so CI runs them as the merge check.

## Loop-Back Log

None.
