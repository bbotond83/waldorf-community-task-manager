## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-20T14:30:07Z
**Iteration:** 1

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/db/stack.ts > externalAddresses (defaultStackDeps) and findExposedPorts | The network-exposure check that guards the stack's well-known default keys only probes IPv4 addresses (`entry.family === "IPv4"`). The code summary itself records that the CLI publishes the ports on `0.0.0.0` and `[::]`. A machine with a LAN, ULA or global IPv6 address passes the check while the database, data API and mail catcher are reachable on that address, and `db:start` then reports success without the acknowledgement flag. This weakens the project rule that the start command verifies no non-loopback address answers. | Also enumerate non-internal IPv6 addresses (skip link-local addresses that need a scope id, or probe them with their interface scope) and probe them. Add a unit test with a fake IPv6 address that answers. Alternatively state in the code summary and `--help` that IPv6 is not checked. | New |
| R-02 | Minor | supabase/migrations/20261013_platform_idempotency.sql > lifecycle_hold_place, lifecycle_hold_release (granted to `authenticated`) | A denied call by any signed-in account commits an audit event whose organization, target type and target id are caller-supplied and never checked against anything. An ordinary user can append unlimited denied events labelled with another organization's id and arbitrary targets. The events cannot be cleaned (append-only) and will show up for that organization's administrators once U2's read policy applies. The actor is not forgeable, so BR3.9 holds. This is the pattern later units will copy. | Record the abuse limit in the design or add a guard to the pattern, such as requiring the organization to exist, or storing denied events for unknown organizations under a fixed scope. Rate-limit denied writes per account if feasible. | New |
| R-03 | Minor | scripts/verification/privacy-allowlist.json > ignoredPrefixes, secretIgnoredPrefixes | The email, phone and secret content scans skip `aidlc/` and `source-materials/` entirely. BR11.1 only exempts the fictitious fixtures, lock files, generated folders and the allowed-example list. Real personal data in a tracked text file under `source-materials/` (for example Markdown or text notes) is not detected. Only the workbook and data-file extensions are caught there. The code summary lists this as deviation 8 but gives no mitigation. | Narrow the exemption to the specific record sub-folders that need it, or scan `source-materials/` for emails and phone numbers with the fixture allowlist. If the exemption stays, record it as an accepted risk in the design. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Verification results | The test counts, file inventory (177 files) and `tests/database` file counts are U1-time numbers. U2 has since merged and changed `package.json`, `config.toml`, `scripts/db/` and `src/runtime/database/config.ts`, and the current suite differs. The summary says executable results are authoritative, but a reader may take these as current. | Add a dated "as of U1 checkpoint" note to the verification table, or refresh the counts at the next regeneration. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| `npm run typecheck` | Not run: every shell command was blocked by a hook demanding workflow continuation commands, which a reviewer must not call. | Not verified by this review. The code summary reports a clean check. |
| Static read of the claimed sources | Migrations, runner, worker, stack, config, client, scan core, CI workflow, `.gitignore`, allowlist and `tests/database/audit.test.ts` reviewed. | Rules BR1.1 to BR1.5, BR3.1 to BR3.9, BR4.1, BR10.1 to BR10.4, BR11.1 and BR11.2 and entities `AuditEvent`, `IdempotencyRecord` and `LifecycleHold` trace to implementation. Neither U2's merge nor the shared platform functions contradicts U1's design. `app_role_grants`, which `platform_actor_role` depends on, still exists after U2. |

### Summary

The unit is implementable and meets its functional design. The audit and idempotency functions are definer-owned with execute revoked, take the actor from the session, and commit atomically. The runner refuses hard-coded schemas, and the tests run against the real stack. One Major gap remains: the safety check on exposed ports ignores IPv6 although the stack binds to `[::]`. Three Minor items are open. That is within the READY limit of at most two Major and no Critical findings.
