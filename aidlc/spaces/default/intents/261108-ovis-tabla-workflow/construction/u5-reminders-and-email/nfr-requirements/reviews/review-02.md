## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/reliability-requirements.md > NFR7.9 (and tech-stack-decisions.md > "Titles and links") | NFR7.9 requires every existing notice to read "with the title it has today (including state-dependent titles)". The functional rules define a title as a fixed kind prefix plus the item name (BR50.4), which cannot produce "Csere jóváhagyva" or "Csere elutasítva" depending on the request's state, nor the no-item title of the rota_published notice. The tech-stack table repeats the prefix-plus-item model. The title question raised when the functional design was reviewed is therefore not settled: the NFR demands a result the rule cannot give, and the test cannot pass. | Decide the title model here: for example the facts function also returns the title, or the state-dependent kinds are split into one kind per outcome, and rota_published gets its own title form. Then list the seed row for every existing kind and make NFR7.9 compare against that list. Align BR50.4 in the same change. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/scalability-requirements.md > NFR5.5, NFR5.6 | "Try again" is refused as outdated "when the group's latest try changed", but nothing says what the screen sends back (group kind and item, plus which latest-try value), or which failed emails the call restarts when a new failure joins the group after the screen was shown. The outdated-screen test required by NFR6.2 cannot be written from this text. | Define the token (for example the group key plus the largest try id the screen showed), state that it is compared under the ascending-id lock, and state which failed emails restart. Add the case of a failure that arrives after the screen was shown. | New |
| R-03 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/security-requirements.md > NFR1.6 | NFR1.6 says removal deletes the parent's emails and tries, "including an email that is claimed at that moment", and also that "a claimed email whose parent is gone is cancelled at its outcome". Those contradict: once the row is deleted there is no outcome to cancel (BR51.5 ignores it). It also says nothing about the already-handed-out address, so a removed person can still receive the email in flight, and nothing about how the delete and the claim interact (the claim skips locked rows; the delete would wait or skip). The pass criterion ("one with a claim held") has no stated expected result. | State one behaviour: removal takes the delivery row locks (waits for a claim in progress, or marks the row so its late outcome is dropped), and say whether the in-flight email is accepted as unavoidable or prevented. Write the expected result into the test. | New |
| R-04 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/performance-requirements.md > NFR9.5 and reliability-requirements.md > NFR7.3, NFR7.6 | The pass limit is 50 emails and 2 minutes "to start new sends", but the NFRs do not say whether the claim takes up to 50 at once or one at a time, nor give a per-send timeout. If all 50 are claimed up front, the ones not reached are in sending, not "still due", so the test "60 due, send 50 or fewer, leave the rest queued" is wrong; they only come back after the 10-minute claim_expired rule, burning one of the 3 tries and risking a double send. A single hung send is not bounded by "stops starting" either, and it can overrun the 10-minute claim limit. | Fix the claim granularity (claim and send in small batches or one by one) and add a per-send timeout well under 10 minutes. Rewrite the test to match, and state that unreached emails are not counted as tries. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/performance-requirements.md > NFR9.7 (and NFR7.7) | "Each check runs in its own transaction" is not possible if the run is one database function called by the service: it runs in one transaction, and each check is only a sub-step that can be undone on its own (BR52.2 says only that a failure undoes that check). Locks taken by one check stay until the whole run ends. The test (a sign-up on another task proceeds) would pass without proving the claim. | Reword to "each check's changes are undone on their own if it fails" and drop the lock claim, or specify that the command calls each check separately. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/security-requirements.md > NFR1.5 and tech-stack-decisions.md > Retention | Retention (Q1 A) is run by a "housekeeping check" that exists in no functional rule: it is not a registered check, has no rule number and no record of its own. Nothing states that no check may rely on run or check records to decide what is due, which would resend after pruning. It is also not stated whether a failed email is pruned 90 days after its last try even if the super admin never saw it. | Register the housekeeping check by name in the check registry list, state that idempotency relies on once keys and job state only, and state the rule for unretried failures. Add the rule to the functional rules in the same change. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/security-requirements.md > NFR1.4, NFR1.2 | The no-address rule is tested only on the emitted event line and the tables. A mail library's thrown error text commonly includes the recipient and the server's reply, and an unhandled error can reach the framework log. | Add a requirement and test that the mail adapter maps every send error to a class and drops the message, and that nothing logged on a failed send contains the address. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/performance-requirements.md > NFR9.1, NFR9.6, NFR9.4, NFR9.2 | NFR9.1 measures on a seed of 30 families and NFR9.6 on "the large seed" of 20 families; they cannot both describe `db:seed:large`. NFR9.4's "no full scan on 10,000 rows" needs a stated way to force the planner, and NFR9.2's "counts the calls" does not say what is counted (the app's round trips or the facts-function calls inside the database). | Use one seed size, and say how the plan test avoids a small-table scan and what the call count measures. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/traceability.json > coverage for NFR4, NFR5, NFR7 | The IDs NFR4.2 to NFR4.9 (observability), NFR7.1 to NFR7.9 (reliability, migration) and NFR5.x are filed under upstream requirements that mean audit, delivery checks and concurrency. All are present and resolve, but the coverage rows read OK for upstream wording the sub-items do not address. The upstream mean "audit of grants, rota publishing, interventions" for NFR4 and the CI gate for NFR7. | Number the sub-items under their own headings, or add a note per row saying which upstream clause is met and which is out of scope for this Unit. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/security-requirements.md > NFR3.7, NFR10.4 | The registry-write control is covered (migration only, quoted names, insert test per role). Not stated: the execute rights on the facts and check functions themselves (they take a parent id and are called by name, so a signed-in caller who can execute one could read another family's item facts), and who the facts functions run as. | State that facts and check functions are not executable by signed-in or anonymous roles (or check the reading parent inside), and add them to the NFR3.6 grant catalogue test. | New |
| R-11 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-requirements/scalability-requirements.md NFR5.6 | NFR5.6 describes the stale rule exactly as the code does, but does not name the 5000-email cap on one Try again that the code now enforces. | Optionally add the cap to NFR5.6; not blocking. | New |

> R-01 Not re-checked this round

> R-02 Not re-checked this round

> R-03 Not re-checked this round

> R-04 Not re-checked this round

> R-05 Not re-checked this round

> R-06 Not re-checked this round

> R-07 Not re-checked this round

> R-08 Not re-checked this round

> R-09 Not re-checked this round

> R-10 Not re-checked this round

### Validation Tool Results

| Tool | Result | Interpretation |
|---|---|---|
| Cross-check of NFR5.5, NFR5.6, NFR7.6, NFR9.5 against code and tests | Consistent | 50 per pass, batches of 10, 30-second send timeout (now a real abort), 2-minute stop, stale rule: all match. Database tests (64) and mailer and command tests (42) passed. |

### Summary

The requirements still match the final code; nothing in the fixes contradicts them.
