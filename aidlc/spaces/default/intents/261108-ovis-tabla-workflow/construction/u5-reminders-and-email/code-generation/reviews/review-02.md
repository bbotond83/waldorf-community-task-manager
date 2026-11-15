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
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/code-generation/code-summary.md > review fixes | Verified fixed, no action: (1) Try again key: src/application/delivery-labels.ts deliveryRetryKey hashes the sorted (id, try count) list with sha256; the 3+3 versus 6 collision is tested in delivery-labels.test.ts; key is under 200 characters, matching the database limit. (2) Bare labels: buildNoticeMessage in src/identity/mail.ts drops the Feladat and Időpont lines (text and html) when empty; tested. (3) Size limit: the migration now allows 1 to 5000 listed emails and refuses more with REMINDER_TOO_LARGE, which advanced-actions.ts maps to a Hungarian message; tests/database/notices-failures.test.ts retries 501 and refuses 5001. (4) Run failure: scripts/timed-run.ts sets failed and still runs the delivery pass, then exits 1; tested. (5) Timeout: createNoticeMailer aborts via AbortSignal and the SMTP transport destroys its own socket on abort; tested including a real connection. (6) Design wording "lock_step order, then check-name order" is in rules.md line 147 and functional-spec.md line 35. (7) "Outdated screen" for notice_send is recorded in unit-test-instructions.md line 66 and the header of notices-send.test.ts. | None. | New |
| R-09 | Minor | src/identity/mail.ts createNoticeMailer, send race | If the library finishes at the same moment the timeout fires, the try is recorded as failed although the mail may have left; the retry could then send twice. This is the already accepted at-least-once case and is now very narrow. | Optionally say so in the code comment; no code change. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| node --test mail.test.ts, timed-run.test.ts, delivery-labels.test.ts, role-policy.test.ts | PASS, 42 of 42 | Mailer, timed command, key and access rules hold. |
| node --test on tests/database notices-failures, notices-send, notices-run (local stack) | PASS, 64 of 64 | The 5000 limit, stale rule, grants refusals and send rules hold on the real stack. |
| tsc --noEmit, eslint on app/admin, src/identity, src/application, scripts/timed-run.ts | Clean | No type or lint problems. |
| Full coverage run and verify:local | Not run by this review | Builder's claim only; not re-checked. |

**Design rules re-checked, nothing broke:** lock order is unchanged (retry locks delivery rows ascending; checks run by lock_step then name); every new function keeps revoke all then explicit grant, with service role only for claim, sweep, record and run; no address, name or message text is stored or logged (the mailer still maps errors to a reason class and the command logs counts and classes only); the Try again stale rule (REMINDER_STALE for any listed email that is not failed or has another try count; later failures stay failed) is intact; claim limit (50 per pass, batches of 10, 2 minutes) and the 10-minute sweep are unchanged.

### Summary

All seven earlier findings are really fixed with code and tests, and the design rules (lock order, grants, no personal text, stale rule, claim and run limits) still hold. Ready.
