## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-23
**Iteration:** 9
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/db/stack.ts > externalAddresses (defaultStackDeps) and findExposedPorts | The network-exposure check that guards the stack's well-known default keys only probes IPv4 addresses (`entry.family === "IPv4"`). The code summary itself records that the CLI publishes the ports on `0.0.0.0` and `[::]`. A machine with a LAN, ULA or global IPv6 address passes the check while the database, data API and mail catcher are reachable on that address, and `db:start` then reports success without the acknowledgement flag. This weakens the project rule that the start command verifies no non-loopback address answers. | Also enumerate non-internal IPv6 addresses (skip link-local addresses that need a scope id, or probe them with their interface scope) and probe them. Add a unit test with a fake IPv6 address that answers. Alternatively state in the code summary and `--help` that IPv6 is not checked. | Unresolved |
| R-02 | Minor | supabase/migrations/20261013_platform_idempotency.sql > lifecycle_hold_place, lifecycle_hold_release (granted to `authenticated`) | A denied call by any signed-in account commits an audit event whose organization, target type and target id are caller-supplied and never checked against anything. An ordinary user can append unlimited denied events labelled with another organization's id and arbitrary targets. The events cannot be cleaned (append-only) and will show up for that organization's administrators once U2's read policy applies. The actor is not forgeable, so BR3.9 holds. This is the pattern later units will copy. | Record the abuse limit in the design or add a guard to the pattern, such as requiring the organization to exist, or storing denied events for unknown organizations under a fixed scope. Rate-limit denied writes per account if feasible. | Unresolved |
| R-03 | Minor | scripts/verification/privacy-allowlist.json > ignoredPrefixes, secretIgnoredPrefixes | The email, phone and secret content scans skip `aidlc/` and `source-materials/` entirely. BR11.1 only exempts the fictitious fixtures, lock files, generated folders and the allowed-example list. Real personal data in a tracked text file under `source-materials/` (for example Markdown or text notes) is not detected. Only the workbook and data-file extensions are caught there. The code summary lists this as deviation 8 but gives no mitigation. | Narrow the exemption to the specific record sub-folders that need it, or scan `source-materials/` for emails and phone numbers with the fixture allowlist. If the exemption stays, record it as an accepted risk in the design. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Verification results | The test counts, file inventory (177 files) and `tests/database` file counts are U1-time numbers. U2 has since merged and changed `package.json`, `config.toml`, `scripts/db/` and `src/runtime/database/config.ts`, and the current suite differs. The summary says executable results are authoritative, but a reader may take these as current. | Add a dated "as of U1 checkpoint" note to the verification table, or refresh the counts at the next regeneration. | Unresolved |

> R-01 Reviewer note: `scripts/db/stack.ts` has no diff against main, so the IPv4-only exposure probe is unchanged. During this run `db:start` reported only the IPv4 address 192.168.0.141 and any IPv6 address would still not be probed. Not caused by U3 or U4, and no wider than before.

> R-02 Reviewer note: `20261013_platform_idempotency.sql` is unmodified. The denied-event pattern is unchanged.

> R-03 Reviewer note: `privacy-allowlist.json` is unmodified. The `aidlc/` and `source-materials/` content-scan exemption still stands.

> R-04 Reviewer note: `code-summary.md` still carries the U1-time counts (109 stack tests, 97 script tests). Current runs give 111 and 127. The summary already says executable results are authoritative. Add a dated note at the next regeneration.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `git diff main --stat` on U1's four migrations, `supabase/config.toml`, `supabase/roles.sql`, `scripts/db/{stack,migrate,runner}.ts` | no changes | U1's migrations and stack tooling are unmodified. U3 and U4 only add new migration files (20261024 to 20261042). |
| Audit action list and constraint (grep for `audit_events_action_check`) | only `20261014_identity_schema.sql` (U2) touches it | Not changed by U3 or U4. Their audit calls use `lifecycle.anonymize`, `lifecycle.delete`, `approval.approve`, `approval.reject` and `import.commit` (the one import action), all within the list. |
| `scripts/db/worker.ts` diff | adds `REFERENCE_TABLES = {sheet_registry}` and filters it out of the reset truncate list | Reset still empties every other table and removes the worker's accounts. Keeping the migration-seeded sheet list is justified, and it is narrow (one named table). |
| `shuffled-tests.ts`, `shuffled-tests.test.ts`, `ci-config.test.ts`, `run-local-verification.ts`, `tests/database/migrations.test.ts` diffs | additions only (the one changed assertion in the shuffled test now lists the two new database scripts) | Nothing weakened. The shuffled run covers the new files, and verify:local gains the two new database stages. |
| `src/runtime/config.ts` diff | production database address now accepts https anywhere or http on loopback only | Matches U1's runtime configuration rule (https anywhere, http only on 127.0.0.1, localhost or ::1). Not weaker than U1's claim. |
| `npm run test:database:stack` (real stack, started with the acknowledgement flag, stopped afterwards) | 111 passed, 0 failed | U1's database tests still pass with U3 and U4 migrations applied. |
| `npm run test:scripts` | 127 passed, 0 failed | Meets the expected count. |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | all clean | |
| `npm audit` | 4 moderate, 0 high, 0 critical (vitest chain) | The Next 16.4.2 bump and `@e965/xlsx` 0.20.3 add no high or critical finding. |

### Summary

U1's delivered behaviour holds: its migrations and stack tooling are untouched, the audit action list is unchanged by U3 and U4, the worker reset change is narrow, and the test and script edits only add. The U1 tests (111 and 127), typecheck, lint, format and the audit gate (high and critical zero) all pass. The open items are the earlier R-01 to R-04, unchanged by these edits and within the verdict rule (one Major).
