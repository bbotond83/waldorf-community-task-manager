# Cross-Unit Traceability: IPv6 coverage of the stack exposure check

Source: `aidlc engine sensor-traceability --stage build-and-test`, run 2026-10-26.

## Verdict: PASS

All ten requirement ids of this change are built and traced to existing files; none is uncovered.

| ID | Requirement | Built in | Verified by |
|---|---|---|---|
| FR1.1 | The probed address list includes non-internal IPv6 as well as IPv4; internal never | `scripts/db/stack.ts` (`externalAddressesFrom`) | `scripts/db/stack.test.ts` table tests |
| FR1.2 | Link-local IPv6 (`fe80` to `febf`) probed with `%<interface>` scope | `scripts/db/stack.ts` | boundary tests `fe80`, `febf`, `fec0::` |
| FR1.3 | Any answering address, IPv4 or IPv6, makes `db:start` refuse and name the endpoint | `scripts/db/stack.test.ts` | IPv6 refusal test (bracketed endpoint, stack stopped) |
| FR1.4 | No answering address: the check passes | `scripts/db/stack.test.ts` | `findExposedPorts` empty-result test |
| FR2.1 | Acknowledgement flag unchanged and set only by the owner | `scripts/db/stack.test.ts` | acknowledged-warning test; no new code sets the variable |
| FR3.1 | Text says IPv4 and IPv6 | `scripts/db/start.ts`, `README.md` | `--help` text and README sentence |
| NFR1 | The change never weakens the check | `scripts/db/stack.ts` | probe loop unchanged; one failing probe never stops the others |
| NFR2 | Deterministic, no dependence on the real network | `scripts/db/stack.test.ts` | fictitious interface tables only |
| NFR3 | Probe timeout and count unchanged | `scripts/db/stack.ts` | 1500 ms timeout unchanged |
| NFR4 | Quality gates and coverage | whole repository | `test-results.md` |
