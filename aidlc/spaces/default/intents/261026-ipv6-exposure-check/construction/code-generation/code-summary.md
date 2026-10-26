# Code Summary: IPv6 coverage of the stack exposure check

## Files changed

- `scripts/db/stack.ts`: new exported `externalAddressesFrom(interfaces)` and `formatEndpoint(address, port)`; `defaultStackDeps().externalAddresses` now uses the first; the refusal error and the acknowledged-warning line use the second.
- `scripts/db/stack.test.ts`: the test that read the real network is replaced; 11 new tests; `fakeDeps` takes an optional `addresses` list.
- `scripts/db/start.ts`: the `--help` text says the ports are checked on any IPv4 or IPv6 address of the machine.
- `README.md`: one sentence says the check covers both the IPv4 and the IPv6 addresses.

## Key decisions

- **One pure function for the address list.** `externalAddressesFrom` takes the interface table (the shape `os.networkInterfaces()` returns), so it is tested with fictitious tables and no test depends on the machine's real network (NFR2).
- **Link-local rule.** An IPv6 address whose first group is `fe80` to `febf` (`fe80::/10`) is probed as `<address>%<interface name>`, because it is unreachable without a scope. Unique-local (`fd00::/8`), `fec0::`, documentation and global addresses are probed as they are. Internal (loopback) addresses of either family are never listed.
- **Bracketed display.** IPv6 endpoints print as `[address]:port` (for example `[fe80::1%en0]:54321`), so a scoped address is not ambiguous with the port. IPv4 output is unchanged (`a.b.c.d:port`). This follows review note R-02.
- **Probe loop unchanged.** `findExposedPorts` still probes every listed address and published port; it gained no early exit, so one closed or failing probe never hides a reachable port elsewhere (NFR1). The 1500 ms timeout per probe is unchanged (NFR3).
- **Acknowledgement rule unchanged.** `DB_ALLOW_ALL_INTERFACES=1` / `--allow-all-interfaces` is still read from the flag or the environment and set only by the owner; tests pass it as a test double.

## Review notes from Requirements Analysis, and how they were handled

| Note | Handling |
|---|---|
| R-01 the old test reads the real network | Replaced by table tests; a small remaining test only checks that the real call returns strings without failing, and the file-permission test stays |
| R-02 ambiguous `address:port` for IPv6 | Bracketed format, asserted in the refusal and warning tests |
| R-03 no IPv4-only wording to fix | Updated the test title, the doc comment, the `--help` line and one README sentence |
| R-04 boundary cases and the scope assumption | Boundary tests for `fe80`, `febf`, `fec0`; whether Node accepts `%<interface>` as the connect target on the owner's machine is confirmed by the owner's real `db:start` run (see below) |

## Test coverage summary

`scripts/db/stack.test.ts`: 32 tests pass (21 before). New: six `externalAddressesFrom` table tests (IPv4; global and unique-local IPv6; `fe80` and `febf` with scope; `fec0::` unscoped; internal addresses never listed; missing or empty entries), one `formatEndpoint` test (IPv4, global IPv6, scoped IPv6), three IPv6 exposure behaviour tests (reported when a port answers and nothing when none does; refusal with the bracketed address and a stop of the stack; warning and continue when acknowledged), the rewritten permission test, and one test of the real call. Changed file coverage with the unit-scoped command: `stack.ts` 99.37% lines, 95.89% branches. Repository `test:coverage:domain`: 99.39% lines, 94.32% branches, 97.28% functions.

## Tests written but not executed in this stage

- A real `npm run db:start` on a machine with an IPv6 address: it needs Docker and the running Supabase stack, which the assistant does not start. This is the only check that exercises the probe against real interfaces and confirms that Node accepts the `%<interface>` scope; it is the owner's final manual check.
- The stack-backed database suites and the browser suite were not run in Code Generation; Build and Test runs the project's commands.

## Deviations from the plan

None. Step 6 (this summary and `traceability.json`) was written by the conductor, not the developer, because those files are outside the developer's allowed changes.
