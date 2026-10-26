# Build and Test Summary: IPv6 coverage of the stack exposure check

## Overall status

Build ready, test ready for everything this change can affect. Format, lint, typecheck, 1,581 stack-free tests, coverage and the security scans all pass (details in `test-results.md`). One real-environment check is outstanding and belongs to the owner: a real `npm run db:start` on a machine with an IPv6 address.

## Test type inventory

Strategy: Minimal (express scope). 11 new or rewritten unit tests in `scripts/db/stack.test.ts` (32 tests in the file). Instruction files: `build-instructions.md`, `integration-test-instructions.md`, `performance-test-instructions.md` (nothing to measure beyond an unchanged timeout), `security-test-instructions.md`.

## Coverage expectations

Repository-wide at least 80% lines, branches and functions. Actual: 98.07% lines, 91.02% branches, 96.33% functions, 97.13% statements.

## Target Verification Matrix

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| T1-coverage | team.md Testing Posture; NFR4 | at least 80% lines, branches and functions across all production source | 98.07% lines, 91.02% branches, 96.33% functions | `npm run test:coverage` | build-and-test | Met |
| T2-existing-suite-green | Testing Contract scope floor | existing suite stays green | 508 + 239 Node runner tests and 834 Vitest tests pass, 0 failures | `npm test` | build-and-test | Met |
| T3-FR1-ipv6-covered | requirements FR1.1 to FR1.4 | IPv6 addresses probed; link-local scoped; any answer refuses; none passes | 10 targeted tests pass | `scripts/db/stack.test.ts` (32 of 32) | build-and-test | Met |
| T4-FR2-ack-unchanged | requirements FR2.1 | acknowledgement rule unchanged, not set by this change | warning path test passes; diff sets the variable nowhere | `scripts/db/stack.test.ts`, `git diff` | build-and-test | Met |
| T5-NFR1-not-weakened | requirements NFR1 | an address probed before is still probed; one failing probe never hides another | probe loop unchanged; verified by review and tests | code review, `stack.test.ts` | build-and-test | Met |
| T6-NFR2-deterministic | requirements NFR2 | no test reads the real network | the one test of the real call only checks that entries are strings | `stack.test.ts` | build-and-test | Met |
| T7-NFR4-gates | team.md; requirements NFR4 | type check, lint, format, tests pass | all exit 0 | `test-results.md` | build-and-test | Met |
| T8-dependency-scan | project.md; team.md | no high or critical dependency findings | 0 high or critical; 5 moderate | `npm audit --audit-level=high` | build-and-test | Met |
| T9-secret-and-SAST | team.md Code Style | no secrets; no high or critical SAST | pass | `SECRETS_SCAN_PASS`, `SAST_SCAN_PASS` | build-and-test | Met |
| T10-provisioned-integrations | team.md Testing Posture | provisioned integrations exercised against real targets | this change provisions none; the local stack is only started by the owner | n/a | none | N/A |
| T11-CI-obligation | Testing Contract: run the selected tests in CI before merge | n/a: the plan runs no CI Pipeline stage; CI runs these checks on the pull request regardless | recorded | plan | n/a | N/A |

## Readiness

Build-ready: yes. Test-ready: yes. Deployment-ready: not assessed (out of scope; no deployable target is linked).

## Known limitations and outstanding items

- The real `db:start` run with an IPv6 address (owner): confirms Node accepts the `%<interface>` scope and that a reachable IPv6 port is refused. Until then the scoped-address behaviour is unexercised outside test doubles.
- Review notes accepted as known limits: a failed probe counts as a closed port, with no test of a failing probe beside a reachable one; the existing CI workflow sets `DB_ALLOW_ALL_INTERFACES=1` for its throwaway runner (predates this change).
- The database, shuffled and browser suites were not run (Docker down); they do not use the changed functions.
