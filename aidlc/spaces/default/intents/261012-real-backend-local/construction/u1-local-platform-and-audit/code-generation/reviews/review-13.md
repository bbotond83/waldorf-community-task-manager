## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-22
**Iteration:** 8
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/db/stack.ts > externalAddresses (defaultStackDeps) and findExposedPorts | The network-exposure check that guards the stack's well-known default keys only probes IPv4 addresses (`entry.family === "IPv4"`). The code summary itself records that the CLI publishes the ports on `0.0.0.0` and `[::]`. A machine with a LAN, ULA or global IPv6 address passes the check while the database, data API and mail catcher are reachable on that address, and `db:start` then reports success without the acknowledgement flag. This weakens the project rule that the start command verifies no non-loopback address answers. | Also enumerate non-internal IPv6 addresses (skip link-local addresses that need a scope id, or probe them with their interface scope) and probe them. Add a unit test with a fake IPv6 address that answers. Alternatively state in the code summary and `--help` that IPv6 is not checked. | Unresolved |
| R-02 | Minor | supabase/migrations/20261013_platform_idempotency.sql > lifecycle_hold_place, lifecycle_hold_release (granted to `authenticated`) | A denied call by any signed-in account commits an audit event whose organization, target type and target id are caller-supplied and never checked against anything. An ordinary user can append unlimited denied events labelled with another organization's id and arbitrary targets. The events cannot be cleaned (append-only) and will show up for that organization's administrators once U2's read policy applies. The actor is not forgeable, so BR3.9 holds. This is the pattern later units will copy. | Record the abuse limit in the design or add a guard to the pattern, such as requiring the organization to exist, or storing denied events for unknown organizations under a fixed scope. Rate-limit denied writes per account if feasible. | Unresolved |
| R-03 | Minor | scripts/verification/privacy-allowlist.json > ignoredPrefixes, secretIgnoredPrefixes | The email, phone and secret content scans skip `aidlc/` and `source-materials/` entirely. BR11.1 only exempts the fictitious fixtures, lock files, generated folders and the allowed-example list. Real personal data in a tracked text file under `source-materials/` (for example Markdown or text notes) is not detected. Only the workbook and data-file extensions are caught there. The code summary lists this as deviation 8 but gives no mitigation. | Narrow the exemption to the specific record sub-folders that need it, or scan `source-materials/` for emails and phone numbers with the fixture allowlist. If the exemption stays, record it as an accepted risk in the design. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Verification results | The test counts, file inventory (177 files) and `tests/database` file counts are U1-time numbers. U2 has since merged and changed `package.json`, `config.toml`, `scripts/db/` and `src/runtime/database/config.ts`, and the current suite differs. The summary says executable results are authoritative, but a reader may take these as current. | Add a dated "as of U1 checkpoint" note to the verification table, or refresh the counts at the next regeneration. | Unresolved |

> R-01 Reviewer note: `scripts/db/stack.ts` line 83 still keeps only `entry.family === "IPv4"` addresses. The real `db:start` run in this pass warned only about the two IPv4 LAN addresses, so IPv6 is still not probed. Unchanged by U2 and U3.

> R-02 Reviewer note: `20261013_platform_idempotency.sql` is unchanged. Denied hold calls still record caller-supplied organization and target values. U3's functions reuse the same audit and idempotency helpers, so the pattern is now copied.

> R-03 Reviewer note: `scripts/verification/privacy-allowlist.json` still exempts `aidlc/` and `source-materials/` from the email, phone and secret scans (lines 7 and 8). The file is unchanged.

> R-04 Reviewer note: The U1 code summary still has no dated "as of U1 checkpoint" note on its counts. The current numbers differ more now: the database test file list grew by 14 files from U3, and the lint, format and CI test counts changed.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm run test:scripts` | PASS: 125 tests, 0 failed | The migration runner, start and stop commands, worker setup, CI configuration guard, lint-scope guard and the privacy and secret scans all still hold after the U2 and U3 changes. |
| `DB_ALLOW_ALL_INTERFACES=1 npm run db:start`, then `npm run test:database:stack` | PASS: 110 tests, 0 failed (migrations, audit, idempotency, holds and worker files, each in the default and in a worker schema) | BR3.x audit rules (fixed action list, append-only, denied events, rollback together with the change), BR4.x idempotency, the hold rules, and the worker schemas still hold on the real stack with U3's 13 added migration files applied. Start took 24.9 s. The stack was stopped afterwards with `npm run db:stop`. |
| `npm run typecheck` | PASS | No type errors. |
| `npm run lint` | PASS (0 warnings) | The `src/data` folder added to the lint scope is clean. |
| `npm run format:check` | PASS | All matched files are formatted. |
| `git status` and `git diff` against main on U1's claimed files | U1 migrations (`20260806` through `20261013`), `.github/workflows/ci.yml`, `scripts/db/stack.ts` and the `privacy-allowlist.json` file are unmodified. The changes to U1's shared files are additive: `package.json` (lint and format scope plus a `test:database:directory` script), `scripts/db/shuffled-tests.ts` (14 new test files appended), `scripts/verification/run-local-verification.ts` (one new stage), `ci-config.test.ts` and `migrations.test.ts` (new tests), `src/runtime/config.ts` (see below). | Nothing in U1's delivered behaviour was removed or weakened. U3 uses the audit action list through `platform_audit_write`, with new names `lifecycle.anonymize` and `lifecycle.delete`, and no U3 migration alters the audit table or its constraint. |
| Configuration change in `src/runtime/config.ts` (BR1.3 and BR1.4) | Checked by reading the code and its tests | The new rule accepts https for any host, and http only for `127.0.0.1`, `localhost` and `[::1]`. This matches the BR1.3 wording exactly, including the examples. `tests/unit/runtime-boundaries.test.ts` covers the loopback addresses, plus `http://example.supabase.co`, `http://192.168.1.20`, `http://localhost.evil.example`, `ftp://` and an invalid address, and names `SUPABASE_URL` as the failing setting. The session secret length rule, the public key rule and the no-service-role-key rule are untouched. |

### Summary

U1's delivered behaviour is intact after the U2 and U3 changes: its migrations, audit action list, idempotency, holds and worker schemas are unmodified and pass (110 stack tests and 125 script tests), and typecheck, lint and format are clean. U3's narrow change to `validateRuntimeConfig` matches BR1.3 and does not weaken BR1.4. The only open issues are the four prior findings, unchanged, with R-01 (IPv6 addresses not probed by the exposure check) the one Major, which keeps the count at or below the READY limit.
