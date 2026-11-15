## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | app/admin/emlekeztetok/page.tsx lines 69-72 and 114 (the Try again key); supabase/migrations/20261050_notices_and_timed_run.sql lines 917-924 (delivery_retry key check) | The Try again key is built from kind, item and the SUM of the try counts of the listed emails. Two different states can have the same sum. Example: two emails fail in round 1 (3 and 3, sum 6) and the admin retries; in round 2 one fails again (6) and the other is sent, so the list is now one email at 6, which is again sum 6. The key is the same but the list differs, so the stored fingerprint does not match and the call returns idempotency_key_reused. The admin cannot retry that group until the key record expires. | Build the key from the full (delivery id, try count) list (for example a hash of it) so a different list always gets a different key. Add a database or adapter test for this case. | New |
| R-02 | Minor | src/identity/mail.ts lines 161-163; scripts/timed-run.ts lines 98 and 87 (asText of a null) | A rota_published email has no item date (the facts function returns null) and an email for a deleted item has no item name. Both become an empty string, so the mail shows a bare "Időpont:" line and, for a deleted item, a bare "Feladat:" line. The fixed template then reads as broken to a parent. | Leave out the date line (and the item line) when the value is empty, and add a mailer test for both cases. | New |
| R-03 | Minor | supabase/migrations/20261050_notices_and_timed_run.sql line 931 (jsonb_array_length not between 1 and 500) | A group with more than 500 failed emails can never be retried, because the screen sends every delivery in the group and the function refuses the list. The screen shows only a generic error. A group has one email per parent, so this is unlikely for this community, but nothing caps or documents it. | Record the limit as an assumption in the design, or raise it to the community size limit, and add a test at the boundary. | New |
| R-04 | Minor | scripts/timed-run.ts line 173 (if (!run) return 1) | When the run call itself is refused or fails, the command exits before the delivery pass, so due emails wait for the next scheduled run. A failed single check does not do this (the pass still runs), so the two failures behave differently. | Either state this in the unit documentation as intended, or run the delivery pass anyway and exit non-zero at the end. | New |
| R-05 | Minor | src/identity/mail.ts lines 190-193 (Promise.race timeout) | After the 30-second timeout the transport send is not cancelled. The try is recorded as failed while the message may still arrive, and the retry round can then deliver it twice. This matches the accepted "may arrive twice" case of the 10-minute sweep, but it is not stated for the timeout. | Add one line to the design notes or the code comment; no code change needed unless the owner wants it. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/functional-design/rules.md BR52.2 and functional-spec.md line 35 ("check-name order") against migration line 671 (order by lock_step, check_name) | The functional rule says checks run in name order; the migration, the nfr-design and the plan say lock_step then name. The code follows the design that matters, but the functional rule is stale. | Update BR52.2 and the spec line to say lock_step then name. | New |
| R-07 | Minor | tests/database/notices-send.test.ts (test list) and unit-test-instructions.md "The Fixed List" | The fixed list names "outdated screen" as not meaningful only for the claim, sweep, record and run. notice_send has no outdated-screen case and no recorded reason for leaving it out. | Add the one-line reason to the unit test instructions. | New |

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| node --test src/identity/mail.test.ts scripts/timed-run.test.ts src/access/role-policy.test.ts | PASS, 33 of 33 | Mailer (reason class, no library text, overall timeout), timed command (50 of 60, batches of 10, 2-minute stop, counts-only log) and the super-admin-only rule hold. |
| node --test --test-concurrency=1 on tests/database/notices-send, -delivery, -run, -failures, -migration (local stack) | PASS, 84 of 84 | The migration applies and the database rules and their fixed-list cases run green on the real stack. |
| tsc --noEmit, eslint and prettier --check on the changed source | Clean | No type, lint or format problems in the reviewed files. |
| Coverage, verify:local, notices-mail-catcher, browser specs | Not run by this review | The summary figures (coverage 93.21 / 86.04 / 92.5 / 94.41 and the verify:local pass) were not re-checked; they are the builder's claim. |

**Checked and found sound (verified in the migration, no finding):**

- Lock order. The duty-reminder check locks job rows ascending and reads tasks and families without a lock. Removal locks job rows ascending, then delivery rows ascending, after the caller's family row. Try again locks delivery rows ascending. The run orders checks by `lock_step` then name, and `lock_step` is NOT NULL with a 1 to 4 check.
- Grants. Every new function starts with `revoke all` from public, anon, authenticated and service_role. Claim, sweep, record and the run are granted to service_role only. The list, mark read, delivery list and Try again go to authenticated and check the caller in the body. Notice_send, the facts functions, the checks and housekeeping have no grant. The search path is pinned with `set search_path from current`. The tables have row-level security on and no right for any role.
- No personal text. No table holds an address, name or message; the attempt table keeps only a reason class (constrained to three values); the check record keeps only a 10-character error code; the failure list holds kind label, item date, ids and counts; the command logs counts and reason classes; the mailer drops the library text.
- Try again stale rule. The screen sends (id, try count); the function counts any listed email that is not failed, not in the group, or has another try count, and refuses with REMINDER_STALE. A newly failed email stays failed; an empty group gives REMINDER_NOT_RETRYABLE.
- Claim and sweep. The claim uses `for update skip locked`, ordered oldest first, with a limit from 1 to 50. The command uses batches of 10, at most 50 per pass, and no new batch after 2 minutes. The sweep uses a 10-minute limit with `skip locked`. Housekeeping uses 90 days for deliveries and 30 days for run and check records.
- Screen differences from the Stitch design (retry button per group; no page redraw after Try again) are declared in code-summary.md and match the code.

### Summary

The unit is implementable and its core rules hold: lock order, grants, no personal text, the Try again stale rule and the claim, sweep and housekeeping limits all match the design, and 84 database tests plus the mailer, command and access tests passed here. One Major finding (a Try again key that can collide and block a retry) and six Minor findings should be weighed at the gate; none blocks.
