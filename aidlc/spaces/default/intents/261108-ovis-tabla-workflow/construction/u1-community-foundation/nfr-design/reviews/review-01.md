## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-09T07:33:31Z
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/nfr-design/security-design.md > Authorization Architecture > Stale links | The design says an archived parent or family is denied "at the next request through the existing authorization version" (NFR3.4, NFR3.5). In the repository the version is bumped only by grant and invitation changes (`identity_bump_authorization_version` in `20261018_identity_access_changes.sql`). Archiving a parent or family does not bump it. The database check is live, so data stays protected. The application's role and navigation resolution (`src/access/supabase-route-adapter.ts`, `authorization_version_for`) would keep showing admin screens, or accept a cached role, until something else changes. The stated mechanism does not deliver the stated guarantee for the archive case. | State which layer guarantees denial after an archive. Either have the archive and lifecycle steps bump the version for the affected parent's account, or say the guarantee rests on the live database check only and require the NFR3.4 test to cover the page and navigation, not just the function call. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/nfr-design/security-design.md > Accepted Risk, and security-requirements.md > Threat Considerations | The threat table cites `db:reset` refusing non-local databases as a control for the clean-start deletion. The deletion runs in a migration applied by `db:migrate`, not `db:reset`. The design confirms no guard inside the migration. | Name the real protection (what `db:migrate` refuses, in `scripts/db/local-guard.ts`). Optionally add a cheap abort in the migration when it finds rows outside the invented seed. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/nfr-design/performance-design.md > Budgets | NFR9.1 asks for page loads under 2 seconds, but the design measures only the 1500 ms database ceiling and assumes 500 ms for rendering. No page-level timing is designed. | Add a browser-side load measurement on the 30-family set for the four named pages, or record the 500 ms rendering allowance as an explicit assumption. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u1-community-foundation/nfr-design/reliability-design.md > Structure Change (NFR7.1) | The all-or-nothing claim rests on the file opening and committing its own transaction, which matches `20261006_current_roles.sql`. No design is given for the forced-failure test the pass criterion needs, and some statements, such as a temporary table with `on commit drop`, behave differently inside one transaction. | Name how the failure is forced (for example, a deliberately failing statement at the end of a copy of the migration) and that the test asserts the old structure and data are unchanged. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Stage validation tools | Not listed for this review | None run. |
| Spot checks against the repository | Confirmed: 1500 ms ceiling in `tests/database/directory-timing.test.ts`; `20261006_current_roles.sql` uses its own begin and commit; `audit_events` has an append-only trigger and keeps `import.commit` in its action list; `directory_reaches_family` currently lets group admins reach families through memberships. Not confirmed: archive bumping the authorization version. | The design is consistent with the code except for the stale-link claim above. |

### Summary

The NFR design is implementable. It has one decision point for admin authorization, a single all-or-nothing migration, and no new locks, and every NFR upstream ID is covered in traceability. The one point to weigh before approving is the stale-link guarantee. Archiving a parent or family does not bump the authorization version, so the stated revocation mechanism does not cover that case at the application layer.
