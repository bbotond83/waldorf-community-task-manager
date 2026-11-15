## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/infrastructure-design/infrastructure-specification.md > Infrastructure Services > Postgres row, grants sentence | The sentence grants `notice_send` to the service role only and, in the same sentence, to no application role. It also lists `timed_checks_run_system` and the claim, sweep and outcome functions as service-role-only but never lists the grants for the notice list, mark read, delivery-problems list and Try again (signed-in session, body-checked). The nfr-design security table says `notice_send` is not granted to any session role and is called only by same-owner `security definer` functions, so the service-role grant on `notice_send` is unneeded and widens its reach. | Split the grants into three explicit lists. Service role: run, claim, sweep, outcome record. Signed-in role: notice list, mark read, delivery-problems list, Try again. No application role: `notice_send`, facts, check and housekeeping functions. Remove `notice_send` from the service-role list. | New |
| R-02 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/infrastructure-design/infrastructure-specification.md > Infrastructure Services > Timed command row; cicd-pipeline.md > Secrets | The spec says the command uses the "server-only service access" and "the service key the scripts already use". The variable name `SUPABASE_SERVICE_ROLE_KEY` is correct. However, `src/identity/admin-runtime.ts` starts with `import "server-only"`, which a plain `node --experimental-strip-types` script cannot load. The existing scripts (`scripts/db/first-super-admin.ts`) instead use `createAdminAccess` from `src/identity/admin-client.ts` and `SERVICE_ENV_FILE` from `scripts/db/common.ts`. | Name the seam the command uses (the `admin-client.ts` and `SERVICE_ENV_FILE` pattern of `first-super-admin.ts`) and state that the new notice mailer and anything the command imports must not import `server-only`. Also say that the `timed:run` entry must be added to `package.json`, because no such script exists yet. | New |
| R-03 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/infrastructure-design/infrastructure-specification.md > Infrastructure Services > Postgres row (check registry) and Shared Infrastructure > C9 row | The registry gains `lock_step` and the run records gain an error code and a "missing" outcome. Contract C9 in `inception/contract-design/contract-summary.md` lists the registry columns as `[check_name, function_name, run_kind, is_active]`, the records as `[check_name, run_kind, started_at, outcome, created, skipped]`, and a missing function as "failed". The infra spec does not name the contract update, and the C9 consumers (U6, U7, U9, U10, U11, U13, plus the hosting schedule) are not listed in the Shared Infrastructure row. | Add a line that C9 is amended in this pull request (`lock_step`, error code, "missing"), and list the consuming units and the hosting schedule in the C9 row so their later migrations know to supply `lock_step`. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/infrastructure-design/infrastructure-specification.md > Infrastructure Services > Seed and reset row | The spec says `scripts/db/reset.ts` and the seed call "the daily run in place of the system tick". Today `reset.ts` calls `reminder_run_due_system` once per organization before emptying (`runSystemFunction`). The daily run is community-wide and service-role-only, so its replacement is a behaviour change and also touches `scripts/db/seed/commands.test.ts`. | State what the reset's pre-empty call does after the change (one daily-run call, or none) and name the affected tests so they change in the same pull request. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/infrastructure-design/traceability.json > upstream_ids and coverage | The map selects 23 NFR ids and leaves out several this design visibly serves: NFR7.3 (the `claimed_at` index and the expiry sweep), NFR7.4, NFR7.5, NFR7.11 (the mailer's error mapping), NFR6.4 (tests of removed code), NFR1.6 and NFR11.1 (the removal step, which the spec lists as a shared C16 resource for U14). The other mappings I spot-checked (NFR3.x grants, NFR5.7 `lock_step`, NFR7.6 and NFR9.5 pass size, NFR1.5 retention, NFR10.3 link) point at the right sections. | Add rows for these ids, or state in the map that unlisted ids are covered in the NFR design only. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/infrastructure-design/infrastructure-specification.md Timed command row | The row says the command exits non-zero on a failed check or failed email. The code also runs the delivery pass when the run call itself fails and then exits non-zero; this is consistent with the row but not spelled out. | Optionally add a few words; not blocking. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Cross-check of the grant lists, timed command and migration | Consistent | Service-role-only claim, sweep, record and run; signed-in functions body-checked; no grant for notice_send, facts, checks and housekeeping; revoke all then explicit grant; one migration file (20261050). 64 database tests passed. |

### Summary

The infrastructure design still matches the final migration and command; fixes changed only the retry size limit and run-failure behaviour, both within the described shape.
