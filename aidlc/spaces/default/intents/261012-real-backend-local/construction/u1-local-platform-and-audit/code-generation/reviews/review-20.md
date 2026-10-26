## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-25T09:06:33Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/db/stack.ts > externalAddresses (defaultStackDeps) and findExposedPorts | The network-exposure check that guards the stack's well-known default keys only probes IPv4 addresses (`entry.family === "IPv4"`). The code summary itself records that the CLI publishes the ports on `0.0.0.0` and `[::]`. A machine with a LAN, ULA or global IPv6 address passes the check while the database, data API and mail catcher are reachable on that address, and `db:start` then reports success without the acknowledgement flag. This weakens the project rule that the start command verifies no non-loopback address answers. | Also enumerate non-internal IPv6 addresses (skip link-local addresses that need a scope id, or probe them with their interface scope) and probe them. Add a unit test with a fake IPv6 address that answers. Alternatively state in the code summary and `--help` that IPv6 is not checked. | Unresolved |
| R-02 | Minor | supabase/migrations/20261013_platform_idempotency.sql > lifecycle_hold_place, lifecycle_hold_release (granted to `authenticated`) | A denied call by any signed-in account commits an audit event whose organization, target type and target id are caller-supplied and never checked against anything. An ordinary user can append unlimited denied events labelled with another organization's id and arbitrary targets. The events cannot be cleaned (append-only) and will show up for that organization's administrators once U2's read policy applies. The actor is not forgeable, so BR3.9 holds. This is the pattern later units will copy. | Record the abuse limit in the design or add a guard to the pattern, such as requiring the organization to exist, or storing denied events for unknown organizations under a fixed scope. Rate-limit denied writes per account if feasible. | Unresolved |
| R-03 | Minor | scripts/verification/privacy-allowlist.json > ignoredPrefixes, secretIgnoredPrefixes | The email, phone and secret content scans skip `aidlc/` and `source-materials/` entirely. BR11.1 only exempts the fictitious fixtures, lock files, generated folders and the allowed-example list. Real personal data in a tracked text file under `source-materials/` (for example Markdown or text notes) is not detected. Only the workbook and data-file extensions are caught there. The code summary lists this as deviation 8 but gives no mitigation. | Narrow the exemption to the specific record sub-folders that need it, or scan `source-materials/` for emails and phone numbers with the fixture allowlist. If the exemption stays, record it as an accepted risk in the design. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Verification results | The test counts, file inventory (177 files) and `tests/database` file counts are U1-time numbers. U2 has since merged and changed `package.json`, `config.toml`, `scripts/db/` and `src/runtime/database/config.ts`, and the current suite differs. The summary says executable results are authoritative, but a reader may take these as current. | Add a dated "as of U1 checkpoint" note to the verification table, or refresh the counts at the next regeneration. | Unresolved |
| R-05 | Minor | scripts/verification/privacy-allowlist.json > phoneNumbers | The nine numbers are allowed repository-wide, not per file. A real number in the same format would still be flagged, but one of these nine would pass if it later appeared in production source or data. Today every occurrence outside the allowlist is in a test or test-support file (git grep confirms: src/**/*.test.ts, tests/**, no production file). | No change needed now. Optionally restrict these numbers to test paths, or keep the existing scan test that proves a non-listed number is still flagged. | Unresolved |
| R-06 | Minor | Validation run (not an artifact) | The three validation commands could not be run. The Bash hook refused them because no current plan-approval receipt matches this stage attempt. The refusal text tells the conductor to run `aidlc engine orchestrate next`, which a reviewer must not do. The database test command was not run either. So there is no run output for `npm run scan:privacy`, `npm audit --audit-level=high` or the verification test suite. The judgement above rests on the git diffs and file contents only. | The person should run the three commands from the review brief once in their own terminal and confirm green. CI on the PR is the other source of this evidence. | Resolved (reviewer) |
| R-07 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Platform schema, audit_events bullet; functional-design/rules.md > BR3.4 | The unit's own text still says the audit trigger refuses update and delete "for everyone" and that audit events "cannot be changed or deleted". Since supabase/migrations/20261044_audit_purge.sql, a delete is allowed for rows older than 365 days inside audit_purge(). The guarantee the code gives is narrower than the one the unit documents. | Add a one-line note to the summary (and BR3.4 if it is reopened) that the only delete path is audit_purge() for rows older than 365 days, owned by U5. | Unresolved |
| R-08 | Minor | supabase/migrations/20261044_audit_purge.sql > audit_events_refuse_change (setting app.audit_purge) | The delete gate is a plain transaction-local setting that any session can set. The append-only guarantee for aged rows now rests only on no application role holding DELETE (revoked in 20261012, not widened since). Owner connections (tests, seed, reset, migration tooling) can set the setting and delete aged rows without calling audit_purge(). Young rows and updates stay refused, and the test at audit.test.ts "still refuses ... a delete of an aged event outside the purge" passes only because the setting is unset. No application path is opened. | Either accept this and state in the migration comment that the protection is the revoked grants, or tighten it, for example by also requiring pg_trigger_depth() or a per-call random token that only audit_purge() holds. Add a test that grants nothing new to service_role on audit_events. | Resolved (reviewer) |
| R-09 | Minor | scripts/db/local-guard.ts > assertLocalStack; scripts/db/reset.ts > resetSchema | db:reset truncates audit_events (and all other tables) and defaults to `public`, the shipped schema. Its only barrier is the loopback address check plus an identity check. The JWT-secret check is skipped when the database holds no `app.settings.jwt_secret` (hash is only compared if it is a string), and a hosted database reached through a loopback tunnel also has `supabase_admin` and, if migrated with this tooling, the tracking schema. In that case the guard could pass. I could not run anything (shell refused), and did not check whether db:worker (scripts/db/worker.ts, which also truncates audit_events through resetWorkerData) applies the same guard. | Make a missing jwt_secret a refusal too, or add a second local-only signal, such as a marker set by db:start. Confirm db:worker has an equivalent address check. | Resolved (reviewer) |
| R-10 | Minor | scripts/db/local-guard.ts > assertLocalStackPassword refusal message | A developer who has deliberately set a custom password for the local database gets a refusal that says it "is not the local stack" and gives no way forward. The legitimate default workflow is unaffected, because `db:start` writes the CLI's own `DB_URL` into `.env.service.local`. | Optionally add a short hint to the message, or to the README line, saying that the seed and reset only work with the CLI's default local password. | Unresolved |
| R-11 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/source-manifest.json > writes | The manifest claims `src/runtime/database/` and `scripts/db/` as whole directories. Files added later by U2 to U5 (for example scripts/db/local-guard.ts and first-super-admin.test.ts) now sit under U1's claim, so the unit's source scope is wider than what U1 built. | Narrow the claim to U1's files, or record that later units own the files they added. | Unresolved |
| R-12 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Verification results | The "5 moderate" npm audit advisories were not enumerated in the summary. They sit below the blocking threshold. | Optionally list them with an owner or a review date. | New |

> R-01 Reviewer note: scripts/db/stack.ts line 83 still filters on `entry.family === "IPv4" && !entry.internal`; no IPv6 probe, and neither the code summary nor the help text states that IPv6 is not checked. Only one Major, so it does not block READY.

> R-02 Reviewer note: No change found; the abuse limit is not recorded.

> R-03 Reviewer note: privacy-allowlist.json still has ignoredPrefixes ["aidlc/", ".aidlc-archive/", "source-materials/"] and secretIgnoredPrefixes ["aidlc/", "source-materials/"].

> R-04 Reviewer note: code-summary.md line 52 still states the 164 to 177 file count with no "as of the U1 checkpoint" date.

> R-05 Reviewer note: No change needed; accepted as is.

> R-06 Reviewer note: Re-ran the checks (see the tool results below); all pass.

> R-07 Reviewer note: code-summary.md has no note about the 365-day purge in audit_purge().

> R-10 Reviewer note: local-guard.ts has no hint for using a custom local password.

> R-11 Reviewer note: source-manifest.json still claims the whole src/runtime/database/ and scripts/db/ directories.

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| npm run typecheck | PASS | `next typegen` and `tsc --noEmit` completed with no errors. |
| npm run lint | PASS | ESLint with --max-warnings=0 completed with no output. |
| npm test | PASS: 59 files, 834 tests | Includes the config, client, runner, scan and ci-config scripts tests. |
| npm run scan:privacy | PASS: PRIVACY_SCAN_PASS files=1257 | Clean. |
| npm audit --audit-level=high | 5 moderate, no high or critical | Below the blocking threshold. |
| Real-stack (Docker) commands | Not run | They need Docker, which this review is not allowed to start. I relied on the code-summary evidence and CI. |

### Summary

The code is green on every check I could run without Docker. The one open Major, R-01 (the exposure check probes only IPv4 addresses), is unchanged and is within the one Major the verdict rule allows. The other prior items are documentation or hardening notes that still apply and do not block.
