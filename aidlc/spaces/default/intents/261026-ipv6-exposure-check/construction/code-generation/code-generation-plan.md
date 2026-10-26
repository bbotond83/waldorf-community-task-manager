# Code Generation Plan: IPv6 coverage of the stack exposure check

## Summary

- Builds: the `db:start` exposure check also probes the machine's non-internal IPv6 addresses (link-local ones with their interface scope), with an unambiguous address and port display for IPv6.
- Touches: `scripts/db/stack.ts` (address list as a pure, exported function; display format), `scripts/db/stack.test.ts` (tests), and two short text notes (`scripts/db/start.ts` help line, `README.md` line) that now say IPv4 and IPv6 are checked.
- Tests: about 10 new or rewritten unit tests in `scripts/db/stack.test.ts` on fictitious interface tables and test doubles; the existing suite stays green; no stack or Docker is needed.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "Implement each testable layer, then write and run its tests before moving to the next layer.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: Implement each testable layer, then write and run its tests before moving to the next layer.\n\nWe write tests in the same change as the code and add a regression test for every defect. We enforce at least 80% line, branch, and function coverage across all production source.\n\nBefore merge, we require strict type checking, tests, a production build, deterministic start smoke, the critical browser flow, and dependency scanning that blocks high and critical findings. The critical browser flow must have no serious or critical automated accessibility violations. Provisioned integrations do not count as verified until they are exercised against their real targets."
    },
    {
      "layer": "project",
      "text": "- ALWAYS treat current executable test and coverage results as authoritative when historical summaries contain stale counts (learned 2026-08-06) \n- ALWAYS include security and performance instructions when explicit NFR or privacy risks require them, even under Standard strategy (learned 2026-08-06) \n- ALWAYS report provisioned environment checks as outstanding evidence until they are executed against real integrations (learned 2026-08-06) \n- ALWAYS block CI on high and critical dependency vulnerabilities (learned 2026-08-06)"
    }
  ],
  "obligations": {
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:3d292c6045d13da5e4d7456ce512bed1710e7c19d4cd1fcfbb8c23797b5346c2",
  "contract_sha256": "sha256:ccfc2d241c3297baee8acc2adf0300e8dd8d3a3c089e4a5c084dd757a212e135"
}
```

## Steps

Only the business-logic layer applies (a tooling script): there is no database, repository, API or frontend layer in this change.

- [x] **Step 1: Verify the runner and record the unit-scoped command.** Run `node --experimental-strip-types --test scripts/db/stack.test.ts` and confirm it passes before any change; the command is recorded in `unit-test-instructions.md`. Traces: NFR4.
- [x] **Step 2: Business logic, implement.** In `scripts/db/stack.ts` add and export a pure function `externalAddressesFrom(interfaces)` that takes the operating system's interface table (the shape `os.networkInterfaces()` returns) and returns the addresses to probe: every non-internal IPv4 address, every non-internal IPv6 address, and a link-local IPv6 address (`fe80::/10`, that is `fe80` to `febf`) with its scope as `<address>%<interface name>`; internal addresses are never returned; a missing or empty interface entry returns nothing. `defaultStackDeps().externalAddresses` calls it with `networkInterfaces()`. Add and export `formatEndpoint(address, port)` that renders IPv4 as `a.b.c.d:port` and IPv6 (including a scoped one) as `[address]:port`; the refusal error and the acknowledged-warning line use it. `findExposedPorts` keeps probing every listed address and port, and a probe that reports closed or fails never stops the loop. Traces: FR1.1, FR1.2, FR1.3, FR1.4, FR2.1, NFR1, NFR3.
- [x] **Step 3: Business logic, write and run its tests.** In `scripts/db/stack.test.ts`: replace the test "lists external IPv4 addresses and writes secret files readable only by the owner" (it read the real network) by a test of the secret-file permissions alone plus table tests of `externalAddressesFrom` on fictitious interface tables: an IPv4 address is listed; a global IPv6 address and a unique-local (`fd00::/8`) address are listed; link-local `fe80` and `febf` addresses are listed with `%<interface>`; `fec0::` is listed unscoped (not link-local); loopback `127.0.0.1` and `::1` (internal) are not listed; an interface with no entries gives nothing. Add `formatEndpoint` tests (IPv4, global IPv6, scoped IPv6). Add behaviour tests with a fake IPv6 address: `findExposedPorts` reports it when a port answers and reports nothing when none answers; `startStack` refuses with the bracketed address in the message and stops the stack, and with the acknowledgement it logs the bracketed warning and goes on. Run the unit-scoped command. Traces: FR1.1 to FR1.4, FR2.1, NFR2.
- [x] **Step 4: Documentation.** Update the test title and comments that say IPv4; make the help line in `scripts/db/start.ts` and the `README.md` sentence about the check say that IPv4 and IPv6 addresses are checked. No change to the acknowledgement wording: the flag stays the owner's to set. Traces: FR3.1.
- [x] **Step 5: Verify.** Run `npm run format:check`, `npm run lint`, `npm run typecheck`, the unit-scoped command, and `npm run test:scripts` and `npm run test:coverage:domain` (coverage stays at or above 80% lines, branches and functions). A real `db:start` run on the owner's machine is the final manual check and is not run here. Traces: NFR4.
- [x] **Step 6: Code summary and traceability.** Write `code-summary.md` and `traceability.json` for this change. Traces: all FR and NFR ids.

## Traceability (requirement to plan step)

| Requirement | Plan steps |
|---|---|
| FR1.1, FR1.2 | 2, 3 |
| FR1.3, FR1.4 | 2, 3 |
| FR2.1 | 2, 3 |
| FR3.1 | 4 |
| NFR1 | 2 |
| NFR2 | 3 |
| NFR3 | 2 |
| NFR4 | 1, 5 |
