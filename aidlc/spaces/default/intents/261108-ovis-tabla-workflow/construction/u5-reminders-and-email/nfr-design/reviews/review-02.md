## Review

**Verdict:** READY
**Reviewer:** aidlc-architecture-reviewer-agent
**Date:** 2026-11-15
**Iteration:** 1
**Verdict Dictated:** no

### Findings

| ID | Severity | Location | Finding | Required action | Status |
|---|---|---|---|---|---|
| R-01 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/scalability-design.md > Lock order; reliability-design.md > Failure isolation in the run | The daily run is one database call, so one transaction. A check's sub-block frees its locks only when it fails; a check that succeeds keeps its locks until the whole run ends. Later units add checks that lock duty, place or task rows (swap expiry, empty slots, recurring occurrences) and others that lock a family row. Checks run in name order, so a later check can take a family row after an earlier one already holds duty rows. That reverses the family-then-task-then-assignment order and can deadlock with a signed-in command. The design proves "no cycle" only for U5's own duty-reminder check, and performance-design.md adds that the run "keeps its locks until it ends". | Make the lock order hold across checks. Either run each check in its own transaction (the timed command calls one function per check, or the run commits between checks), or require every check to take its locks in the contract order and have the run order checks by lock step. State the rule for checks that later units contribute. | New |
| R-02 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/scalability-design.md > Concurrency patterns (Try again) | The "outdated screen" rule is not implementable as written. The functional rules refuse the call with REMINDER_STALE when any email of the group has a newer try than the one shown. They also say a failure that arrived later stays failed and is not restarted. A later failure always carries a newer try, so the refusal always fires and "restart only deliveries at or below it" never runs. Using the largest try id as the staleness marker is also fragile: sequence ids are not ordered by commit time, so a try committed late can carry a lower id and slip past the check. | Define one exact rule. Say which changes make the screen stale (a new try on a listed email, or a new failed email joining the group) and what is restarted. Use something the lock makes reliable, for example the set of listed delivery ids plus each one's try count, or a version on the group, instead of a sequence id. Add a test case for each outcome. | New |
| R-03 | Major | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/performance-design.md > Delivery-problems screen; security-design.md > Data minimisation | The failure screen shows a notice title per group, but titles come from facts functions that take "the reading parent". On this screen there is no reading parent, only a super admin. Swap-decision titles are built per reader. The design does not say which parent id is passed, or how the title is produced without leaking another family's data. NFR1.3 and NFR10.4 require that no name leaks on this screen. | Say how a group's title is built on the screen: a fixed neutral title (kind label plus item date), or a facts call with a defined actor. Extend the shared leak test to cover the failure list result. | New |
| R-04 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/security-design.md > Community and recipient checks | `notice_send` joins parents to "the caller's community". The daily run and its checks have no signed-in caller (BR52.7), so the community source is undefined there. | State where the community comes from for a system call. It could be the single community row, or the community of the recipient parent's family. Add a test with a service-role call. | New |
| R-05 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/security-design.md > Function access | The expiry sweep (BR51.4) runs first in every pass and writes try records. It is not in the grant table, so it has no grant rule, no service-role check and no stated locking. Under contention it must use `skip locked` or ascending locks, or it can deadlock with removal and Try again. | Add the sweep to the service-role-only group. State its row locking, for example `skip locked`. | New |
| R-06 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/performance-design.md > Notice list | The design describes "a lateral call to the target type's facts function". The function name comes from a registry and is built with `format('%I')`, so the call must be dynamic SQL executed per row. A static lateral join cannot do that. The index plan test therefore cannot cover that part. The security design's notes on dynamic calls (pinned path, quoted name) are not carried into the list's description. | Describe it as a loop with `EXECUTE` inside the one list function, with a bounded page of 50. Keep the plan test on the outer query. | New |
| R-07 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/reliability-design.md > Retry rounds | The 30-second send timeout and the 5-minute batch bound assume a hard total timeout per send. The mail library has only per-phase timeouts, so one send can run longer. A batch could then outlast the 10-minute expiry and double-send. | Require the adapter to enforce one overall timeout (for example an abort or race around the send). Add a slow-server test. | New |
| R-08 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/security-design.md > Removal | Removal locks delivery rows but not the reminder job rows it marks removed. The duty-reminder check locks those rows `for update`. The order for the two is not stated. | State that removal takes job rows ascending after the family row, before delivery rows. | New |
| R-09 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/observability-design.md > Records | The contract's check record has created and skipped columns, and NFR4.5 needs counts in the summary line. The design's record lists only name, outcome and error code. The contract also says a missing function is recorded as failed, while the design and the requirements say missing. | Add created and skipped to the check record. Record the missing/failed difference as an explicit decision. | New |
| R-10 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/traceability.json > coverage | Several entries are marked OK for requirements the target file does not address. NFR1.1 (invented data, privacy allowlist) has no text in security-design.md. NFR1.3 (failure list returns no address or name) is not stated there. NFR3.9 (a facts function checks the reading parent may see the item) is absent. NFR6.1 (80% coverage) is not named in reliability-design.md. NFR8.2 (phone width, keyboard, accessibility) is not named in performance-design.md. NFR9.1 and NFR9.6 (the `db:seed:large` timing test) are replaced by a 10,000-row plan test. | Add the missing statements to the design files, or change those entries to the real target. | New |
| R-11 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/security-design.md line 27 | The text lists the reason classes as rejected, unavailable, timeout, other; the code and database keep three classes (mail_unavailable, mail_rejected, claim_expired), and a timeout is stored as mail_unavailable. | Optionally align the sentence with the three stored classes; not blocking. | New |
| R-12 | Minor | aidlc/spaces/default/intents/261108-ovis-tabla-workflow/construction/u5-reminders-and-email/nfr-design/reliability-design.md line 18 | The design says an overall timeout aborts the whole send; the code now does this really (abort signal, socket destroyed), which removes the earlier double-send gap. The design does not say the late-delivery case is closed apart from a send finishing at the very moment of the timeout. | Optionally add one sentence; not blocking. | New |

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
| Cross-check of scalability, reliability, performance and security design against migration and code | Consistent | Ascending lock order, lock_step ordering, stale rule, grants, counts-only logging and claim and sweep limits match; 64 database and 42 unit tests passed. |

### Summary

The NFR design still matches the final code; only two wording alignments remain, neither blocking.
