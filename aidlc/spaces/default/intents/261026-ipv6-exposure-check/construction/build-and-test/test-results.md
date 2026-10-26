# Test Results: IPv6 coverage of the stack exposure check

Run date: 2026-10-26. Branch `fix/ipv6-exposure-check` on top of `main` at `828c440`. Node 24, npm 11, macOS. Docker was not running; no stack was started.

## Build and static checks

| Step | Result |
|---|---|
| `npm run format:check` | pass |
| `npm run lint` (0 warnings allowed) | pass |
| `npm run typecheck` | pass |
| `npm run build` | not run: `scripts/` is not part of the Next.js build, so this change cannot affect it; CI builds it |

## Tests

| Suite | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| Unit-scoped: `scripts/db/stack.test.ts` | 32 | 32 | 0 | 0 |
| Node runner, domain tests (`src/`) | 508 | 508 | 0 | 0 |
| Node runner, tooling tests (`scripts/`) | 239 | 239 | 0 | 0 |
| Vitest (components, pages, integration) | 834 (59 files) | 834 | 0 | 0 |
| Database suites, shuffled run, browser suite | not run | | | Docker and the stack are not running; none of these suites import the changed functions |

The unit-scoped suite grew from 21 to 32 tests: six `externalAddressesFrom` table tests, one `formatEndpoint` test, three IPv6 exposure behaviour tests, the rewritten permission test and one test of the real call. Duration of the unit-scoped command: about 0.12 s.

## Coverage

| Measure | Actual | Target |
|---|---|---|
| Statements | 97.13% (5212/5366) | at least 80% |
| Branches | 91.02% (4024/4421) | at least 80% |
| Functions | 96.33% (1209/1255) | at least 80% |
| Lines | 98.07% (4640/4731) | at least 80% |

Changed file `scripts/db/stack.ts` (unit-scoped command with coverage): 99.37% lines, 95.89% branches.

## Security and privacy

| Check | Result |
|---|---|
| `scan:privacy` (1257 files, new files staged) | pass |
| `scan:secrets`, `scan:sast`, `verify:no-deploy` | pass |
| `npm audit --audit-level=high` | exit 0: 5 moderate (vitest mocker chain 2, nodemailer 3), no high or critical |

## Outstanding

A real `npm run db:start` on a machine with an IPv6 address, run by the owner, to confirm that Node accepts `<link-local address>%<interface>` as the connect target and that a reachable IPv6 port is refused.

## Loop-Back Log

None.
