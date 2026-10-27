# Security Test Instructions: B3 denied-call audit rate limit

## Scope

This change is itself a security control (abuse limit on an append-only audit log, finding B3 / U1 R-02). NFR2 requires that the audit write keeps its privileges.

## Checks

| Check | How | Expected |
|-------|-----|----------|
| Function closed to application roles | `tests/database/audit-denied-limit.test.ts` test 7, and the existing `audit.test.ts` "refuses the audit write function to anon, authenticated and service_role" | Calls as `anon`, `authenticated`, `service_role` fail with insufficient privilege |
| Owner rights and pinned search path kept | test 7 | `prosecdef = true`, `proconfig` contains `search_path` |
| Limit cannot be bypassed by simultaneous calls | test 6 | Exactly 20 denied events stored out of 25 simultaneous calls |
| Limit cannot be bypassed by spreading over accounts' labels | test 3 and the design (count keyed by the actor account, never by the caller-supplied organization) | One account's cap is independent of the organization it names |
| Secret scanning, SAST and dependency scan | part of `npm run verify:local` (and CI) | No high or critical finding |

## How to run

```bash
node --experimental-strip-types --test tests/database/audit-denied-limit.test.ts tests/database/audit.test.ts
```

Then `npm run verify:local` for the scanners.

## Residual risk

Within the first 20 denied events per hour, the organization label is still supplied by the caller (B3's original concern). The owner accepted this with the rate-limit decision of 2026-10-27.
