## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-10-24T05:50:23Z
**Iteration:** 11
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | scripts/db/stack.ts > externalAddresses (defaultStackDeps) and findExposedPorts | The network-exposure check that guards the stack's well-known default keys only probes IPv4 addresses (`entry.family === "IPv4"`). The code summary itself records that the CLI publishes the ports on `0.0.0.0` and `[::]`. A machine with a LAN, ULA or global IPv6 address passes the check while the database, data API and mail catcher are reachable on that address, and `db:start` then reports success without the acknowledgement flag. This weakens the project rule that the start command verifies no non-loopback address answers. | Also enumerate non-internal IPv6 addresses (skip link-local addresses that need a scope id, or probe them with their interface scope) and probe them. Add a unit test with a fake IPv6 address that answers. Alternatively state in the code summary and `--help` that IPv6 is not checked. | Unresolved |
| R-02 | Minor | supabase/migrations/20261013_platform_idempotency.sql > lifecycle_hold_place, lifecycle_hold_release (granted to `authenticated`) | A denied call by any signed-in account commits an audit event whose organization, target type and target id are caller-supplied and never checked against anything. An ordinary user can append unlimited denied events labelled with another organization's id and arbitrary targets. The events cannot be cleaned (append-only) and will show up for that organization's administrators once U2's read policy applies. The actor is not forgeable, so BR3.9 holds. This is the pattern later units will copy. | Record the abuse limit in the design or add a guard to the pattern, such as requiring the organization to exist, or storing denied events for unknown organizations under a fixed scope. Rate-limit denied writes per account if feasible. | Unresolved |
| R-03 | Minor | scripts/verification/privacy-allowlist.json > ignoredPrefixes, secretIgnoredPrefixes | The email, phone and secret content scans skip `aidlc/` and `source-materials/` entirely. BR11.1 only exempts the fictitious fixtures, lock files, generated folders and the allowed-example list. Real personal data in a tracked text file under `source-materials/` (for example Markdown or text notes) is not detected. Only the workbook and data-file extensions are caught there. The code summary lists this as deviation 8 but gives no mitigation. | Narrow the exemption to the specific record sub-folders that need it, or scan `source-materials/` for emails and phone numbers with the fixture allowlist. If the exemption stays, record it as an accepted risk in the design. | Unresolved |
| R-04 | Minor | aidlc/spaces/default/intents/261012-real-backend-local/construction/u1-local-platform-and-audit/code-generation/code-summary.md > Verification results | The test counts, file inventory (177 files) and `tests/database` file counts are U1-time numbers. U2 has since merged and changed `package.json`, `config.toml`, `scripts/db/` and `src/runtime/database/config.ts`, and the current suite differs. The summary says executable results are authoritative, but a reader may take these as current. | Add a dated "as of U1 checkpoint" note to the verification table, or refresh the counts at the next regeneration. | Unresolved |
| R-05 | Minor | scripts/verification/privacy-allowlist.json > phoneNumbers | The nine numbers are allowed repository-wide, not per file. A real number in the same format would still be flagged, but one of these nine would pass if it later appeared in production source or data. Today every occurrence outside the allowlist is in a test or test-support file (git grep confirms: src/**/*.test.ts, tests/**, no production file). | No change needed now. Optionally restrict these numbers to test paths, or keep the existing scan test that proves a non-listed number is still flagged. | New |
| R-06 | Minor | Validation run (not an artifact) | The three validation commands could not be run. The Bash hook refused them because no current plan-approval receipt matches this stage attempt. The refusal text tells the conductor to run `aidlc engine orchestrate next`, which a reviewer must not do. The database test command was not run either. So there is no run output for `npm run scan:privacy`, `npm audit --audit-level=high` or the verification test suite. The judgement above rests on the git diffs and file contents only. | The person should run the three commands from the review brief once in their own terminal and confirm green. CI on the PR is the other source of this evidence. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| npm run scan:privacy | Not run (hook refused the command) | Static check only: the allowlist is valid JSON, the nine numbers are all in the `+36`/`06` Hungarian format and all appear only in test files. |
| npm audit --audit-level=high | Not run (hook refused the command) | `git show f3093c4` shows only `zod` 4.4.3 to 4.6.7 and `undici` 8.11.2 to 8.12.3 in package-lock.json, with registry URLs and integrity hashes. No `package.json` change, so the declared ranges and the audit gate itself (CI step, source-manifest entries) are untouched. Whether the findings clear needs the audit run. |
| node --experimental-strip-types --test scripts/verification/*.test.ts | Not run (hook refused the command) | The only file in that folder that changed is the allowlist JSON, with data only (no scanner logic). |
| Database test command | Not run (Docker stack not confirmed up and the shell was blocked) | Neither change touches migrations, `src/runtime/database/`, or `scripts/db/`. |

### Differential judgement

- **Privacy scan:** The change only adds data to an allowlist. The scanner code (`scan-artifacts.ts`, `scan-core.ts`), its tests, `allowedPaths`, `ignoredPrefixes`, `secretIgnoredPrefixes` and the four `defaultKeyHashes` are unchanged. The scan still covers emails, secrets and default keys as before. The weakening is limited to nine fictitious numbers.
- **Dependency audit gate:** Only two lockfile versions moved, upward and within the same major lines. The gate is not relaxed (no allowlisted advisories, no lowered audit level).
- **Claimed source:** `package-lock.json` and `scripts/verification/privacy-allowlist.json` are both entries in source-manifest.json `writes`, so the changes fall inside the claimed source. The manifest paths themselves are unchanged. The recorded content hashes for those two files in the unit's review records will differ from the current files, which is expected for these two commits.

### Summary

The two repository-wide changes are narrow: a patch-level lockfile bump for `zod` and `undici`, and nine fictitious phone numbers added to the privacy allowlist, all used only in tests. They do not weaken the unit's privacy scan or audit gate, and both files are in the source manifest. READY, with the caveat that the validation commands could not be run here and should be confirmed by the person or by CI.
